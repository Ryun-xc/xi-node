$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$core = Join-Path $here 'core'
$node = (Get-Command node -ErrorAction Stop).Source
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Step($name, [scriptblock]$body) {
  Write-Host "`n== $name =="
  try { & $body; Write-Host 'PASS' } catch { $failures.Add("$name : $($_.Exception.Message)"); Write-Host "FAIL: $($_.Exception.Message)" }
}

Step 'Node version' {
  $v = & $node --version
  if ([int](($v -replace 'v','').Split('.')[0]) -lt 20) { throw "Node 20+ required, got $v" }
  Write-Host $v
}

if (Test-Path (Join-Path $core 'test\run.mjs')) {
  Step 'xi-core tests' {
    Push-Location $core
    try { & $node 'test/run.mjs'; if ($LASTEXITCODE -ne 0) { throw "core tests exit $LASTEXITCODE" } } finally { Pop-Location }
  }
}

Step 'xi-node tests' {
  Push-Location $here
  try { & npm.cmd test; if ($LASTEXITCODE -ne 0) { throw "xi-node tests exit $LASTEXITCODE" } } finally { Pop-Location }
}

Step 'local server health' {
  $tmp = Join-Path $env:TEMP ('xi-verify-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  $oldPort = $env:XI_NODE_PORT; $oldData = $env:XI_NODE_DATA; $oldAuth = $env:XI_NODE_AUTH
  $env:XI_NODE_PORT = '8783'; $env:XI_NODE_DATA = $tmp; $env:XI_NODE_AUTH = 'off'
  $proc = Start-Process -FilePath $node -ArgumentList 'server.mjs' -WorkingDirectory $here -WindowStyle Hidden -PassThru
  try {
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Milliseconds 300
      try { $s = Invoke-RestMethod 'http://127.0.0.1:8783/api/status'; if ($s.ok) { $ok = $true; break } } catch {}
    }
    if (-not $ok) { throw 'server did not become healthy' }
    $m = Invoke-RestMethod 'http://127.0.0.1:8783/api/model/test' -Method Post -ContentType 'application/json' -Body '{"model":{"provider":"mock"}}'
    if (-not $m.ok) { throw 'mock model test failed' }
    Write-Host "version=$($s.version) model=mock"
  } finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    $env:XI_NODE_PORT = $oldPort; $env:XI_NODE_DATA = $oldData; $env:XI_NODE_AUTH = $oldAuth
  }
}

Step 'portable artifact' {
  $zip = Join-Path $here 'dist\xi-node-win-x64-v0.1.0.zip'
  if (-not (Test-Path $zip)) { throw 'portable zip missing' }
  $mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
  Write-Host "zip=$mb MB"
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Step 'Docker CLI' { & docker --version; if ($LASTEXITCODE -ne 0) { throw 'docker --version failed' } }
} else {
  $warnings.Add('Docker not installed; Docker image was not verified')
}

try { Invoke-RestMethod 'http://127.0.0.1:9223/json/version' -TimeoutSec 1 | Out-Null; $hasCdp = $true } catch { $hasCdp = $false }
if ($hasCdp) {
  Step 'UI smoke' {
    Push-Location $here
    try { & $node 'scripts/ui-smoke.mjs'; if ($LASTEXITCODE -ne 0) { throw "UI smoke exit $LASTEXITCODE" } } finally { Pop-Location }
  }
} else {
  $warnings.Add('UI smoke skipped: Edge/Chrome CDP not running on 9223')
}

Write-Host "`n========== RESULT =========="
if ($warnings.Count) { $warnings | ForEach-Object { Write-Host "WARN $_" } }
if ($failures.Count) {
  $failures | ForEach-Object { Write-Host "FAIL $_" }
  exit 1
}
Write-Host 'ALL AUTOMATED CHECKS PASSED'