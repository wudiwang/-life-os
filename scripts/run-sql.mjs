// 执行 supabase/*.sql 迁移文件——不用再手动去 SQL Editor 粘贴。
//
// 一次性准备：
//   1. 用**拥有 life-os 项目的那个 Supabase 账号**登录 https://supabase.com/dashboard/account/tokens
//   2. Generate new token（名字随便，如 life-os-cli），复制出来的 sbp_ 开头那串
//   3. 追加到本项目 .env（已被 gitignore，不会进仓库）：
//        SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx
//
// 用法：
//   node scripts/run-sql.mjs supabase/v7_threads_insights.sql
//   node scripts/run-sql.mjs --check              只验证 token 和项目连通性
//   node scripts/run-sql.mjs --sql "select 1"     直接跑一段 SQL
//
// 走 Supabase Management API 的 database/query 端点，等价于在 SQL Editor 里点 Run。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const TOKEN = env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) {
  console.error('✗ .env 里没有 SUPABASE_ACCESS_TOKEN。')
  console.error('  去 https://supabase.com/dashboard/account/tokens 生成一个（注意用拥有 life-os 项目的那个账号登录），')
  console.error('  然后把 SUPABASE_ACCESS_TOKEN=sbp_xxx 追加到 .env。')
  process.exit(1)
}
if (!TOKEN.startsWith('sbp_')) {
  console.error('✗ SUPABASE_ACCESS_TOKEN 看起来不对：个人访问令牌应以 sbp_ 开头。')
  console.error('  别把 anon key / service_role key 填这里，它们不能用于 Management API。')
  process.exit(1)
}

// 项目 ref 就是 Supabase URL 的子域
const REF = (env.VITE_SUPABASE_URL || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
if (!REF) {
  console.error(`✗ 从 VITE_SUPABASE_URL 解析不出项目 ref：${env.VITE_SUPABASE_URL}`)
  process.exit(1)
}

const api = (path, init = {}) => fetch(`https://api.supabase.com/v1${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

async function query(sql) {
  const resp = await api(`/projects/${REF}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  })
  const text = await resp.text()
  if (!resp.ok) {
    let msg = text
    try { msg = JSON.parse(text).message || text } catch { /* 原样输出 */ }
    throw new Error(`HTTP ${resp.status} — ${String(msg).slice(0, 500)}`)
  }
  return text ? JSON.parse(text) : null
}

const argv = process.argv.slice(2)

// --check：先确认 token 能看到这个项目，再确认能查库
if (argv[0] === '--check') {
  const resp = await api('/projects')
  if (!resp.ok) {
    console.error(`✗ token 无效或无权限：HTTP ${resp.status}`)
    process.exit(1)
  }
  const projects = await resp.json()
  const hit = projects.find(p => p.id === REF)
  console.log(`token 可见 ${projects.length} 个项目`)
  if (!hit) {
    console.error(`✗ 其中没有 ${REF}（life-os）。这个 token 属于别的 Supabase 账号，换拥有该项目的账号重新生成。`)
    console.error(`  可见的是：${projects.map(p => `${p.name}(${p.id})`).join(', ')}`)
    process.exit(1)
  }
  console.log(`✓ 命中项目：${hit.name} (${hit.id})  region=${hit.region}  status=${hit.status}`)
  console.log('✓ 试查：', JSON.stringify(await query('select current_database() as db, version() as v')).slice(0, 160))
  process.exit(0)
}

const sql = argv[0] === '--sql'
  ? argv[1]
  : (() => {
    const f = argv[0]
    if (!f) {
      console.error('用法：node scripts/run-sql.mjs <文件.sql> | --sql "<语句>" | --check')
      process.exit(1)
    }
    return readFileSync(isAbsolute(f) ? f : join(root, f), 'utf8')
  })()

const label = argv[0] === '--sql' ? '(内联 SQL)' : argv[0]
console.log(`▶ 执行 ${label}（${sql.length} 字符）→ 项目 ${REF}`)
try {
  const out = await query(sql)
  console.log('✓ 执行成功')
  if (Array.isArray(out) && out.length) console.log(JSON.stringify(out, null, 2).slice(0, 2000))
} catch (e) {
  console.error(`✗ 执行失败：${e.message}`)
  process.exit(1)
}
