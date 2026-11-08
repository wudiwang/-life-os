// 把吃饭提醒（.github/workflows/meal-reminder.yml）需要的 4 个配置，从本机 .env 存进 GitHub 仓库的加密密钥。
// 用法（在项目目录）：node scripts/set-github-secrets.mjs
// 需要本机已装好并登录 gh（GitHub 命令行）。密钥内容只通过管道交给 gh，不会打印到屏幕。
import { readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'

const NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'TELEGRAM_BOT_TOKEN', 'TG_ALLOWED_CHAT_ID']

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map(l => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2].trim()]),
)

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
const repo = remote.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '')
console.log(`仓库：${repo}`)

let failed = 0
for (const name of NAMES) {
  if (!env[name]) { console.log(`✗ .env 里没有 ${name}`); failed++; continue }
  const r = spawnSync('gh', ['secret', 'set', name, '-R', repo], { input: env[name], encoding: 'utf8' })
  if (r.status === 0) console.log(`✓ 已存 ${name}`)
  else { console.log(`✗ ${name} 失败：${(r.stderr || '').trim().slice(0, 160)}`); failed++ }
}
console.log(failed ? `\n有 ${failed} 项没存上，把上面的报错发给 Claude。` : '\n全部存好了，回去告诉 Claude「好了」。')
