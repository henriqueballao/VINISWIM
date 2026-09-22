import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL as string
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
if(!url||!key)throw new Error('Supabase frontend configuration missing')
export const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.sessionStorage}})
