// AI 分析端点：接收模块名 + 数据摘要，调 Claude API 返回评价与建议
// 环境变量：CLAUDE_API_KEY（Vercel → Settings → Environment Variables）

const SYSTEM_PROMPT = `你是一位专业的个人生活管理顾问，服务于一个名为"人生 OS"的个人管理系统。
用户会给你他的个人数据（健康指标、习惯打卡、目标进展、工作记录、心情日记等）。
你的职责：
1. 基于数据给出客观、具体的评价（好的地方要肯定，问题要直说）；
2. 给出 2-4 条可落地的建议，具体到行动；
3. 如有需要提醒的风险（如健康指标异常、目标严重滞后），明确指出；
4. 语气：像一位专业又靠谱的私人顾问，中文回答，简洁分段，不要空话套话。
注意：你不是医生，涉及健康异常时建议就医而非诊断。`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 CLAUDE_API_KEY，请在 Vercel 环境变量中添加' })
  }

  const { module: moduleName, dataSummary, question } = req.body || {}
  if (!dataSummary) {
    return res.status(400).json({ error: '缺少 dataSummary' })
  }

  const userPrompt = [
    `【分析模块】${moduleName || '综合'}`,
    `【我的数据】\n${dataSummary}`,
    question ? `【我的问题】${question}` : '请基于以上数据给出评价、建议和必要的提醒。',
  ].join('\n\n')

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await resp.json()
    if (!resp.ok) {
      console.error('Claude API error', data)
      return res.status(resp.status).json({ error: data?.error?.message || 'Claude API 调用失败' })
    }

    if (data.stop_reason === 'refusal') {
      return res.status(200).json({ content: '（该请求被安全策略拒绝，请调整内容后重试）' })
    }

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    return res.status(200).json({ content: text })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
