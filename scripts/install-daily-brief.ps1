# 注册「每日 TG 简报」的两个 Windows 计划任务（早/晚各一条）。
# 用法（普通权限即可，不需要管理员）：
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-brief.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-brief.ps1 -Morning 08:00 -Evening 22:00
#   powershell -ExecutionPolicy Bypass -File scripts\install-daily-brief.ps1 -Uninstall
#
# 说明：任务以"仅在用户登录时运行"注册，和 life-os-daily-sync 一致。
# 日志见 %LOCALAPPDATA%\Temp\life-os-brief.log
#
# 本文件必须存成 UTF-8 with BOM——PowerShell 5.1 会把无 BOM 的 UTF-8 当 ANSI 读，
# 中文乱码且参数解析出错。

param(
  [string]$Morning = '08:30',
  [string]$Evening = '21:30',
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$proj = Split-Path -Parent $PSScriptRoot
$amTask = 'life-os-brief-morning'
$pmTask = 'life-os-brief-evening'
$log    = Join-Path $env:LOCALAPPDATA 'Temp\life-os-brief.log'

function Remove-TaskIfExists($name) {
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host "已移除任务：$name"
  }
}

if ($Uninstall) {
  Remove-TaskIfExists $amTask
  Remove-TaskIfExists $pmTask
  Write-Host '卸载完成。'
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw '找不到 node，请确认 Node.js 已装且在 PATH 里'
}

function Register-Brief($name, $at, $flag, $desc) {
  $cmd = "Set-Location '$proj'; node scripts/daily-brief.mjs $flag 2>&1 | Out-File -FilePath '$log' -Append -Encoding utf8"
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$cmd`""
  $trigger = New-ScheduledTaskTrigger -Daily -At $at
  # 到点没开机就等开机后补推一次——晚推总比不推强
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

  Remove-TaskIfExists $name
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
    -Description $desc | Out-Null
  Write-Host "✅ 已注册：$name  每天 $at"
}

Register-Brief $amTask $Morning '--morning' '早间简报：今天该做的动作 + 核心原则'
Register-Brief $pmTask $Evening '--evening' '晚间收工三问：动作 / 原则落实 / 明天第一件事'

Write-Host ''
Write-Host "   日志：$log"
Write-Host '立即试推一次：'
Write-Host '  node scripts/daily-brief.mjs --morning'
Write-Host '  node scripts/daily-brief.mjs --evening'
