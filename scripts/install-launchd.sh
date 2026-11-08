#!/bin/bash
# 注册人生 OS 在 macOS 上的常驻/定时任务（launchd，对应 Windows 的 install-daily-sync.ps1 + install-daily-brief.ps1）。
# 普通权限即可，任务装在 ~/Library/LaunchAgents，只在当前用户登录后运行
# （claude CLI 要用登录用户的订阅凭据，所以不用系统级 LaunchDaemon）。
#
# 用法：
#   bash scripts/install-launchd.sh                      # 全部安装：大仙常驻 + 吃饭提醒 + 早晚简报 + 每晚项目同步
#   bash scripts/install-launchd.sh --no-brief --no-sync # 现行配置（2026-11-08 起）：只留大仙 + 吃饭提醒
#   bash scripts/install-launchd.sh --meals 09:30,13:00,18:30,21:30   # 吃饭提醒的 4 个时间（早/午/晚/睡前）
#   bash scripts/install-launchd.sh --morning 08:00 --evening 22:00 --sync-at 21:30
#   bash scripts/install-launchd.sh --no-bot             # 只装定时任务，不装大仙常驻
#   bash scripts/install-launchd.sh --no-meals           # 不装吃饭提醒
#   bash scripts/install-launchd.sh --status             # 查看各任务状态
#   bash scripts/install-launchd.sh --uninstall          # 全部移除
#
# ⚠ 同一时间只能有一台电脑跑大仙：装之前先停掉 Windows 上的大仙和计划任务（见 docs/迁移到Mac.md 第四节）。
#
# 行为说明：
#   - 大仙：登录即启动，进程退出（非正常）自动拉起；bot-forever 自带单实例锁。
#   - 定时任务：到点 Mac 在睡眠，launchd 会在唤醒后补跑一次；关机期间错过的不补。
#   - 日志：~/Library/Logs/life-os/{bot,meal,brief,sync}.log
#   - 每次安装都会先卸掉全部任务再按参数装，所以「暂停」某项 = 带上对应的 --no-xxx 重装一次。

set -euo pipefail

MORNING='08:30'
EVENING='21:30'
SYNC_AT='22:07'
MEALS='09:30,13:00,18:30,21:30'
WITH_BOT=1
WITH_BRIEF=1
WITH_SYNC=1
WITH_MEALS=1
ACTION='install'

while [ $# -gt 0 ]; do
  case "$1" in
    --morning) MORNING="$2"; shift 2 ;;
    --evening) EVENING="$2"; shift 2 ;;
    --sync-at) SYNC_AT="$2"; shift 2 ;;
    --no-bot) WITH_BOT=0; shift ;;
    --meals) MEALS="$2"; shift 2 ;;
    --no-brief) WITH_BRIEF=0; shift ;;
    --no-sync) WITH_SYNC=0; shift ;;
    --no-meals) WITH_MEALS=0; shift ;;
    --uninstall) ACTION='uninstall'; shift ;;
    --status) ACTION='status'; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "✗ 未知参数：$1（--help 查看用法）"; exit 1 ;;
  esac
done

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/life-os"
DOMAIN="gui/$(id -u)"

LABEL_BOT='com.lifeos.bot'
LABEL_AM='com.lifeos.brief-morning'
LABEL_PM='com.lifeos.brief-evening'
LABEL_SYNC='com.lifeos.daily-sync'
MEAL_SLOTS='morning lunch dinner night'
MEAL_LABELS=''
for slot in $MEAL_SLOTS; do MEAL_LABELS="$MEAL_LABELS com.lifeos.meal-$slot"; done
ALL_LABELS="$LABEL_BOT $LABEL_AM $LABEL_PM $LABEL_SYNC$MEAL_LABELS"

xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

unload() {
  local label="$1"
  if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
    launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  fi
  if [ -f "$AGENTS/$label.plist" ]; then
    rm -f "$AGENTS/$label.plist"
    echo "已移除任务：$label"
  fi
}

if [ "$ACTION" = 'uninstall' ]; then
  for label in $ALL_LABELS; do unload "$label"; done
  echo '卸载完成。'
  exit 0
fi

if [ "$ACTION" = 'status' ]; then
  for label in $ALL_LABELS; do
    if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
      info=$(launchctl print "$DOMAIN/$label" | grep -E '^[[:space:]]*(state|pid|last exit code) =' | sed 's/^[[:space:]]*//' | tr '\n' ' ' || true)
      echo "● $label  $info"
    else
      echo "○ $label  未安装"
    fi
  done
  echo "日志：$LOGS"
  exit 0
fi

# ── 安装 ──
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo '✗ 找不到 node，请先 brew install node'; exit 1; }
[ -f "$PROJ/.env" ] || { echo "✗ $PROJ/.env 不存在：大仙和简报都要读里面的密钥"; exit 1; }

parse_time() {
  # HH:MM → "H M"（去掉前导零，launchd 要整数）
  local t="$1"
  if ! printf '%s' "$t" | grep -Eq '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'; then
    echo "✗ 时间格式不对：$t（应为 HH:MM）" >&2; exit 1
  fi
  local h="${t%%:*}" m="${t##*:}"
  echo "$((10#$h)) $((10#$m))"
}

# launchd 给的 PATH 很短：补上 node、Homebrew、claude CLI(~/.local/bin) 的位置，python3/claude 才找得到
RUN_PATH="$(dirname "$NODE"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

write_plist() {
  # write_plist <label> <log名> <schedule-xml> <keepalive 0/1> <脚本及参数...>
  local label="$1" log="$2" schedule="$3" keepalive="$4"; shift 4
  local args="    <string>$(xml_escape "$NODE")</string>"$'\n'
  for a in "$@"; do args+="    <string>$(xml_escape "$a")</string>"$'\n'; done
  local keep=''
  if [ "$keepalive" = 1 ]; then
    keep="  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>30</integer>"
  fi
  cat > "$AGENTS/$label.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
$args  </array>
  <key>WorkingDirectory</key><string>$(xml_escape "$PROJ")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(xml_escape "$RUN_PATH")</string>
    <key>LANG</key><string>en_US.UTF-8</string>
  </dict>
  <key>StandardOutPath</key><string>$(xml_escape "$LOGS/$log.log")</string>
  <key>StandardErrorPath</key><string>$(xml_escape "$LOGS/$log.log")</string>
$schedule
$keep
</dict>
</plist>
PLIST
  plutil -lint "$AGENTS/$label.plist" >/dev/null
  launchctl bootstrap "$DOMAIN" "$AGENTS/$label.plist"
}

calendar() {
  read -r h m <<<"$(parse_time "$1")"
  echo "  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$h</integer><key>Minute</key><integer>$m</integer></dict>"
}

# 先校验时间，避免装到一半才报错（在当前 shell 里调用，格式不对会直接 exit）
parse_time "$MORNING" >/dev/null; parse_time "$EVENING" >/dev/null; parse_time "$SYNC_AT" >/dev/null
IFS=',' read -r -a MEAL_TIMES <<<"$MEALS"
if [ "${#MEAL_TIMES[@]}" -ne 4 ]; then echo "✗ --meals 要给 4 个时间（早,午,晚,睡前），现在是：$MEALS"; exit 1; fi
for t in "${MEAL_TIMES[@]}"; do parse_time "$t" >/dev/null; done

if [ "$WITH_BOT" = 1 ] && [ -f "$PROJ/scripts/.bot.lock" ]; then
  pid="$(tr -dc '0-9' < "$PROJ/scripts/.bot.lock")"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "✗ 已经有一个大仙在跑（pid $pid，多半是手动 npm run bot）。先结束它（kill $pid），再装常驻任务。"
    exit 1
  fi
fi

mkdir -p "$AGENTS" "$LOGS"
for label in $ALL_LABELS; do unload "$label" >/dev/null; done

if [ "$WITH_MEALS" = 1 ]; then
  i=0
  for slot in $MEAL_SLOTS; do
    t="${MEAL_TIMES[$i]}"; i=$((i + 1))
    write_plist "com.lifeos.meal-$slot" meal "$(calendar "$t")" 0 scripts/meal-reminder.mjs --slot "$slot"
    echo "✅ 已注册：com.lifeos.meal-$slot  每天 ${t}（吃饭提醒）"
  done
else
  echo "⏸ 吃饭提醒：未安装（--no-meals）"
fi
if [ "$WITH_BRIEF" = 1 ]; then
  write_plist "$LABEL_AM" brief "$(calendar "$MORNING")" 0 scripts/daily-brief.mjs --morning
  echo "✅ 已注册：$LABEL_AM  每天 ${MORNING}（早间简报）"
  write_plist "$LABEL_PM" brief "$(calendar "$EVENING")" 0 scripts/daily-brief.mjs --evening
  echo "✅ 已注册：$LABEL_PM  每天 ${EVENING}（晚间收工三问）"
else
  echo "⏸ 早晚简报：已暂停（--no-brief）"
fi
if [ "$WITH_SYNC" = 1 ]; then
  write_plist "$LABEL_SYNC" sync "$(calendar "$SYNC_AT")" 0 scripts/sync-project-progress.mjs
  echo "✅ 已注册：$LABEL_SYNC  每天 ${SYNC_AT}（项目进度同步）"
else
  echo "⏸ 每晚项目同步：已暂停（--no-sync）"
fi
if [ "$WITH_BOT" = 1 ]; then
  write_plist "$LABEL_BOT" bot '' 1 scripts/bot-forever.mjs
  echo "✅ 已注册：$LABEL_BOT  登录即启动，异常退出自动拉起"
fi

echo
echo "日志目录：$LOGS"
echo '查看状态：bash scripts/install-launchd.sh --status'
echo "立即试跑：launchctl kickstart $DOMAIN/com.lifeos.meal-dinner"
echo '提醒：合盖或睡眠时大仙离线、简报会延后到唤醒后补推。'
