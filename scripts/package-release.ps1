# Build a source-only release archive from tracked files.
$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
Push-Location $here
try {
  $dirty = git status --porcelain
  if ($dirty) { throw 'Working tree is dirty. Commit or stash changes before packaging.' }
  $release = Join-Path $here 'release'
  New-Item -ItemType Directory -Path $release -Force | Out-Null
  $zip = Join-Path $release 'xi-node-v0.1.0-source.zip'
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  git archive --format=zip --output=$zip HEAD
  $hash = (Get-FileHash $zip -Algorithm SHA256).Hash
  Set-Content -Path ($zip + '.sha256') -Value "$hash  xi-node-v0.1.0-source.zip" -Encoding utf8
  Get-Item $zip | Select-Object FullName, @{n='MB';e={[math]::Round($_.Length/1MB,2)}}
  Get-Content ($zip + '.sha256')
} finally {
  Pop-Location
}