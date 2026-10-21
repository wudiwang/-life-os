// 泰语专题页：按场景看词汇 / 句式 / 对话。只显示中文与读音，逐词对照「读音 → 意思」，不显示泰文。
import { useState } from 'react'
import { COLORS } from '../../lib/constants'

const subtle = { color: COLORS.textLight, fontSize: 13, lineHeight: 1.7 }
const chip = { minHeight: 36, borderRadius: 18, padding: '6px 14px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }

export function ThaiTopicView({ topic, mobile }) {
  const [sceneKey, setSceneKey] = useState(topic.scenes[0].key)
  const [hideChinese, setHideChinese] = useState(false)
  const scene = topic.scenes.find(s => s.key === sceneKey) || topic.scenes[0]

  const pickScene = key => { setSceneKey(key); window.scrollTo(0, 0) }

  return <>
    <a href="#thai" style={{ ...subtle, display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'none' }}>‹ 返回目录</a>
    <header style={{ margin: '6px 0 14px' }}>
      <div style={subtle}>专题 · {topic.scenes.length} 个场景</div>
      <h1 style={{ fontSize: mobile ? 26 : 30, margin: '6px 0 8px' }}>{topic.icon} {topic.title}</h1>
      <p style={{ ...subtle, margin: 0 }}>{topic.note}</p>
    </header>

    <div style={{
      display: 'flex', gap: 8, overflowX: mobile ? 'auto' : 'visible', flexWrap: mobile ? 'nowrap' : 'wrap',
      WebkitOverflowScrolling: 'touch', padding: '8px 0', position: 'sticky', top: 0, background: COLORS.bg, zIndex: 1,
    }}>
      {topic.scenes.map(s => {
        const on = s.key === scene.key
        return <button key={s.key} type="button" aria-pressed={on} onClick={() => pickScene(s.key)} style={{
          ...chip, border: `1px solid ${on ? COLORS.primaryDark : COLORS.border}`,
          background: on ? COLORS.primaryDark : '#fff', color: on ? '#fff' : COLORS.text,
        }}>{s.icon} {s.title}</button>
      })}
    </div>

    <div style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: mobile ? '16px 16px' : '22px 28px', marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>{scene.icon} {scene.title}</h2>
        <button type="button" aria-pressed={hideChinese} onClick={() => setHideChinese(v => !v)} style={{ ...chip, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.text, fontSize: 12 }}>
          {hideChinese ? '显示中文' : '遮住中文'}
        </button>
      </div>
      <p style={{ ...subtle, margin: '10px 0 0', padding: '10px 12px', background: '#EFF6FF', borderRadius: 8, color: COLORS.primaryDark }}>💡 {scene.tip}</p>

      <Section title="词汇" hint={`${scene.words.length} 个`} />
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', columnGap: 24 }}>
        {scene.words.map(w => <Line key={w.id} item={w} hideChinese={hideChinese} compact />)}
      </div>

      <Section title="句式" hint="换掉 … 里的词就能用" />
      {scene.patterns.map(p => (
        <div key={p.id} style={{ padding: '14px 0', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 10px' }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{hideChinese ? '（中文已遮住）' : p.frame}</span>
            <span style={{ fontSize: 15, color: COLORS.primaryDark, fontWeight: 600 }}>{p.frameRoman}</span>
          </div>
          {!hideChinese && <div style={{ ...subtle, fontSize: 12 }}>{p.explain}</div>}
          <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: `3px solid #BFDBFE` }}>
            <Line item={p} hideChinese={hideChinese} bare />
          </div>
        </div>
      ))}

      <Section title="对话" hint="先看中文，再对着读音念" />
      {scene.dialogue.map(l => <Line key={l.id} item={l} hideChinese={hideChinese} role={l.role} />)}
    </div>
  </>
}

function Section({ title, hint }) {
  return <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '26px 0 2px' }}>
    <h3 style={{ fontSize: 15, margin: 0 }}>{title}</h3>
    <span style={{ ...subtle, fontSize: 12 }}>{hint}</span>
  </div>
}

function Line({ item, hideChinese, role, compact, bare }) {
  const isYou = role === '你'
  return <div style={{ padding: bare ? '2px 0' : compact ? '12px 0' : '14px 0', borderBottom: bare ? 'none' : `1px solid ${COLORS.border}` }}>
    {role && <div style={{ fontSize: 11, marginBottom: 4, color: isYou ? COLORS.primaryDark : COLORS.textLight, fontWeight: isYou ? 600 : 400 }}>{role}</div>}
    <div style={{ fontSize: compact ? 16 : 17, fontWeight: 600, lineHeight: 1.5, color: hideChinese ? COLORS.textLight : COLORS.text }}>
      {hideChinese ? '中文已遮住' : item.zh}
    </div>
    <div style={{ color: COLORS.primaryDark, fontSize: compact ? 15 : 16, lineHeight: 1.6, overflowWrap: 'anywhere' }}>{item.roman}</div>
    {!hideChinese && (item.parts.length > 1 || !item.zh.includes(item.parts[0].zh)) && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {item.parts.map((p, i) => (
          <span key={i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '3px 7px', borderRadius: 6, background: '#F3F4F6', lineHeight: 1.35 }}>
            <span style={{ fontSize: 13, color: COLORS.primaryDark }}>{p.roman}</span>
            <span style={{ fontSize: 11, color: COLORS.textLight }}>{p.zh}</span>
          </span>
        ))}
      </div>
    )}
  </div>
}
