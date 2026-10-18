import test from 'node:test'
import assert from 'node:assert/strict'
import { buildQuickKeyboard } from './tg-keyboard.mjs'

test('keeps the four existing Web App entries and persistent keyboard options', () => {
  const keyboard = buildQuickKeyboard('https://life-os.example')

  assert.deepEqual(keyboard.keyboard.slice(0, 2), [
    [
      { text: '🏠 看板', web_app: { url: 'https://life-os.example/?page=dashboard' } },
      { text: '📔 随笔', web_app: { url: 'https://life-os.example/?page=journal' } },
    ],
    [
      { text: '❤️ 健康', web_app: { url: 'https://life-os.example/?page=health' } },
      { text: '🧠 第二大脑', web_app: { url: 'https://life-os.example/?page=knowledge' } },
    ],
  ])
  assert.equal(keyboard.resize_keyboard, true)
  assert.equal(keyboard.is_persistent, true)
})

test('opens Thai learning alongside the unchanged text check-in action', () => {
  const keyboard = buildQuickKeyboard('https://life-os.example/')

  assert.equal(keyboard.keyboard.length, 3)
  assert.deepEqual(keyboard.keyboard.at(-1), [
    { text: '🇹🇭 泰语学习', web_app: { url: 'https://life-os.example/?page=thai' } },
    { text: '打卡' },
  ])
})

test('supports a deployment subpath and removes duplicate trailing slashes', () => {
  const keyboard = buildQuickKeyboard('https://life-os.example/life///')

  assert.equal(keyboard.keyboard.at(-1)[0].web_app.url, 'https://life-os.example/life/?page=thai')
})

test('replaces a stale page query and hash while preserving other query parameters', () => {
  const keyboard = buildQuickKeyboard('https://life-os.example/?source=tg&page=journal#old')
  const thaiURL = new URL(keyboard.keyboard.at(-1)[0].web_app.url)

  assert.equal(thaiURL.searchParams.get('source'), 'tg')
  assert.deepEqual(thaiURL.searchParams.getAll('page'), ['thai'])
  assert.equal(thaiURL.hash, '')
})

test('rejects invalid or non-HTTPS Web App URLs', () => {
  for (const webURL of ['', undefined, 'not a url', '/relative', 'http://life-os.example', 'javascript:alert(1)']) {
    assert.throws(() => buildQuickKeyboard(webURL), /HTTPS/, String(webURL))
  }
})
