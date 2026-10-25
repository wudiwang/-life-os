import { useRef, useState } from 'react'
import { COLORS } from '../../lib/constants'
import { checkAnswer } from './thaiStudy'
import { AudioButton, ProgressBar, ProgressRing, TokenLine, ui } from './ThaiParts'

const TYPE_LABEL = { zh2roman: '看中文选读音', roman2zh: '看读音选意思', listen: '听音选意思', build: '拼句子', cloze: '补全句子' }

// 一组题从头做到尾。做完调用 onFinish(results)，由页面负责保存；这里只管答题体验。
export function ThaiQuiz({ title, questions, player, audio, onFinish, onMarkMastered, masteredKeys, onRetry, onExit }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [built, setBuilt] = useState([])
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState([])
  const [saveState, setSaveState] = useState({ status: 'idle' })
  const [marked, setMarked] = useState(false)
  const finished = useRef(false)

  const q = questions[index]
  const done = index >= questions.length

  function submit(answer) {
    if (checked) return
    const correct = checkAnswer(q, answer)
    setChecked(true)
    setResults(old => [...old, { key: q.itemKey, correct, question: q }])
  }

  async function next() {
    player.current?.stop()
    setPicked(null); setBuilt([]); setChecked(false)
    const nextIndex = index + 1
    setIndex(nextIndex)
    if (nextIndex >= questions.length && !finished.current) {
      finished.current = true
      setSaveState({ status: 'saving' })
      try {
        const summary = await onFinish(results.map(({ key, correct }) => ({ key, correct })))
        setSaveState({ status: 'saved', ...summary })
      } catch {
        setSaveState({ status: 'error' })
      }
    }
  }

  if (!questions.length) return <p style={ui.subtle}>这一组没有可出的题。</p>

  if (done) {
    const right = results.filter(r => r.correct)
    const wrong = results.filter(r => !r.correct)
    const pct = Math.round(right.length / results.length * 100)
    const markable = [...new Set(right.map(r => r.key))].filter(k => !masteredKeys.has(k))
    return <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
        <ProgressRing pct={pct} size={92} color={pct === 100 ? COLORS.green : pct >= 60 ? COLORS.primary : COLORS.orange}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{right.length}<span style={{ fontSize: 14, color: COLORS.textLight }}>/{results.length}</span></span>
        </ProgressRing>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{pct === 100 ? '全对！🎉' : pct >= 60 ? '不错，再巩固一下错的' : '多听几遍，再来一次'}</div>
          <div role="status" style={{ ...ui.subtle, marginTop: 4 }}>
            {saveState.status === 'saving' && '正在保存成绩…'}
            {saveState.status === 'saved' && (saveState.unmarked?.length ? `答错的 ${saveState.unmarked.length} 项已移回「待掌握」。` : '成绩已记下。')}
            {saveState.status === 'error' && <span style={{ color: '#B45309' }}>成绩没保存上（网络或数据表问题），刷新后再试。</span>}
          </div>
        </div>
      </div>
      {markable.length > 0 && !marked && <button style={{ ...ui.primary, width: '100%', marginBottom: 12, background: COLORS.green, borderColor: COLORS.green }}
        onClick={async () => { setMarked(true); await onMarkMastered(markable) }}>
        ✓ 把答对的 {markable.length} 项标记为已掌握
      </button>}
      {marked && <p role="status" style={{ ...ui.subtle, color: '#047857' }}>已标记掌握。</p>}
      {wrong.length > 0 && <>
        <h3 style={{ fontSize: 15, margin: '8px 0 4px' }}>错题再看一眼</h3>
        {wrong.map(({ question }, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{question.item.icon ? `${question.item.icon} ` : ''}{question.item.zh}</div>
            <TokenLine tokens={question.item.tokens} />
          </div>
          <AudioButton id={question.audioId} audio={audio} player={player} />
        </div>)}
      </>}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button style={ui.button} onClick={onRetry}>↻ 换一组再做</button>
        {onExit && <button style={ui.button} onClick={onExit}>返回</button>}
      </div>
    </div>
  }

  const last = results[results.length - 1]
  const correct = checked && last?.correct
  const item = q.item

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
      <span style={{ ...ui.subtle, fontSize: 12 }}>{title} · {TYPE_LABEL[q.type]}</span>
      <span style={{ ...ui.subtle, fontSize: 12 }}>{index + 1} / {questions.length}</span>
    </div>
    <ProgressBar pct={(index / questions.length) * 100} color={COLORS.primary} height={6} />

    <div style={{ margin: '18px 0 14px' }}>
      {q.type === 'zh2roman' && <Prompt big={`${item.icon || ''} ${item.zh}`} ask="怎么读？" />}
      {q.type === 'roman2zh' && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 26, fontWeight: 700, color: '#1D4ED8' }}>{item.roman}</div><div style={ui.subtle}>是什么意思？</div></div>
        <AudioButton id={q.audioId} audio={audio} player={player} />
      </div>}
      {q.type === 'listen' && <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <AudioButton id={q.audioId} audio={audio} player={player} size={64} label="听一听" />
        <div><div style={{ fontSize: 17, fontWeight: 600 }}>点喇叭听，选出意思</div><div style={ui.subtle}>可以多听几遍</div></div>
      </div>}
      {q.type === 'build' && <Prompt big={item.zh} ask="按顺序点读音，拼出这句话" />}
      {q.type === 'cloze' && <div>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>{item.zh}</div>
        <TokenLine tokens={item.tokens} blank={q.blank} hideZh />
        <div style={{ ...ui.subtle, marginTop: 6 }}>空格里该填哪个读音？</div>
      </div>}
    </div>

    {q.options && <div style={{ display: 'grid', gap: 8 }}>
      {q.options.map(o => {
        const state = !checked ? (picked === o.label ? 'picked' : '') : o.correct ? 'right' : picked === o.label ? 'wrong' : ''
        const tone = { right: { background: '#D1FAE5', borderColor: '#34D399' }, wrong: { background: '#FEE2E2', borderColor: '#F87171' }, picked: { borderColor: COLORS.primary } }[state] || {}
        const roman = q.type === 'zh2roman' || q.type === 'cloze'
        return <button key={o.label} disabled={checked} onClick={() => { setPicked(o.label); submit(o.label) }}
          style={{ ...ui.button, textAlign: 'left', fontSize: roman ? 18 : 15, fontWeight: roman ? 600 : 400, color: roman ? '#1D4ED8' : COLORS.text, ...tone, opacity: 1 }}>
          {state === 'right' ? '✓ ' : state === 'wrong' ? '✗ ' : ''}{o.label}
        </button>
      })}
    </div>}

    {q.type === 'build' && <BuildArea q={q} built={built} setBuilt={setBuilt} checked={checked} onCheck={() => submit(built.map(i => q.chips[i].roman))} />}

    {checked && <div role="status" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: correct ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${correct ? '#A7F3D0' : '#FECACA'}` }}>
      <div style={{ fontWeight: 700, color: correct ? '#047857' : '#B91C1C', marginBottom: 8 }}>{correct ? '✓ 答对了' : '✗ 正确答案是'}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{item.zh}</div>
          <TokenLine tokens={item.tokens} />
        </div>
        <AudioButton id={q.audioId} audio={audio} player={player} />
      </div>
    </div>}
    {checked && <button style={{ ...ui.primary, width: '100%', marginTop: 12 }} onClick={next}>
      {index + 1 < questions.length ? '下一题 →' : '看成绩'}
    </button>}
  </div>
}

function Prompt({ big, ask }) {
  return <div>
    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.5 }}>{big}</div>
    <div style={ui.subtle}>{ask}</div>
  </div>
}

function BuildArea({ q, built, setBuilt, checked, onCheck }) {
  const used = new Set(built)
  return <div>
    <div style={{ minHeight: 56, padding: 8, borderRadius: 12, border: `1px dashed ${COLORS.primary}`, background: '#F8FAFF', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {!built.length && <span style={{ ...ui.subtle, fontSize: 12 }}>点下面的读音放到这里</span>}
      {built.map((ci, pos) => <button key={pos} disabled={checked} onClick={() => setBuilt(b => b.filter((_, i) => i !== pos))}
        style={{ ...ui.button, minHeight: 38, padding: '6px 10px', fontSize: 16, fontWeight: 600, color: '#1D4ED8', background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        {q.chips[ci].roman}
      </button>)}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {q.chips.map((chip, ci) => <button key={ci} disabled={checked || used.has(ci)} onClick={() => setBuilt(b => [...b, ci])}
        style={{ ...ui.button, minHeight: 40, padding: '6px 12px', fontSize: 16, fontWeight: 600, color: '#1D4ED8', opacity: used.has(ci) ? 0.25 : 1 }}>
        {chip.roman}
      </button>)}
    </div>
    {!checked && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button style={ui.button} disabled={!built.length} onClick={() => setBuilt([])}>清空</button>
      <button style={{ ...ui.primary, flex: 1, opacity: built.length === q.chips.length ? 1 : 0.5 }} disabled={built.length !== q.chips.length} onClick={onCheck}>检查</button>
    </div>}
  </div>
}
