# 人生 OS 从 Windows 迁到 Mac

> 2026-11-06 整理。给 Mac 上的 Claude Code 照着执行：每一步做完验证再往下。
> 原则：先在 Mac 上跑通，再停掉 Windows 上的；同一时间只能有一台电脑跑大仙。

## 一、Windows 上哪些东西不在 git 里（要手动带过去）

用 U 盘或加密网盘拷，**不要发在聊天里**：

| 文件 | 位置 | 说明 |
|---|---|---|
| `.env` | life-os 项目根目录 | Supabase、TG 机器人、SUPABASE_ACCESS_TOKEN 等全部密钥 |
| `sync-projects.local.json` | life-os 根目录（如果有） | 每晚同步要汇总的项目及路径，路径要改成 Mac 的 |
| `.personal-memory/` | life-os 根目录（如果有） | 本机个人记忆，gitignore 了 |
| `lh-pm.env` | `C:\Users\ADMIN\.secrets\` | 领航项目的密钥 |
| lh-pm-workbench、trade 项目里各自 gitignore 的 `.env` / 本地数据 | 各自根目录 | 逐个检查 `.gitignore` |

`scripts/.tg-session.json`、`scripts/.bot.lock`、`scripts/.tg-photos/` 不用带。

## 二、Mac 上准备

1. 装 Homebrew，再装 `node`（22 以上）、`python@3.12`、`git`、`gh`。
2. 装 Claude Code 并用订阅账号登录：本机大脑（大仙、每晚同步）靠它干活。
3. `gh auth login` 登录 GitHub（或配 SSH key），把三个仓库克隆到 `~/Projects/`：
   - `wudiwang/-life-os` → `~/Projects/life-os`
   - `wudiwang/lh-pm-workbench` → `~/Projects/lh-pm-workbench`（本机大脑路由 `scripts/local_brain.py` 在这里）
   - `wudiwang/trade` → `~/Projects/trade`（每晚同步和交易形态库要读它）
4. 把第一节的文件放回对应位置；life-os 里 `npm install`，再 `sh scripts/install-git-hooks.sh`。

## 三、代码里要改成跨平台的地方

| 位置 | Windows 写死的内容 | Mac 上怎么改 |
|---|---|---|
| `scripts/local-brain.mjs` | Python 路径用 `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`；大脑脚本默认 `C:\Users\ADMIN\Projects\lh-pm-workbench\scripts\local_brain.py` | 非 Windows 默认用 `python3` 和 `~/Projects/lh-pm-workbench/scripts/local_brain.py`；`PYTHON_CMD` / `LOCAL_BRAIN_SCRIPT` 目前只读进程环境变量，也让它能从 `.env` 读 |
| `scripts/sync-trade-patterns.mjs` | `archiveRoot = 'C:\\Users\\ADMIN\\trade\\research\\ideas'` | 改为读 `TRADE_PROJECT_PATH` 或 `sync-projects.local.json` 里 trade 的路径 |
| `scripts/project-sync-config.mjs` | 非 Windows 必须有 `sync-projects.local.json` 或 `TRADE_PROJECT_PATH` | 在 `sync-projects.local.json` 里写 Mac 路径即可，代码不用改 |
| `scripts/install-daily-sync.ps1`、`install-daily-brief.ps1` | Windows 计划任务（PowerShell） | 新写一个 macOS 的 launchd 安装脚本（`~/Library/LaunchAgents`）：大仙开机自启并崩溃自动拉起；早 8:30、晚 21:30 简报；每晚 22:07 项目同步。带卸载参数 |
| `scripts/bot-forever.mjs` | 提示文案里写的是 `taskkill` | 按平台提示 `kill <pid>` |
| `scripts/sync-push.ps1` | PowerShell 一键推送 | Mac 上有 post-commit 钩子自动推送，可不迁 |
| lh-pm-workbench 的 `scripts/local_brain.py` | 可能有 Windows 路径或调用方式 | 在那个仓库里检查，确认 Mac 上能调起 Claude Code |

改完跑：`npm run build && npx eslint src api`、`npm run test:shape`、`npm run test:thai`、`node --test scripts/*.test.mjs`。

## 四、切换（避免两台同时跑）

1. Mac 上先手动 `npm run bot`，在 TG 发一句话确认大仙能回复；再试 `npm run brief -- --morning --dry`、`npm run sync -- --dry`。
2. 都正常后，**回 Windows 停掉**：结束大仙进程；运行 `scripts\install-daily-sync.ps1 -Uninstall` 和 `scripts\install-daily-brief.ps1 -Uninstall`。
3. Mac 上安装 launchd 定时任务，在 TG 给大仙发 `/new`。
4. 让 Mac 别睡着：系统设置 → 电池（或节能）→ 接电源时「显示器关闭时防止自动睡眠」。MacBook 合盖会睡眠，大仙就离线、简报也会漏推。

## 五、迁完之后的好处

- Mac 支持 Remote Control：手机上开云端会话时，可以连上 Mac 的 life-os 文件夹，直接用本机的 `.env` 读写数据库。
- 本地 Claude Code 有 `.env`，能直接跑 SQL、查数据库、存档体检。
