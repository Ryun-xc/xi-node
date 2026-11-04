$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$node = Join-Path $root 'node.exe'
$app = Join-Path $root 'app\xi-node'
$data = Join-Path $root 'data'
$script:url = 'http://127.0.0.1:8787'
$script:server = $null
$script:token = ''

function Test-XiNode {
  try { (Invoke-WebRequest "$script:url/api/health" -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 }
  catch { $false }
}

if (-not (Test-XiNode)) {
  $env:XI_NODE_DATA = $data
  $env:XI_NODE_PORT = '8787'
  $script:server = Start-Process -FilePath $node -ArgumentList 'server.mjs' -WorkingDirectory $app -WindowStyle Hidden -PassThru
}

for ($i = 0; $i -lt 30; $i++) {
  if (Test-XiNode) { break }
  Start-Sleep -Milliseconds 300
}

$tokenFile = Join-Path $data 'access-token'
if (Test-Path $tokenFile) { $script:token = (Get-Content $tokenFile -Raw).Trim() }
$script:openUrl = if ($script:token) { "$script:url/?token=$([uri]::EscapeDataString($script:token))" } else { $script:url }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.Text = 'XI Node · local host'
$notify.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$open = $menu.Items.Add('打开 XI Node')
$open.Add_Click({ Start-Process $script:openUrl }.GetNewClosure())
$backup = $menu.Items.Add('立即备份')
$backup.Add_Click({
  try {
    $headers = if ($script:token) { @{ Authorization = "Bearer $script:token" } } else { @{} }
    Invoke-RestMethod "$script:url/api/backup" -Method Post -Headers $headers | Out-Null
    [System.Windows.Forms.MessageBox]::Show('备份完成', 'XI Node') | Out-Null
  } catch { [System.Windows.Forms.MessageBox]::Show("备份失败：$($_.Exception.Message)", 'XI Node') | Out-Null }
}.GetNewClosure())
$folder = $menu.Items.Add('打开数据目录')
$folder.Add_Click({ Start-Process $data }.GetNewClosure())
[void]$menu.Items.Add('-')
$exit = $menu.Items.Add('退出 XI Node')
$exit.Add_Click({
  $notify.Visible = $false
  $notify.Dispose()
  if ($script:server -and -not $script:server.HasExited) { Stop-Process -Id $script:server.Id -Force -ErrorAction SilentlyContinue }
  [System.Windows.Forms.Application]::Exit()
}.GetNewClosure())
$notify.ContextMenuStrip = $menu
$notify.Add_DoubleClick({ Start-Process $script:openUrl }.GetNewClosure())

Start-Process $script:openUrl
[System.Windows.Forms.Application]::Run()