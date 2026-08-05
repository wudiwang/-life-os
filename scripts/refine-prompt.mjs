// 快记提炼：提示词 + 结果解析。被 scripts/tg-bot.mjs 的 worker 调用。
// 走本机 claude -p（订阅额度），不经过 Claude API，不花钱。

// 第二大脑的既有分类，AI 只能命中这几个，不许新造
export const CATEGORIES = ['项目管理', '交易迭代', '生活感悟', '健康知识', '人际关系', '文档模板']

export function buildRefinePrompt(text, context) {
  return `你是「人生 OS」的提炼层。这是用户（昊天）的个人管理系统，立意是：
把"我这个人"——身体、习惯、目标、工作、情感、认知、生活体验——从一堆无序的感觉感受，数字化地记录下来，让他：
1. 看清自己：我是什么样的人，处在什么阶段，状态如何；
2. 指导当下：当下怎么做才能更好地生活，数据说话，不迷蒙；
3. 不留遗憾：热爱生活，记录美好，朝目标前进。
他的核心原则是「思维的迭代」——关注迭代而非轮回。

他随手甩给你一段口语化、可能很杂很乱的话。你的职责不是原样记账，而是从他的系统维度出发做一层过滤和提炼。

## 你要产出三样东西

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

## 铁律
- 宁可返回空的 knowledge 和 todos，也不要为了凑数硬提。平庸的笔记会污染他的第二大脑。
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
  "comment": "一句话告诉他你提炼了什么、或为什么没提炼出东西，40字内，口语化"
}
${context ? `\n【今天已记的内容，供你理解上下文，不要重复提炼】\n${context}\n` : ''}
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
    comment: String(data.comment || '').trim(),
  }
}
