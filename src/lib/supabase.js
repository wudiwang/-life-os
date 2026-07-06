import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 未配置密钥时为 null，dataStore 自动降级 localStorage 演示模式
export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = hasSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null
