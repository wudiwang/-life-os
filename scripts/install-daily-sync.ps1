# 注册「每日项目进度同步」的 Windows 计划任务。
# 用法（普通权限即可，不需要管理员）：
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-sync.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-sync.ps1 -At 21:30
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-sync.ps1 -WithBotAutostart
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-sync.ps1 -Uninstall
#
# 说明：任务以"仅在用户登录时运行"注册——claude CLI 要用登录用户的订阅凭据，
# 用 SYSTEM 账户跑会拿不到。日志见 %LOCALAPPDATA%\Temp\life-os-sync.log

param(
  [string]$At = '22:07',
  [switch]$WithBotAutostart,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$syncTask = 'life-os-daily-sync'
$botTask  = 'life-os-bot-autostart'
$logSync  = Join-Path $env:LOCALAPPDATA 'Temp\life-os-sync.log'
$logBot   = Join-Path $env:LOCALAPPDATA 'Temp\daxian-bot.log'

function Remove-TaskIfExists($name) {
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host "已移除任务：$name"
  }
}

if ($Uninstall) {
  Remove-TaskIfExists $syncTask
  Remove-TaskIfExists $botTask
  Write-Host '卸载完成。'
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw '找不到 node，请确认 Node.js 已装且在 PATH 里'
}

# ── 每日进度同步 ──
# 走 powershell 包一层是为了拿到输出重定向；路径含中文，靠 Task Scheduler 的
# Unicode 参数传递避开 cmd 的代码页坑。
$syncCmd = "Set-Location '$proj'; node scripts/sync-project-progress.mjs 2>&1 | Out-File -FilePath '$logSync' -Append -Encoding utf8"
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command `"$syncCmd`""
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# 到点没开机就等下次开机后补跑一次，别默默丢一天
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Remove-TaskIfExists $syncTask
Register-ScheduledTask -TaskName $syncTask -Action $action -Trigger $trigger -Settings $settings `
  -Description '每晚汇总各 Claude Code 项目当天进展，写入人生 OS 的每日三向' | Out-Null
Write-Host "✅ 已注册：$syncTask  每天 $At"
Write-Host "   日志：$logSync"

# ── 可选：开机自启大仙 ──
if ($WithBotAutostart) {
  $botCmd = "Set-Location '$proj'; node scripts/bot-forever.mjs 2>&1 | Out-File -FilePath '$logBot' -Append -Encoding utf8"
  $botAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$botCmd`""
  $botTrigger = New-ScheduledTaskTrigger -AtLogOn
  $botSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)

  Remove-TaskIfExists $botTask
  Register-ScheduledTask -TaskName $botTask -Action $botAction -Trigger $botTrigger -Settings $botSettings `
    -Description '开机自启「大仙」TG 机器人 + AI 提炼 worker' | Out-Null
  Write-Host "✅ 已注册：$botTask  登录时自启（bot-forever 自带单实例锁，重复启动会自行退出）"
  Write-Host "   日志：$logBot"
}

Write-Host ''
Write-Host '立即试跑一次：'
Write-Host "  Start-ScheduledTask -TaskName $syncTask"
Write-Host '查看下次运行时间：'
Write-Host "  Get-ScheduledTask -TaskName $syncTask | Get-ScheduledTaskInfo"
