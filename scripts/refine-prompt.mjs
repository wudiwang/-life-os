// 快记提炼：提示词 + 结果解析。被 scripts/tg-bot.mjs 的 worker 调用。
// 走本机 claude -p（订阅额度），不经过 Claude API，不花钱。

// 第二大脑的既有分类，AI 只能命中这几个，不许新造
export const CATEGORIES = ['项目管理', '交易迭代', '生活感悟', '健康知识', '人际关系', '文档模板']

// 把已有的主线与启示渲染成提示词里的「记忆」段。
// 没有记忆时提炼是逐笔独立的，同一个想法换个说法就会被当成新东西再存一遍——这段就是为了堵这个。
function buildMemoryBlock(memory) {
  const threads = memory?.threads || []
  const insights = memory?.insights || []
  if (!threads.length && !insights.length) return ''

  const t = threads.map(x =>
    `- [${x.id}] 《${x.title}》${x.summary ? `\n    当前结论：${String(x.summary).replace(/\n/g, ' ').slice(0, 120)}` : ''}`,
  ).join('\n')
  const i = insights.map(x =>
    `- [${x.id}] ${x.title}（已被提到 ${x.hits} 次）`,
  ).join('\n')

  return `
## 他已经沉淀过的东西（判重用，务必先读）

【进行中的主线】
${t || '（暂无）'}

【已有的启示】
${i || '（暂无）'}

判重规则（重要）：
- 这段话如果是在推进上面某条主线 → thread_id 填那条主线的 id。
- 这段话表达的规律如果与某条已有启示**实质相同**（哪怕措辞完全不同）→ insight.merge_into 填那条启示的 id，不要新建，也不要在 knowledge 里再产出同一条。
- 只有确实是新的、可复用的规律，才产出新启示（insight.merge_into 留空）。
- 他重复说同一件事是常态，你的价值就在于识别出"这是老想法的第 N 次表述"，而不是又存一条。
`
}

export function buildRefinePrompt(text, context, memory) {
  return `你是「人生 OS」的提炼层。这是用户（昊天）的个人管理系统，立意是：
把"我这个人"——身体、习惯、目标、工作、情感、认知、生活体验——从一堆无序的感觉感受，数字化地记录下来，让他：
1. 看清自己：我是什么样的人，处在什么阶段，状态如何；
2. 指导当下：当下怎么做才能更好地生活，数据说话，不迷蒙；
3. 不留遗憾：热爱生活，记录美好，朝目标前进。
他的核心原则是「思维的迭代」——关注迭代而非轮回。

他随手甩给你一段口语化、可能很杂很乱的话。你的职责不是原样记账，而是从他的系统维度出发做一层过滤和提炼。

## 你要产出四样东西

1. journal.content —— 整理后的日记正文。
   把口水话理顺成通顺、简洁的第一人称记录，保留他的语气和真实判断，删掉重复和口头禅。
   不要美化，不要拔高，不要替他下他没下的结论。原话里的事实一个都不能丢。

2. knowledge[] —— 值得沉淀为知识资产的条目（0 到 2 条，宁缺毋滥）。
   只有当这段话里存在**可复用的规律、判断、教训或方法**时才提。
   纯粹的心情、流水账、一次性琐事 → 不提，返回空数组。
   category 必须精确命中：${CATEGORIES.join(' / ')}。
   content 写"他悟到了什么、为什么成立、以后怎么用"，200 字以内，不是复述原话。

3. todos[] —— 需要他本人跟进的行动（0 到 3 条）。
   只提这段话里真实存在的、他自己说要做或明显该做的事。不要替他发明任务，不要提"继续保持"这种空话。
   priority：有明确 deadline 或影响大 → high；一般 → mid；有空再说 → low。
   due_date：他明确提到日期才填 YYYY-MM-DD，否则空字符串。

4. insight —— 一条能影响他后续行为的启示（0 或 1 条，可以为 null）。
   与 knowledge 的区别：knowledge 是"知道了什么"，insight 是"以后遇到同类情况该怎么做"。
   必须是可复用的行为准则，不是这一次的具体事。写不出就返回 null。
   命中已有启示时只填 merge_into，别重复造。

## 铁律
- 宁可返回空的 knowledge、todos、insight，也不要为了凑数硬提。平庸的条目会污染他的第二大脑。
- 只处理他真的说了的内容。不推测、不脑补、不添加他没提到的事实。
- 全部中文。

## 输出格式（严格遵守）
只输出一个 JSON 对象，不要任何解释文字，不要 markdown 代码块围栏。字段：
{
  "journal": {
    "content": "整理后的正文",
    "mood": 心情整数 1-5（1很差 5很好），看不出填 0,
    "gratitude": "值得感恩的小事，没有填空字符串"
  },
  "knowledge": [ { "title": "20字内标题", "category": "上面六选一", "content": "规律本身，200字内", "tags": ["标签"] } ],
  "todos": [ { "title": "动词开头", "priority": "high|mid|low", "due_date": "YYYY-MM-DD 或空字符串" } ],
  "thread_id": "命中的主线 id，没命中填空字符串",
  "insight": { "title": "一句话启示，25字内", "detail": "为什么成立、以后怎么用，150字内", "merge_into": "命中的已有启示 id，是新启示则填空字符串" },
  "comment": "一句话告诉他你提炼了什么、或为什么没提炼出东西，40字内，口语化"
}
insight 没有就写 null。
${buildMemoryBlock(memory)}${context ? `\n【今天已记的内容，供你理解上下文，不要重复提炼】\n${context}\n` : ''}
【他刚说的话】
${text}`
}

// claude -p 的输出可能带解释文字或 ``` 围栏，稳妥地把 JSON 抠出来
export function parseRefineResult(stdout) {
  const raw = String(stdout || '').trim()
  if (!raw) throw new Error('claude 无输出')

  let body = raw
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) body = fenced[1].trim()
  else {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('输出里找不到 JSON')
    body = body.slice(start, end + 1)
  }

  const data = JSON.parse(body)
  const j = data.journal || {}
  const mood = Number(j.mood)
  const uuid = v => (/^[0-9a-f-]{36}$/i.test(String(v || '')) ? String(v) : null)

  // insight 可能是 null、{} 或缺字段；合并已有启示时只要 merge_into 有效就算数
  const ins = data.insight && typeof data.insight === 'object' ? data.insight : null
  const mergeInto = uuid(ins?.merge_into)
  const insight = ins && (mergeInto || String(ins.title || '').trim())
    ? {
      title: String(ins.title || '').trim(),
      detail: String(ins.detail || '').trim(),
      merge_into: mergeInto,
    }
    : null

  // 归一化：字段缺失或类型不对时给安全默认，前端不用再防御
  return {
    journal: {
      content: String(j.content || '').trim(),
      mood: Number.isInteger(mood) && mood >= 1 && mood <= 5 ? mood : null,
      gratitude: String(j.gratitude || '').trim(),
    },
    knowledge: (Array.isArray(data.knowledge) ? data.knowledge : [])
      .filter(k => k && k.title && k.content)
      .slice(0, 2)
      .map(k => ({
        title: String(k.title).trim(),
        category: CATEGORIES.includes(k.category) ? k.category : '',
        content: String(k.content).trim(),
        tags: Array.isArray(k.tags) ? k.tags.slice(0, 3).map(String).join(',') : '',
      })),
    todos: (Array.isArray(data.todos) ? data.todos : [])
      .filter(t => t && t.title)
      .slice(0, 3)
      .map(t => ({
        title: String(t.title).trim(),
        priority: ['high', 'mid', 'low'].includes(t.priority) ? t.priority : 'mid',
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date || '') ? t.due_date : null,
      })),
    thread_id: uuid(data.thread_id),
    insight,
    comment: String(data.comment || '').trim(),
  }
}
