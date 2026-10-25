import { useMemo, useState } from 'react'
import { COLORS } from '../../lib/constants'
import { fmtDateTime } from '../../lib/date'
import { ALL_KEYS, LINE_KEYS, SENTENCE_VOCAB, STUDY_DAYS, WORD_BANK, WORD_KEYS, createRng, dayMastery, isWeak, keysForDays, newWordsOn, reviewQuestions } from './thaiStudy'
import { AudioButton, Chip, MasteryToggle, ProgressBar, ProgressRing, TokenLine, ui } from './ThaiParts'
import { ThaiQuiz } from './ThaiQuiz'
import { THAI_TOPICS } from './thaiTopics'

const GROUPS = ['先能开口', '吃饭喝东西', '日常购物', '出门办事', '天气与求助', '扩展表达']
const TABS = [['course', '📚 课程'], ['words', '🔤 单词本'], ['review', '🧠 复习']]

export function ThaiHome(props) {
  const { tab, mobile, mastered, practicedDays, resumeDay, statusSlot } = props
  const count = keys => keys.filter(k => mastered.has(k)).length
  const pct = Math.round(count(ALL_KEYS) / ALL_KEYS.length * 100)

  return <>
    <header style={{ ...ui.card, padding: mobile ? 16 : 22, display: 'flex', gap: mobile ? 14 : 22, alignItems: 'center', flexWrap: 'wrap' }}>
      <ProgressRing pct={pct} size={mobile ? 96 : 112} stroke={mobile ? 10 : 12}>
        <span style={{ fontSize: mobile ? 22 : 26, fontWeight: 800 }}>{pct}%</span>
        <span style={{ ...ui.subtle, fontSize: 11 }}>总掌握</span>
      </ProgressRing>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ ...ui.subtle, fontSize: 12 }}>泰语口语 30 天 · 只看读音和中文</div>
        <h1 style={{ fontSize: mobile ? 22 : 26, margin: '2px 0 10px' }}>泰语，开口就好</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          <Stat label="掌握单词" value={count(WORD_KEYS)} total={WORD_KEYS.length} />
          <Stat label="掌握句子" value={count(LINE_KEYS)} total={LINE_KEYS.length} />
          <Stat label="做过作业" value={practicedDays.size} total={30} unit="天" />
        </div>
        <a href={`#thai-day=${resumeDay}`} style={{ ...ui.primary, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          {practicedDays.size ? '继续学习' : '开始学习'} · 第 {resumeDay} 天 →
        </a>
      </div>
    </header>
    {statusSlot}
    <nav role="tablist" style={{ display: 'flex', gap: 6, margin: '16px 0 12px' }}>
      {TABS.map(([key, label]) => <a key={key} role="tab" aria-selected={tab === key} href={key === 'course' ? '#thai' : `#thai-tab=${key}`}
        style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          background: tab === key ? COLORS.primaryDark : '#fff', color: tab === key ? '#fff' : COLORS.text, border: `1px solid ${tab === key ? COLORS.primaryDark : COLORS.border}` }}>
        {label}
      </a>)}
    </nav>
    {tab === 'course' && <CourseTab {...props} />}
    {tab === 'words' && <WordsTab {...props} />}
    {tab === 'review' && <ReviewTab {...props} />}
  </>
}

function Stat({ label, value, total, unit = '' }) {
  return <div style={{ background: COLORS.bg, borderRadius: 10, padding: '8px 10px' }}>
    <div style={{ fontSize: 18, fontWeight: 800 }}>{value}<span style={{ fontSize: 12, color: COLORS.textLight, fontWeight: 400 }}>/{total}{unit}</span></div>
    <div style={{ ...ui.subtle, fontSize: 11 }}>{label}</div>
  </div>
}

// 掌握度越高格子越绿；右上角的点表示作业做过。
function cellColor(pct) {
  if (!pct) return '#fff'
  if (pct < 50) return '#D1FAE5'
  if (pct < 100) return '#6EE7B7'
  return '#10B981'
}

function CourseTab({ mobile, mastered, practicedDays, resumeDay }) {
  return <>
    <section style={{ ...ui.card, padding: mobile ? 14 : 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h2 style={ui.h2}>30 天掌握地图</h2>
        <span style={{ ...ui.subtle, fontSize: 11 }}>颜色＝掌握度 · 蓝点＝作业已做</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {STUDY_DAYS.map(d => {
          const m = dayMastery(d.day, mastered)
          const current = d.day === resumeDay
          return <a key={d.day} href={`#thai-day=${d.day}`} title={`第${d.day}天 ${d.title} · ${m.pct}%`}
            style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: cellColor(m.pct), border: `${current ? 2 : 1}px solid ${current ? COLORS.primaryDark : COLORS.border}`, color: m.pct === 100 ? '#fff' : COLORS.text }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{d.day}</span>
            <span style={{ fontSize: 10, opacity: 0.85 }}>{m.pct ? `${m.pct}%` : d.scene.emoji[0]}</span>
            {practicedDays.has(d.day) && <span aria-label="做过作业" style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 7, background: COLORS.primaryDark }} />}
          </a>
        })}
      </div>
    </section>
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 13, color: COLORS.textLight, fontWeight: 500, margin: '0 0 8px' }}>专题 · 按场景速查</h2>
      <div style={{ ...ui.card, overflow: 'hidden' }}>
        {THAI_TOPICS.map((item, i) => <a key={item.key} href={`#thai-topic=${item.key}`} style={{ padding: mobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: 12, color: COLORS.text, textDecoration: 'none', borderBottom: i < THAI_TOPICS.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
          <span aria-hidden="true" style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{item.icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15 }}>{item.title}</span>
            <span style={{ ...ui.subtle, fontSize: 12 }}>{item.summary}</span>
          </span>
          <span aria-hidden="true" style={{ color: COLORS.textLight }}>›</span>
        </a>)}
      </div>
    </section>
    {GROUPS.map((title, gi) => <section key={title} style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 13, color: COLORS.textLight, fontWeight: 500, margin: '0 0 8px' }}>{title} · 第 {gi * 5 + 1}～{gi * 5 + 5} 天</h2>
      <div style={{ ...ui.card, overflow: 'hidden' }}>
        {STUDY_DAYS.slice(gi * 5, gi * 5 + 5).map(d => {
          const m = dayMastery(d.day, mastered)
          const fresh = newWordsOn(d.day).length
          return <a key={d.day} href={`#thai-day=${d.day}`} style={{ padding: mobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: 12, color: COLORS.text, textDecoration: 'none', borderBottom: d.day % 5 ? `1px solid ${COLORS.border}` : 'none' }}>
            <span aria-hidden="true" style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{d.scene.emoji[0]}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, display: 'block' }}><span style={{ color: COLORS.textLight, fontSize: 12, marginRight: 6 }}>{String(d.day).padStart(2, '0')}</span>{d.title}</span>
              <span style={{ ...ui.subtle, fontSize: 11 }}>{fresh ? `新词 ${fresh} 个` : '回看复习'} · {practicedDays.has(d.day) ? '作业已做' : '作业未做'}</span>
              <span style={{ display: 'block', marginTop: 5 }}><ProgressBar pct={m.pct} height={5} /></span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: m.pct === 100 ? '#047857' : COLORS.textLight, minWidth: 36, textAlign: 'right' }}>{m.pct}%</span>
          </a>
        })}
      </div>
    </section>)}
  </>
}

const WORD_FILTERS = [['all', '全部'], ['todo', '未掌握'], ['done', '已掌握'], ['weak', '待巩固']]

function WordsTab({ mobile, mastered, rowsByKey, player, audio, onToggle, canSave }) {
  const [filter, setFilter] = useState('all')
  const weakCount = WORD_BANK.filter(w => isWeak(rowsByKey.get(w.key))).length
  const shown = WORD_BANK.filter(w => filter === 'all' ? true : filter === 'done' ? mastered.has(w.key) : filter === 'todo' ? !mastered.has(w.key) : isWeak(rowsByKey.get(w.key)))
  const maxNew = Math.max(...STUDY_DAYS.map(d => newWordsOn(d.day).length), 1)

  return <>
    <section style={{ ...ui.card, padding: mobile ? 14 : 18 }}>
      <h2 style={ui.h2}>每天新词</h2>
      <p style={{ ...ui.subtle, fontSize: 12, margin: '2px 0 10px' }}>
        核心词 {WORD_BANK.length} 个 · 已掌握 {WORD_BANK.filter(w => mastered.has(w.key)).length} · 待巩固 {weakCount} · 句子里顺带学到 {SENTENCE_VOCAB.length} 个词
      </p>
      <div role="img" aria-label="每天新词数量与掌握情况" style={{ display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: 2, alignItems: 'end', height: 64 }}>
        {STUDY_DAYS.map(d => {
          const fresh = newWordsOn(d.day)
          const done = fresh.filter(w => mastered.has(w.key)).length
          const h = fresh.length / maxNew * 100
          return <a key={d.day} href={`#thai-day=${d.day}`} title={`第${d.day}天：新词 ${fresh.length}，已掌握 ${done}`} style={{ height: `${Math.max(h, 4)}%`, display: 'flex', flexDirection: 'column-reverse', borderRadius: 3, overflow: 'hidden', background: fresh.length ? '#E5E7EB' : '#F3F4F6' }}>
            <span style={{ height: fresh.length ? `${done / fresh.length * 100}%` : 0, background: COLORS.green }} />
          </a>
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...ui.subtle, fontSize: 10, marginTop: 4 }}>
        <span>第1天</span><span>第10天</span><span>第20天</span><span>第30天</span>
      </div>
    </section>

    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 8px' }}>
      {WORD_FILTERS.map(([key, label]) => <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>{label}</Chip>)}
    </div>
    {!shown.length && <p style={ui.subtle}>这里还没有词。</p>}
    {STUDY_DAYS.map(d => {
      const list = shown.filter(w => w.firstDay === d.day)
      if (!list.length) return null
      return <section key={d.day} style={{ ...ui.card, padding: mobile ? '6px 14px' : '8px 18px', marginBottom: 10 }}>
        <a href={`#thai-day=${d.day}`} style={{ ...ui.subtle, fontSize: 12, display: 'block', padding: '6px 0', textDecoration: 'none' }}>第 {d.day} 天 · {d.title} ›</a>
        {list.map(w => {
          const row = rowsByKey.get(w.key)
          return <div key={w.key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${COLORS.border}` }}>
            <span aria-hidden="true" style={{ fontSize: 26, width: 34, textAlign: 'center' }}>{w.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{w.zh}</div>
              <TokenLine tokens={w.tokens} />
              {row && (row.correct_count || row.wrong_count) ? <div style={{ ...ui.subtle, fontSize: 11, marginTop: 4 }}>答对 {row.correct_count} · 答错 {row.wrong_count}{w.days.length > 1 ? ` · 第 ${w.days.join('、')} 天出现` : ''}</div>
                : w.days.length > 1 ? <div style={{ ...ui.subtle, fontSize: 11, marginTop: 4 }}>第 {w.days.join('、')} 天出现</div> : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <AudioButton id={w.id} audio={audio} player={player} label={`播放 ${w.zh}`} size={40} />
              <MasteryToggle mastered={mastered.has(w.key)} weak={isWeak(row)} disabled={!canSave} onToggle={() => onToggle(w.key)} />
            </div>
          </div>
        })}
      </section>
    })}
    <details style={{ ...ui.card, padding: mobile ? '10px 14px' : '12px 18px', marginTop: 6 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>句子里顺带学到的词（{SENTENCE_VOCAB.length} 个）</summary>
      {STUDY_DAYS.map(d => {
        const list = SENTENCE_VOCAB.filter(v => v.firstDay === d.day)
        if (!list.length) return null
        return <div key={d.day} style={{ marginTop: 10 }}>
          <div style={{ ...ui.subtle, fontSize: 11, marginBottom: 4 }}>第 {d.day} 天</div>
          <TokenLine tokens={list} />
        </div>
      })}
    </details>
  </>
}

const RANGE_OPTIONS = [5, 10, 20]

function ReviewTab({ mobile, mastered, rowsByKey, practicedDays, quizHistory, player, audio, onQuizFinish, onMarkMastered }) {
  const [groups, setGroups] = useState(() => new Set(GROUPS.map((_, i) => i)))
  const [source, setSource] = useState('mastered')
  const [size, setSize] = useState(10)
  const [seed, setSeed] = useState(null)

  const days = [...groups].flatMap(gi => [1, 2, 3, 4, 5].map(n => gi * 5 + n))
  const scopeKeys = keysForDays(days)
  const pools = {
    mastered: scopeKeys.filter(k => mastered.has(k)),
    learned: keysForDays(days.filter(d => practicedDays.has(d))),
    all: scopeKeys,
    weak: scopeKeys.filter(k => isWeak(rowsByKey.get(k))),
  }
  const keys = pools[source]
  const questions = useMemo(() => (seed == null ? [] : reviewQuestions(keys, rowsByKey, size, createRng(seed))),
    // 题目只在点「开始」那一刻按当时的范围生成，答题过程中掌握状态变化不重新出题。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed])

  if (seed != null) {
    return <section style={{ ...ui.card, padding: mobile ? 16 : 22 }}>
      <ThaiQuiz key={seed} title="总复习" questions={questions} player={player} audio={audio} masteredKeys={mastered}
        onFinish={results => onQuizFinish({ scope: 'review', day: null, results })} onMarkMastered={onMarkMastered}
        onRetry={() => setSeed(Date.now())} onExit={() => setSeed(null)} />
    </section>
  }

  const toggleGroup = gi => setGroups(old => {
    const next = new Set(old)
    if (next.has(gi)) next.delete(gi); else next.add(gi)
    return next
  })

  return <>
    <section style={{ ...ui.card, padding: mobile ? 16 : 22 }}>
      <h2 style={ui.h2}>按进度出题复习</h2>
      <p style={{ ...ui.subtle, fontSize: 12, margin: '4px 0 12px' }}>错题优先，其次是很久没复习的。答错会移回「待掌握」。</p>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>复习哪几天</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip active={groups.size === GROUPS.length} onClick={() => setGroups(groups.size === GROUPS.length ? new Set() : new Set(GROUPS.map((_, i) => i)))}>全部 30 天</Chip>
        {GROUPS.map((title, gi) => <Chip key={gi} active={groups.has(gi)} onClick={() => toggleGroup(gi)}>{gi * 5 + 1}–{gi * 5 + 5} 天</Chip>)}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 6px' }}>考哪些内容</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip active={source === 'mastered'} onClick={() => setSource('mastered')}>已掌握的（{pools.mastered.length}）</Chip>
        <Chip active={source === 'weak'} onClick={() => setSource('weak')}>只练错题（{pools.weak.length}）</Chip>
        <Chip active={source === 'learned'} onClick={() => setSource('learned')}>做过作业的天（{pools.learned.length}）</Chip>
        <Chip active={source === 'all'} onClick={() => setSource('all')}>这些天全部（{pools.all.length}）</Chip>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 6px' }}>出几题</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {RANGE_OPTIONS.map(n => <Chip key={n} active={size === n} onClick={() => setSize(n)}>{n} 题</Chip>)}
      </div>
      <button style={{ ...ui.primary, width: '100%', marginTop: 16, opacity: keys.length ? 1 : 0.5 }} disabled={!keys.length} onClick={() => setSeed(Date.now())}>
        {keys.length ? `开始复习 · ${Math.min(size, keys.length)} 题` : source === 'mastered' ? '还没有已掌握的内容，先去课程里标记，或选「这些天全部」' : '这个范围里没有内容'}
      </button>
    </section>

    <section style={{ ...ui.card, padding: mobile ? 14 : 18, marginTop: 14 }}>
      <h2 style={ui.h2}>最近成绩</h2>
      {!quizHistory.length && <p style={{ ...ui.subtle, margin: '6px 0 0' }}>做过作业或复习后，成绩会出现在这里。</p>}
      {quizHistory.slice(0, 12).map(r => {
        const pct = Math.round(r.correct / r.total * 100)
        return <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: 13, flex: 1 }}>{r.scope === 'day' ? `第 ${r.lesson_day} 天作业` : '总复习'}<span style={{ ...ui.subtle, fontSize: 11, marginLeft: 8 }}>{fmtDateTime(r.taken_at)}</span></span>
          <span style={{ width: 70 }}><ProgressBar pct={pct} height={6} color={pct === 100 ? COLORS.green : pct >= 60 ? COLORS.primary : COLORS.orange} /></span>
          <b style={{ fontSize: 13, minWidth: 40, textAlign: 'right' }}>{r.correct}/{r.total}</b>
        </div>
      })}
    </section>
  </>
}
