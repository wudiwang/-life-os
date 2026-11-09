import { useCallback, useEffect, useState } from 'react'
import { COLORS } from '../../lib/constants'
import { useTable } from '../../hooks/useTable'
import { TableMissing } from '../../components/common/TableMissing'
import { isWeak } from './thaiStudy'
import { LIFE_FILTERS, filterLife, groupLifeDays, lifeKey, lifeTime, lifeTokens } from './lifePhrases'
import { Chip, MasteryToggle, TokenLine, ui } from './ThaiParts'

// 生活泰语没有课程那样的录音文件，用设备自带的泰语语音朗读（iPhone / Mac 都有 Kanya）
function useThaiVoice() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voice, setVoice] = useState(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const pick = () => {
      const list = synth.getVoices()
      setLoaded(list.length > 0)
      setVoice(list.find(v => /^th/i.test(v.lang)) || null)
    }
    pick()
    synth.addEventListener?.('voiceschanged', pick)
    return () => { synth.removeEventListener?.('voiceschanged', pick); synth.cancel() }
  }, [supported])
  const speak = useCallback((text, rate = 0.9) => {
    if (!supported || !text) return
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'th-TH'
    u.rate = rate
    if (voice) u.voice = voice
    synth.speak(u)
  }, [supported, voice])
  return { supported, missingVoice: supported && loaded && !voice, speak }
}

function SpeakButton({ label, title, onClick }) {
  return <button type="button" aria-label={title} title={title} onClick={onClick}
    style={{ ...ui.button, padding: 0, width: 40, height: 40, minHeight: 40, color: COLORS.primaryDark, background: '#EFF6FF', borderColor: '#BFDBFE', fontSize: 18 }}>
    <span aria-hidden="true">{label}</span>
  </button>
}

function LifeRow({ row, wish, mastered, weak, canSave, onToggle, tts }) {
  const meta = [lifeTime(row.heard_at), row.scene, wish ? null : row.who].filter(Boolean).join(' · ')
  return <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${COLORS.border}` }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      {wish && row.said_zh && <div style={{ ...ui.subtle, fontSize: 12, marginBottom: 2 }}>你当时：{row.said_zh}</div>}
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.zh}</div>
      <TokenLine tokens={lifeTokens(row)} />
      {meta && <div style={{ ...ui.subtle, fontSize: 11, marginTop: 4 }}>{meta}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      {tts.supported && <div style={{ display: 'flex', gap: 6 }}>
        <SpeakButton label="🔊" title={`朗读：${row.zh}`} onClick={() => tts.speak(row.thai)} />
        <SpeakButton label="🐢" title={`慢速朗读：${row.zh}`} onClick={() => tts.speak(row.thai, 0.55)} />
      </div>}
      <MasteryToggle mastered={mastered} weak={weak} disabled={!canSave} onToggle={onToggle} />
    </div>
  </div>
}

// 「🎧 生活」：随身录音里整理出的泰语——别人真实对我说的话，和我当时想说没说出来的
export function ThaiLife({ mobile, mastered, rowsByKey, canSave, onToggle }) {
  const { rows, loading, missing } = useTable('thai_life_phrases', { orderBy: 'heard_on', ascending: false, optional: true })
  const [filter, setFilter] = useState('all')
  const tts = useThaiVoice()
  const days = groupLifeDays(filterLife(rows, filter, mastered))
  const done = rows.filter(r => mastered.has(lifeKey(r.roman))).length
  const dayCount = new Set(rows.map(r => r.heard_on)).size

  const row = (r, wish) => {
    const key = lifeKey(r.roman)
    return <LifeRow key={r.id} row={r} wish={wish} tts={tts} canSave={canSave}
      mastered={mastered.has(key)} weak={isWeak(rowsByKey.get(key))} onToggle={() => onToggle(key)} />
  }

  return <>
    <section style={{ ...ui.card, padding: mobile ? 16 : 22, marginBottom: 12 }}>
      <h2 style={ui.h2}>🎧 生活泰语</h2>
      <p style={{ ...ui.subtle, fontSize: 12, margin: '4px 0 12px' }}>
        从你的随身录音里挑出来的：别人真实对你说的话，和你当时想说没说出来的。TG 里还能听到当时的真人原声。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {[['收集', rows.length, '句'], ['已掌握', done, '句'], ['来自', dayCount, '天']].map(([label, value, unit]) =>
          <div key={label} style={{ background: COLORS.bg, borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{value}<span style={{ fontSize: 12, color: COLORS.textLight, fontWeight: 400 }}> {unit}</span></div>
            <div style={{ ...ui.subtle, fontSize: 11 }}>{label}</div>
          </div>)}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {LIFE_FILTERS.map(([key, label]) => <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>{label}</Chip>)}
      </div>
      {tts.missingVoice && <p style={{ ...ui.subtle, fontSize: 12, color: '#B45309', margin: '10px 0 0' }}>
        这台设备没有泰语朗读声音：iPhone 在 设置 → 辅助功能 → 朗读内容 → 声音 → 泰语 里下载 Kanya。
      </p>}
    </section>

    {missing && <TableMissing sql="v20_thai_life.sql" />}
    {loading && <p role="status" style={ui.subtle}>正在读取…</p>}

    {!loading && !missing && !rows.length && <section style={{ ...ui.card, padding: mobile ? 16 : 22 }}>
      <h2 style={ui.h2}>怎么开始</h2>
      <ol style={{ ...ui.subtle, paddingLeft: 20, margin: '8px 0 0' }}>
        <li>出门前在手表或手机上打开「语音备忘录」，点录音；回家再点停止。</li>
        <li>录音会同步到 Mac，自动转文字、挑出今天听到的泰语。</li>
        <li>整理好后 TG 收到清单和真人原声，这里也会出现，逐句标记掌握。</li>
      </ol>
    </section>}

    {!loading && rows.length > 0 && !days.length && <p style={ui.subtle}>这个筛选下没有句子。</p>}

    {days.map(d => <section key={d.day} style={{ ...ui.card, padding: mobile ? '6px 14px' : '8px 18px', marginBottom: 10 }}>
      <div style={{ ...ui.subtle, fontSize: 12, padding: '6px 0' }}>
        {d.day} · 听到 {d.heard.length} 句{d.wish.length ? ` · 想说 ${d.wish.length} 句` : ''}
      </div>
      {d.heard.map(r => row(r, false))}
      {d.wish.length > 0 && <>
        <div style={{ fontSize: 13, fontWeight: 600, padding: '10px 0 2px', color: COLORS.primaryDark }}>💬 当时想说的，泰语这么说</div>
        {d.wish.map(r => row(r, true))}
      </>}
    </section>)}
  </>
}
