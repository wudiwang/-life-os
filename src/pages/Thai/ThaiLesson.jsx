import { useMemo, useState } from 'react'
import { COLORS } from '../../lib/constants'
import { ROMAN_READING_GUIDE } from './thaiGloss'
import { createRng, dayMastery, homeworkQuestions, isWeak, newWordsOn, studyDay } from './thaiStudy'
import { AudioButton, MasteryToggle, ProgressBar, SceneCard, TokenLine, ui } from './ThaiParts'
import { ThaiQuiz } from './ThaiQuiz'

export function ThaiLesson({ day, mobile, mastered, rowsByKey, practiced, bestScore, canSave, player, audio, onToggle, onQuizFinish, onMarkMastered }) {
  const lesson = studyDay(day)
  const [hideZh, setHideZh] = useState(false)
  const [quizSeed, setQuizSeed] = useState(null)
  const questions = useMemo(() => homeworkQuestions(day, createRng(quizSeed ?? 1)), [day, quizSeed])
  const progress = dayMastery(day, mastered)
  const fresh = new Set(newWordsOn(day).map(w => w.key))
  const pad = mobile ? '16px 16px' : '22px 26px'

  const itemRow = (item, isWord) => {
    const row = rowsByKey.get(item.key)
    return <div key={item.id} style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: `1px solid ${COLORS.border}`, alignItems: 'flex-start' }}>
      {isWord && <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 12, background: lesson.scene.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>{item.icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!isWord && <div style={{ ...ui.subtle, fontSize: 11 }}>{item.role}</div>}
        <div style={{ fontSize: isWord ? 18 : 17, fontWeight: 700, lineHeight: 1.5, marginBottom: 6, color: hideZh ? COLORS.textLight : COLORS.text }}>
          {hideZh ? '（中文已遮住，先自己说）' : item.zh}
          {isWord && fresh.has(item.key) && !hideZh && <span style={{ marginLeft: 8, fontSize: 11, color: '#7C3AED', background: '#EDE9FE', padding: '2px 6px', borderRadius: 6, verticalAlign: 'middle' }}>新词</span>}
        </div>
        <TokenLine tokens={item.tokens} hideZh={hideZh} size={isWord ? 'lg' : 'md'} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <AudioButton id={item.id} audio={audio} player={player} label={`播放 ${item.zh}`} />
        <MasteryToggle mastered={mastered.has(item.key)} weak={isWeak(row)} disabled={!canSave} onToggle={() => onToggle(item.key)} />
      </div>
    </div>
  }

  return <>
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <a href="#thai" style={{ ...ui.subtle, display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'none' }}>‹ 30 天目录</a>
      <span style={{ display: 'flex', gap: 6 }}>
        {day > 1 && <a href={`#thai-day=${day - 1}`} style={{ ...ui.button, minHeight: 36, padding: '6px 12px', textDecoration: 'none', fontSize: 13 }}>‹ 前一天</a>}
        {day < 30 && <a href={`#thai-day=${day + 1}`} style={{ ...ui.button, minHeight: 36, padding: '6px 12px', textDecoration: 'none', fontSize: 13 }}>后一天 ›</a>}
      </span>
    </nav>

    <SceneCard scene={lesson.scene} mobile={mobile}>
      <div style={{ ...ui.subtle, fontSize: 12 }}>第 {day} / 30 天</div>
      <h1 style={{ fontSize: mobile ? 24 : 28, margin: '2px 0 4px' }}>{lesson.title}</h1>
      <p style={{ fontSize: 14, margin: '0 0 12px' }}>{lesson.goal}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span>今日掌握 <b>{progress.done}</b> / {progress.total}</span>
        <b style={{ color: progress.pct === 100 ? '#047857' : COLORS.primaryDark }}>{progress.pct}%</b>
      </div>
      <ProgressBar pct={progress.pct} />
      <div style={{ ...ui.subtle, fontSize: 12, marginTop: 6 }}>
        {practiced ? `作业已做 · 最好 ${bestScore}` : '作业还没做'}{progress.pct === 100 ? ' · 这一天全部掌握 🎉' : ''}
      </div>
    </SceneCard>

    <section style={{ ...ui.card, padding: pad, marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h2 style={ui.h2}>① 认词</h2>
        <button style={{ ...ui.button, fontSize: 12, padding: '6px 10px', minHeight: 36 }} aria-pressed={hideZh} onClick={() => setHideZh(v => !v)}>{hideZh ? '显示中文' : '遮住中文自测'}</button>
      </div>
      <p style={{ ...ui.subtle, margin: '4px 0 0', fontSize: 12 }}>蓝字是读音，下面一行是它对应的中文。会了就点「标记掌握」。</p>
      {lesson.words.map(w => itemRow(w, true))}
    </section>

    <section style={{ ...ui.card, padding: pad, marginTop: 14, background: '#FFFBEB', borderColor: '#FDE68A' }}>
      <h2 style={ui.h2}>② 今天的句式</h2>
      <div style={{ margin: '12px 0 8px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {lesson.pattern.formula.split(' + ').map((part, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: COLORS.textLight }}>＋</span>}
          <span style={{ padding: '6px 12px', borderRadius: 10, fontWeight: 700, fontSize: 16, ...(/[a-z]/i.test(part) ? { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' } : { background: '#fff', color: COLORS.text, border: `1px dashed ${COLORS.border}` }) }}>{part}</span>
        </span>)}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>＝ {lesson.pattern.meaning}</div>
      <div style={{ ...ui.subtle, marginTop: 4 }}>例：{lesson.pattern.example}</div>
    </section>

    <section style={{ ...ui.card, padding: pad, marginTop: 14 }}>
      <h2 style={ui.h2}>③ 放进对话，跟着读</h2>
      <p style={{ ...ui.subtle, margin: '4px 0 0', fontSize: 12 }}>点喇叭听一遍，再跟读。虚线框的 khráp 是礼貌尾音。</p>
      {lesson.lines.map(l => itemRow(l, false))}
    </section>

    <section style={{ ...ui.card, padding: pad, marginTop: 14, borderColor: '#BFDBFE' }}>
      <h2 style={ui.h2}>④ 今日作业</h2>
      {quizSeed == null ? <>
        <p style={{ ...ui.subtle, margin: '6px 0 12px' }}>
          {questions.length} 道题：选读音、选意思、听音、拼句子。答错的会自动移回「待掌握」，答对的可以一键标记掌握。
        </p>
        <button style={{ ...ui.primary, width: '100%' }} onClick={() => setQuizSeed(Date.now())}>{practiced ? '再做一次作业' : '开始做作业'}</button>
      </> : <ThaiQuiz key={quizSeed} title={`第 ${day} 天作业`} questions={questions}
        player={player} audio={audio} masteredKeys={mastered}
        onFinish={results => onQuizFinish({ scope: 'day', day, results })}
        onMarkMastered={onMarkMastered}
        onRetry={() => setQuizSeed(Date.now())} onExit={() => setQuizSeed(null)} />}
    </section>

    <details style={{ ...ui.subtle, marginTop: 14 }}>
      <summary style={{ cursor: 'pointer', padding: '10px 0', minHeight: 44 }}>读音小提示</summary>
      {ROMAN_READING_GUIDE.map(line => <p key={line}>{line}</p>)}
      <p>发音为泰语合成语音，跟着声音模仿即可。</p>
    </details>
    <div aria-live="polite" style={{ ...ui.subtle, minHeight: 22, color: audio.status === 'error' ? '#B45309' : COLORS.textLight }}>
      {audio.status === 'error' ? audio.message : audio.status === 'loading' ? '声音加载中…' : ''}
    </div>
    <a href={day < 30 ? `#thai-day=${day + 1}` : '#thai'} style={{ ...ui.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginTop: 8 }}>
      {day < 30 ? `下一天：${studyDay(day + 1).title} →` : '回到目录'}
    </a>
  </>
}

