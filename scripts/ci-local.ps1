# Local release gate: tests + Docker build + ephemeral container health.
$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
Push-Location $here
try {
  $env:XI_NODE_AUTH = 'off'
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'npm test failed' }

  docker build -t xi-node:ci-local .
  if ($LASTEXITCODE -ne 0) { throw 'docker build failed' }

  $name = 'xi-node-ci-local'
  docker rm -f $name 2>$null | Out-Null
  docker run -d --rm --name $name -p 127.0.0.1:8899:8787 xi-node:ci-local | Out-Null
  $ok = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try { $res = Invoke-RestMethod 'http://127.0.0.1:8899/api/health'; if ($res.ok) { $ok = $true; break } } catch {}
  }
  if (-not $ok) { docker logs $name; throw 'container health failed' }
  Write-Host 'PASS local CI gate'
} finally {
  docker rm -f xi-node-ci-local 2>$null | Out-Null
  Pop-Location
}