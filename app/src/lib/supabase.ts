import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 가 비어 있습니다. app/.env.local 을 확인하세요.',
  )
}

export const supabase = createClient<Database>(url, key)

/**
 * Supabase Auth는 식별자로 이메일을 요구하지만 우리는 아이디로 로그인한다.
 * 사용자가 입력한 아이디 뒤에 고정 도메인을 붙여 합성 주소를 만든다.
 * 이 주소에 해당하는 메일함은 실재하지 않으며, 메일 발송도 하지 않는다.
 *
 * 이 값을 바꾸면 기존 계정으로 로그인할 수 없게 된다.
 * supabase/migrations/20260809000003_username_login.sql 의 allowed_emails와 반드시 일치해야 한다.
 */
const LOGIN_DOMAIN = 'wedding.local'

export const toAuthEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`

export const signIn = (username: string, password: string) =>
  supabase.auth.signInWithPassword({ email: toAuthEmail(username), password })

export const signUp = (username: string, password: string) =>
  supabase.auth.signUp({ email: toAuthEmail(username), password })

export const signOut = () => supabase.auth.signOut()
