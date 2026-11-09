// 「🎧 生活」tab 的纯函数：随身录音里整理出的泰语（thai_life_phrases，scripts/voice-memos.mjs 写入）
// 按天分组、拆逐词释义、生成掌握标记的 key。泰文只用于发音，不出现在展示字段里。测试见 lifePhrases.test.mjs。

// 掌握标记和课程共用 thai_item_progress，用 life: 前缀和课程的 w: / l: 区分
export const lifeKey = roman => `life:${String(roman || '').trim()}`

// 句尾礼貌词显示成虚线框（和课程一致）
const FUNCTION_WORDS = new Set(['khráp', 'khâ', 'khá', 'ná', 'ná khráp', 'ná khá'])

// 'khǎaw=请给我 | thǔng=袋子' → TokenLine 用的 [{roman, zh, fn}]；
// 没有逐词释义就按空格切成一块块只显示读音（整句一个块在手机上会撑出屏幕）
export function lifeTokens(row) {
  const tokens = String(row?.gloss || '').split('|').map(part => {
    const [roman, ...zh] = part.split('=')
    return { roman: (roman || '').trim(), zh: zh.join('=').trim() }
  }).filter(t => t.roman && t.zh)
  const list = tokens.length ? tokens : String(row?.roman || '').split(/\s+/).filter(Boolean).map(roman => ({ roman, zh: '' }))
  return list.map(t => ({ ...t, fn: FUNCTION_WORDS.has(t.roman) }))
}

const fmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })
export const lifeTime = iso => (iso ? fmt.format(new Date(iso)) : '')

// 按天分组（新的在上），每天里按时间排；heard = 录音里真实听到的，wish = 我当时没说出来的
export function groupLifeDays(rows) {
  const map = new Map()
  for (const r of rows || []) {
    if (!map.has(r.heard_on)) map.set(r.heard_on, { day: r.heard_on, heard: [], wish: [] })
    map.get(r.heard_on)[r.kind === 'wish' ? 'wish' : 'heard'].push(r)
  }
  const byTime = (a, b) => String(a.heard_at || '').localeCompare(String(b.heard_at || ''))
  return [...map.values()]
    .map(d => ({ ...d, heard: d.heard.sort(byTime), wish: d.wish.sort(byTime) }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
}

export const LIFE_FILTERS = [['all', '全部'], ['todo', '没掌握的'], ['wish', '想说没说出来']]

export function filterLife(rows, filter, mastered) {
  if (filter === 'wish') return rows.filter(r => r.kind === 'wish')
  if (filter === 'todo') return rows.filter(r => !mastered.has(lifeKey(r.roman)))
  return rows
}
