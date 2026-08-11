import { COLORS } from '../../lib/constants'

// 表还没建时的可见提示。
// optional 表加载失败会静默返回空数组，页面看上去只是"没数据"——
// v7 的 journal_threads/insights 就这样空了好几天没人发现。宁可丑一点也要说出来。
export function TableMissing({ sql }) {
  return (
    <div style={{
      background: '#FEF2F2', border: `1px solid #FECACA`, borderRadius: 10,
      padding: '10px 14px', fontSize: 12, color: COLORS.text, lineHeight: 1.7,
    }}>
      ⚠️ 这块的数据表还没建，功能暂时不可用。
      <div style={{ color: COLORS.textLight, marginTop: 2 }}>
        执行 <code style={{ background: '#fff', padding: '1px 5px', borderRadius: 4 }}>
          npm run sql -- supabase/{sql}
        </code>，或去 Supabase SQL Editor 粘贴该文件。
      </div>
    </div>
  )
}
