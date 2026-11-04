# Build a self-contained Windows portable bundle.
$ErrorActionPreference = 'Stop'
$here = Split-Path $PSScriptRoot -Parent
$core = Join-Path $here 'core'
$distRoot = Join-Path $here 'dist'
$dist = Join-Path $distRoot 'xi-node-win-x64'
$node = if ($env:XI_NODE_EXE) { $env:XI_NODE_EXE } else { (Get-Command node -ErrorAction Stop).Source }
if (-not (Test-Path $node)) { throw "node.exe not found: $node" }
if (Test-Path $distRoot) { Remove-Item $distRoot -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $dist 'app\xi-node') -Force | Out-Null
Copy-Item $node (Join-Path $dist 'node.exe')
Copy-Item $core (Join-Path $dist 'app\xi-node\core') -Recurse
Copy-Item (Join-Path $here 'server.mjs') (Join-Path $dist 'app\xi-node\server.mjs')
Copy-Item (Join-Path $here 'server') (Join-Path $dist 'app\xi-node\server') -Recurse
Copy-Item (Join-Path $here 'web') (Join-Path $dist 'app\xi-node\web') -Recurse
Copy-Item (Join-Path $here 'docs') (Join-Path $dist 'app\xi-node\docs') -Recurse
Copy-Item (Join-Path $here 'README.md') (Join-Path $dist 'app\xi-node\README.md')
Copy-Item (Join-Path $here 'LICENSE') (Join-Path $dist 'app\xi-node\LICENSE')
Copy-Item (Join-Path $here 'NOTICE') (Join-Path $dist 'app\xi-node\NOTICE')
Copy-Item (Join-Path $here 'packaging\START.vbs') (Join-Path $dist 'START.vbs')
Copy-Item (Join-Path $here 'packaging\tray.ps1') (Join-Path $dist 'tray.ps1')
Copy-Item (Join-Path $here 'packaging\README.txt') (Join-Path $dist 'README.txt')
$zip = Join-Path $distRoot 'xi-node-win-x64-v0.1.0.zip'
Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $zip -Force
Write-Host "built $zip"