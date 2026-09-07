import test from 'node:test'
import assert from 'node:assert/strict'
import { validateProjects, loadProjects } from './project-sync-config.mjs'

test('Mac does not silently default to a Windows path', () => {
  assert.throws(() => loadProjects('/nonexistent-life-os-test', {}, 'darwin'), /尚未配置/)
})

test('Windows retains its existing source and configured paths override it', () => {
  assert.match(loadProjects('/nonexistent-life-os-test', {}, 'win32')[0].path, /^C:/)
  assert.equal(loadProjects('/nonexistent-life-os-test', { TRADE_PROJECT_PATH: '/repo/trade' }, 'darwin')[0].path, '/repo/trade')
})

test('duplicate projects cannot share a digest block', () => {
  const p = { key: 'work', name: '工作', path: '/repo', track: 'work' }
  assert.throws(() => validateProjects([p, { ...p, key: 'other' }]), /不能重复/)
  assert.throws(() => validateProjects([{ ...p, track: 'unknown' }]), /无效/)
})
