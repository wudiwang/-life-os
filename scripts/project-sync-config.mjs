import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function validateProjects(projects) {
  if (!Array.isArray(projects) || !projects.length) throw new Error('项目配置不能为空')
  const keys = new Set()
  const names = new Set()
  for (const project of projects) {
    if (!project || !/^[a-z0-9_-]+$/.test(project.key || '') || !project.name?.trim()
      || /[\r\n]/.test(project.name) || !project.path?.trim()
      || !['work', 'trade', 'life'].includes(project.track)) throw new Error('项目配置无效')
    if (keys.has(project.key) || names.has(project.name)) throw new Error('项目标识和名称不能重复')
    keys.add(project.key)
    names.add(project.name)
  }
  return projects
}

export function loadProjects(root, env = process.env, platform = process.platform) {
  const config = env.LIFE_OS_PROJECTS_FILE || join(root, 'sync-projects.local.json')
  if (existsSync(config)) return validateProjects(JSON.parse(readFileSync(config, 'utf8')))
  if (platform !== 'win32' && !env.TRADE_PROJECT_PATH) {
    throw new Error('本机尚未配置项目来源：请设置 sync-projects.local.json 或 TRADE_PROJECT_PATH')
  }
  return validateProjects([{
    key: 'trade', name: '交易系统', track: 'trade', threadMatch: '交易',
    path: env.TRADE_PROJECT_PATH || 'C:\\Users\\ADMIN\\trade',
  }])
}
