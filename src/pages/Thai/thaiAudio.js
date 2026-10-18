// One player per lesson page. Never let events from a replaced audio update the new one.
export function createThaiAudioPlayer({ createAudio = src => new Audio(src), onChange }) {
  let active = null
  let generation = 0
  let disposed = false
  const emit = state => { if (!disposed) onChange(state) }
  function clear() {
    generation++
    if (!active) return
    clearTimeout(active.timer)
    for (const [name, fn] of Object.entries(active.events)) active.audio.removeEventListener(name, fn)
    active.audio.pause()
    active.audio.removeAttribute('src')
    active.audio.load()
    active = null
  }
  function stop() { clear(); emit({ status: 'idle', id: null }) }
  async function play(id) {
    if (disposed) return
    if (active?.id === id) { stop(); return }
    clear()
    if (!/^d(0[1-9]|[12]\d|30)-(w[1-3]|l[1-4])$/.test(id)) {
      emit({ status: 'error', id, message: '这条发音暂不可用。' }); return
    }
    const token = generation
    const current = () => !disposed && generation === token
    const fail = () => {
      if (!current()) return
      clear()
      emit({ status: 'error', id, message: '声音未能播放，请再点一次小喇叭；也可检查网络和设备音量。' })
    }
    try {
      const audio = createAudio(`/audio/thai/${id}.mp3`)
      const events = {
        playing: () => { if (current()) { clearTimeout(active.timer); emit({ status: 'playing', id }) } },
        ended: () => { if (current()) stop() },
        error: fail,
      }
      active = { id, audio, events, timer: setTimeout(fail, 15000) }
      for (const [name, fn] of Object.entries(events)) audio.addEventListener(name, fn)
      emit({ status: 'loading', id })
      await audio.play()
      if (current()) { clearTimeout(active.timer); emit({ status: 'playing', id }) }
    } catch { fail() }
  }
  return { play, stop, dispose() { clear(); disposed = true } }
}
