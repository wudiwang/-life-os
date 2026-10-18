import test from 'node:test'
import assert from 'node:assert/strict'

let href = 'http://localhost/?page=dashboard#plan=old'
const listeners = new Set()
globalThis.window = {
  location: { get href() { return href }, get search() { return new URL(href).search } },
  history: { replaceState(_a, _b, next) { href = String(next) } },
  addEventListener(name, callback) { if (name === 'popstate') listeners.add(callback) },
  removeEventListener(name, callback) { if (name === 'popstate') listeners.delete(callback) },
}
const { useUIStore, bindPageHistory } = await import('../../store/useUIStore.js')
test('entering and leaving Thai synchronizes refresh URL and clears old lesson hashes', () => {
  useUIStore.getState().setPage('thai')
  assert.equal(new URL(href).searchParams.get('page'), 'thai')
  assert.equal(new URL(href).hash, '')
  href += '#thai-day=21'
  useUIStore.getState().setPage('dashboard')
  assert.equal(new URL(href).searchParams.get('page'), 'dashboard')
  assert.equal(new URL(href).hash, '')
})

test('clicking the active Thai menu preserves the lesson URL', () => {
  useUIStore.getState().setPage('thai')
  href += '#thai-day=2'
  useUIStore.getState().setPage('thai')
  assert.equal(new URL(href).hash, '#thai-day=2')
})

test('history navigation restores the matching page and cleans up its listener', () => {
  assert.equal(typeof bindPageHistory, 'function')
  const cleanup = bindPageHistory()
  useUIStore.getState().setPage('dashboard')
  href = 'http://localhost/?page=thai#thai-day=1'
  listeners.forEach(callback => callback())
  assert.equal(useUIStore.getState().currentPage, 'thai')
  assert.equal(new URL(href).hash, '#thai-day=1')
  cleanup()
  assert.equal(listeners.size, 0)
})

test('subsequent non-Thai page navigation does not leave a stale page query', () => {
  useUIStore.getState().setPage('work')
  useUIStore.getState().setPage('dashboard')
  assert.equal(new URL(href).searchParams.get('page'), 'dashboard')
})
