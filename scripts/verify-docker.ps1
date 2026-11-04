# Run after the Windows reboot that activates WSL2.
$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$log = Join-Path $here 'dist\docker-verify.log'
New-Item -ItemType Directory -Path (Split-Path $log) -Force | Out-Null
function Log($s) { Write-Host $s; Add-Content -Path $log -Value $s }
Log "== Docker verify $(Get-Date -Format o) =="
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path $docker)) { throw 'Docker CLI not found' }

function Run-Docker([string[]]$arguments, [switch]$AllowFailure) {
  $out = Join-Path $env:TEMP ('xi-docker-out-' + [guid]::NewGuid().ToString('N'))
  $err = Join-Path $env:TEMP ('xi-docker-err-' + [guid]::NewGuid().ToString('N'))
  $p = Start-Process -FilePath $docker -ArgumentList $arguments -NoNewWindow -Wait -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  if (Test-Path $out) { Get-Content $out | ForEach-Object { Log $_ }; Remove-Item $out -Force -ErrorAction SilentlyContinue }
  if (Test-Path $err) { Get-Content $err | ForEach-Object { Log $_ }; Remove-Item $err -Force -ErrorAction SilentlyContinue }
  if ($p.ExitCode -ne 0 -and -not $AllowFailure) { throw "docker $($arguments -join ' ') failed (exit $($p.ExitCode))" }
  return $p.ExitCode
}

Push-Location $here
try {
  Run-Docker @('version', '--format', 'client={{.Client.Version}}')
  try { $infoExit = Run-Docker @('info') -AllowFailure } catch { $infoExit = 1 }
  if ($infoExit -ne 0) { Log 'Docker engine is not ready. Start Docker Desktop once after reboot, then rerun this script.'; exit 2 }

  Run-Docker @('compose', 'config')
  Run-Docker @('compose', 'build')
  Run-Docker @('compose', 'up', '-d')
  $token = (& $docker compose exec -T xi-node cat /data/access-token 2>$null | Out-String).Trim()

  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
      $s = Invoke-RestMethod 'http://127.0.0.1:8787/api/status' -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 2
      if ($s.ok) { $ok = $true; Log "health ok version=$($s.version)"; break }
    } catch {}
  }
  if (-not $ok) { Run-Docker @('compose', 'logs', '--tail', '80') -AllowFailure; throw 'container did not become healthy' }

  Run-Docker @('compose', 'ps')
  Log 'PASS Docker build + run'
} finally {
  Pop-Location
}