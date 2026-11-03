$ErrorActionPreference = 'Stop'
$runtime = Join-Path $PSScriptRoot '.runtime'
foreach ($name in @('tunnel','server')) {
    $pidPath = Join-Path $runtime "$name.pid"
    if (-not (Test-Path -LiteralPath $pidPath)) { continue }
    $taskPid = [int](Get-Content -LiteralPath $pidPath)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $taskPid" -ErrorAction SilentlyContinue
    $expected = if ($name -eq 'server') { 'server.mjs' } else { 'cloudflared.exe' }
    if ($process -and $process.CommandLine.Contains($expected) -and $process.ExecutablePath -eq $(if ($name -eq 'server') { (Get-Command node.exe).Source } else { Join-Path $runtime 'cloudflared.exe' })) { Stop-Process -Id $taskPid }
    Remove-Item -LiteralPath $pidPath
}
Write-Host '本项目的临时分享已关闭。'
