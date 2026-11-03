// TG 照片处理的纯函数：选最大尺寸、把相册（media_group）合并成一条、拼给本机大脑的提示。
// 不读密钥、不联网，单测见 tg-photo.test.mjs。下载由 tg-bot.mjs 负责。

// TG 的 photo 是同一张图的多个尺寸，取最大的那张
export function largestPhoto(sizes = []) {
  return [...sizes].sort((a, b) => (b.file_size || b.width * b.height || 0) - (a.file_size || a.width * a.height || 0))[0] || null
}

// 一次 getUpdates 里同一相册的多条消息合并成一个单元：{ msg, photos: [sizes, ...], caption }
export function groupMessages(messages) {
  const units = []
  const albums = new Map()
  for (const msg of messages) {
    const caption = (msg.text || msg.caption || '').trim()
    if (msg.media_group_id && msg.photo) {
      const unit = albums.get(msg.media_group_id)
      if (unit) {
        unit.photos.push(msg.photo)
        if (caption) unit.caption = unit.caption ? `${unit.caption}\n${caption}` : caption
        continue
      }
      const fresh = { msg, photos: [msg.photo], caption }
      albums.set(msg.media_group_id, fresh)
      units.push(fresh)
      continue
    }
    units.push({ msg, photos: msg.photo ? [msg.photo] : [], caption })
  }
  return units
}

export function buildPhotoPrompt({ paths, caption }) {
  return [
    `用户发来 ${paths.length} 张照片，已存到本机，请用 Read 工具逐张查看：`,
    ...paths.map(p => `- ${p}`),
    `用户附言：${caption || '（没写）'}`,
    '如果是食物、包装营养表、运动或手表截图、体重秤、动态血糖截图，严格按 docs/塑形数据录入总则.md 识别、计算、写库并按模板回复；其他照片按平常对话处理。',
  ].join('\n')
}
