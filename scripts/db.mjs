// Supabase 数据库命令行助手（供 TG 机器人的 Claude 代理调用）
// 用法：
//   node scripts/db.mjs list <table> [postgrest查询串]     例: node scripts/db.mjs list habits "&order=created_at.desc&limit=10"
//   node scripts/db.mjs insert <table> '<json>'
//   node scripts/db.mjs update <table> <id> '<json>'
//   node scripts/db.mjs remove <table> <id>
// 输出：JSON（stdout）。表清单见项目 CLAUDE.md / supabase/v1_init.sql。

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// 本机读 .env；云端会话没有 .env 时读环境变量（在云端环境设置里配 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）
const env = { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY }
const envFile = join(root, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
}
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || /[^\x21-\x7e]/.test(env.VITE_SUPABASE_ANON_KEY)) {
  console.error('缺少有效的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（.env 或环境变量；密钥里不能有中文、空格或备注）')
  process.exit(1)
}
const BASE = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const [cmd, table, a3, a4] = process.argv.slice(2)

async function run() {
  let resp
  switch (cmd) {
    case 'list':
      resp = await fetch(`${BASE}/rest/v1/${table}?select=*${a3 || ''}`, { headers })
      break
    case 'insert':
      resp = await fetch(`${BASE}/rest/v1/${table}`, { method: 'POST', headers, body: a3 })
      break
    case 'update':
      resp = await fetch(`${BASE}/rest/v1/${table}?id=eq.${a3}`, { method: 'PATCH', headers, body: a4 })
      break
    case 'remove':
      resp = await fetch(`${BASE}/rest/v1/${table}?id=eq.${a3}`, { method: 'DELETE', headers })
      break
    default:
      console.error('用法: db.mjs list|insert|update|remove <table> [args]')
      process.exit(1)
  }
  const text = await resp.text()
  if (!resp.ok) {
    console.error(`HTTP ${resp.status}: ${text}`)
    process.exit(1)
  }
  console.log(text || '{"ok":true}')
}

run()
