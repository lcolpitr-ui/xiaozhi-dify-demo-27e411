$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$runtime = Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot '.env'))) { throw '请先复制 .env.example 为 .env，配置 Dify 应用密钥。' }
function Start-TaskProcess($name, $program, $arguments) {
    $pidPath = Join-Path $runtime "$name.pid"
    if (Test-Path -LiteralPath $pidPath) {
        $taskPid = [int](Get-Content -LiteralPath $pidPath)
        $existing = Get-Process -Id $taskPid -ErrorAction SilentlyContinue
        if ($existing) { Write-Host "$name 已在运行。"; return }
    }
    $process = Start-Process -FilePath $program -ArgumentList $arguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime "$name.out.log") -RedirectStandardError (Join-Path $runtime "$name.err.log")
    $process.Id | Set-Content -LiteralPath $pidPath
}
Start-TaskProcess 'server' (Get-Command node.exe).Source @('--env-file=.env','server.mjs')
$tunnelPath = Join-Path $runtime 'cloudflared.exe'
if (-not (Test-Path -LiteralPath $tunnelPath)) { Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $tunnelPath }
Start-TaskProcess 'tunnel' $tunnelPath @('tunnel','--url','http://127.0.0.1:3210','--no-autoupdate','--protocol','http2')
Write-Host '聊天服务：http://localhost:3210'
Write-Host '分享链接正在生成，请查看 .runtime/tunnel.err.log 中的 https://*.trycloudflare.com 地址。'
