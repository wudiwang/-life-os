import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const url = new URL('./thaiAudio.js', import.meta.url)
test('Thai audio controller exists', () => assert.ok(existsSync(url), 'Thai audio controller not implemented'))
if (existsSync(url)) {
  const { createThaiAudioPlayer } = await import(url)
  function setup() {
    const audios = [], states = []
    let rejectPlay = false
    const player = createThaiAudioPlayer({
      createAudio: src => {
        const a = { src, paused: false, listeners: {}, play: () => rejectPlay ? Promise.reject(new Error('blocked')) : Promise.resolve(), pause() { this.paused = true }, addEventListener(n, f) { this.listeners[n] = f }, removeEventListener(n) { delete this.listeners[n] }, removeAttribute() {}, load() {}, emit(n) { this.listeners[n]?.() } }
        audios.push(a); return a
      },
      onChange: state => states.push(state),
    })
    return { player, audios, states, reject: () => { rejectPlay = true } }
  }
  test('only one audio plays and stale events cannot change new item', async () => {
    const { player, audios, states } = setup()
    await player.play('d01-w1')
    const stale = audios[0].listeners.ended
    await player.play('d01-l1')
    assert.equal(audios[0].paused, true)
    assert.equal(audios[1].src, '/audio/thai/d01-l1.mp3')
    stale()
    assert.equal(states.at(-1).id, 'd01-l1')
    audios[1].emit('ended')
    assert.equal(states.at(-1).status, 'idle')
    player.dispose()
  })
  test('same button toggles stop, rejection shows retryable error', async () => {
    const { player, audios, states, reject } = setup()
    await player.play('d21-l2'); await player.play('d21-l2')
    assert.equal(audios.length, 1)
    assert.equal(states.at(-1).status, 'idle')
    reject(); await player.play('d21-l2')
    assert.equal(states.at(-1).status, 'error')
    assert.ok(states.at(-1).message)
    player.dispose()
  })
  test('dispose stops media and prevents later notifications', async () => {
    const { player, audios, states } = setup()
    await player.play('d30-l4')
    const stale = audios[0].listeners.error
    player.dispose()
    const count = states.length
    stale(); await player.play('d01-l1')
    assert.equal(states.length, count)
    assert.equal(audios[0].paused, true)
  })
  test('invalid audio ids never reach the resource loader', async () => {
    const { player, audios } = setup()
    await player.play('../private')
    assert.equal(audios.length, 0)
    player.dispose()
  })
}
