/* ============================================================
   errors.ts — Supabase 오류 → 한국어 번역

   Supabase 는 오류를 영어로 돌려줍니다("Invalid login credentials" 등).
   그대로 노출하면 쓰는 사람이 무슨 일이 났는지 알 수 없습니다.

   원칙
     1) 아는 오류는 한국어로 바꾼다.
     2) 모르는 오류는 원문을 "숨기지 않고" 보여준다.
        숨기면 두 사람 중 누구도 원인을 알 수 없고 디버깅이 불가능해집니다.
        대신 unmapped 플래그를 세워 화면에서 눈에 띄게 표시합니다.
     3) 번역에 성공해도 original 은 남겨 둔다(콘솔·툴팁용).

   매칭 순서: error.code → 메시지 정규식 → 미매핑.
   code 는 supabase-js v2 의 AuthApiError.code / PostgrestError.code 입니다.
   구버전이나 네트워크 계층 오류는 code 가 없으므로 메시지 규칙이 받아 냅니다.
   ============================================================ */

import { MIN_PASSWORD_LENGTH, REGISTERED_USERNAMES_LABEL } from './config'

/** 어떤 동작을 하다 난 오류인지. 같은 코드라도 문구가 달라집니다. */
export type AuthAction = 'signin' | 'signup' | 'session'

export interface TranslatedError {
  /** 화면에 보여줄 문장. 한국어이거나(매핑 성공) 영어 원문입니다(매핑 실패). */
  message: string
  /** 서버가 준 원문. 매핑에 성공해도 버리지 않습니다. */
  original: string
  /** Supabase 가 준 오류 코드(있는 경우). */
  code?: string
  /** true 면 message 가 번역되지 않은 원문입니다. 화면에서 다르게 표시하세요. */
  unmapped: boolean
}

const NETWORK_MESSAGE =
  '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.'

const RATE_LIMIT_MESSAGE = '요청이 너무 잦습니다. 잠시 뒤에 다시 시도하세요.'

const EXPIRED_MESSAGE = '로그인 정보가 만료되었습니다. 다시 로그인하세요.'

const INVALID_USERNAME_MESSAGE =
  '아이디에 쓸 수 없는 문자가 들어 있습니다. 영문 소문자와 숫자만 쓰세요.'

/** error.code 기준 매핑. */
const BY_CODE: Record<string, string> = {
  // ── 로그인 ──
  invalid_credentials: '아이디 또는 비밀번호가 올바르지 않습니다.',
  user_not_found: '등록되지 않은 아이디입니다. 아직 가입하지 않았다면 가입을 먼저 하세요.',
  email_not_confirmed:
    '계정 확인이 끝나지 않았습니다. Supabase 대시보드에서 이메일 확인 절차를 꺼야 합니다.',
  user_banned: '차단된 계정입니다.',

  // ── 가입 ──
  user_already_exists: '이미 가입된 아이디입니다. 로그인으로 바꿔서 시도하세요.',
  email_exists: '이미 가입된 아이디입니다. 로그인으로 바꿔서 시도하세요.',
  signup_disabled: '지금은 새 가입을 받지 않습니다.',
  weak_password: `비밀번호가 너무 짧거나 단순합니다. ${MIN_PASSWORD_LENGTH}자 이상으로 정하세요.`,
  same_password: '이전과 다른 비밀번호를 정하세요.',

  // ── 입력값 ──
  email_address_invalid: INVALID_USERNAME_MESSAGE,
  email_address_not_authorized: `이 아이디로는 가입할 수 없습니다. 등록된 아이디는 ${REGISTERED_USERNAMES_LABEL} 입니다.`,
  validation_failed: '입력값이 서버 검증을 통과하지 못했습니다. 아이디와 비밀번호를 확인하세요.',

  // ── 빈도 제한 ──
  over_request_rate_limit: RATE_LIMIT_MESSAGE,
  over_email_send_rate_limit: RATE_LIMIT_MESSAGE,

  // ── 세션 ──
  session_not_found: EXPIRED_MESSAGE,
  session_expired: EXPIRED_MESSAGE,
  refresh_token_not_found: EXPIRED_MESSAGE,
  refresh_token_already_used: EXPIRED_MESSAGE,
  bad_jwt: EXPIRED_MESSAGE,

  // ── 기타 ──
  captcha_failed: '봇 확인에 실패했습니다. 잠시 뒤에 다시 시도하세요.',
  request_timeout: '서버가 제때 응답하지 않았습니다. 잠시 뒤에 다시 시도하세요.',
  unexpected_failure: '서버에서 예기치 못한 오류가 났습니다. 잠시 뒤에 다시 시도하세요.',

  // ── PostgREST (members 조회 등) ──
  PGRST301: EXPIRED_MESSAGE,
  '42501': '이 계정에는 접근 권한이 없습니다. 등록된 아이디인지 확인하세요.',
  '42P01': '서버 테이블을 찾지 못했습니다. 마이그레이션이 적용됐는지 확인하세요.',
}

/**
 * 메시지 원문 기준 매핑. code 가 없는 구버전·네트워크 계층 오류를 위한 그물망입니다.
 * 위에서부터 순서대로 검사하므로 구체적인 규칙을 앞에 둡니다.
 */
const BY_MESSAGE: ReadonlyArray<readonly [RegExp, string]> = [
  [/invalid login credentials/i, '아이디 또는 비밀번호가 올바르지 않습니다.'],
  [/user already registered|already been registered/i, '이미 가입된 아이디입니다. 로그인으로 바꿔서 시도하세요.'],
  [
    /password should be at least/i,
    `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
  ],
  [/password.*(too weak|is known to be weak|pwned)/i, '너무 흔한 비밀번호입니다. 다른 비밀번호를 정하세요.'],
  [/email address.*(invalid|not valid)|unable to validate email/i, INVALID_USERNAME_MESSAGE],
  [/signups? (are )?not allowed|signup is disabled/i, '지금은 새 가입을 받지 않습니다.'],
  [/email (rate )?limit exceeded|too many requests/i, RATE_LIMIT_MESSAGE],
  [
    /for security purposes, you can only request this after/i,
    '보안 제한으로 잠시 뒤에 다시 시도할 수 있습니다.',
  ],
  [/email not confirmed/i, '계정 확인이 끝나지 않았습니다. 관리자에게 문의하세요.'],
  [/jwt (expired|is expired)|token has expired/i, EXPIRED_MESSAGE],
  [/auth session missing/i, EXPIRED_MESSAGE],
  // 네트워크 계층: fetch 가 던지는 TypeError 는 브라우저마다 문구가 다릅니다.
  [/failed to fetch|networkerror|load failed|network request failed/i, NETWORK_MESSAGE],
  [/fetch failed|econnrefused|enotfound|and\/or timeout/i, NETWORK_MESSAGE],
]

/** 이름만 보고도 네트워크 오류로 확정할 수 있는 것들. */
const NETWORK_ERROR_NAMES = new Set([
  'AuthRetryableFetchError',
  'TypeError',
  'AbortError',
  'FunctionsFetchError',
])

interface RawError {
  message: string
  code?: string
  name?: string
  status?: number
}

/** unknown 에서 쓸 만한 필드를 안전하게 꺼냅니다. */
function readError(error: unknown): RawError {
  if (error == null) return { message: '' }
  if (typeof error === 'string') return { message: error }

  if (typeof error === 'object') {
    const source = error as Record<string, unknown>
    const message =
      typeof source.message === 'string'
        ? source.message
        : typeof source.error_description === 'string'
          ? source.error_description
          : typeof source.error === 'string'
            ? source.error
            : ''
    const code =
      typeof source.code === 'string'
        ? source.code
        : typeof source.error_code === 'string'
          ? source.error_code
          : undefined
    const name = typeof source.name === 'string' ? source.name : undefined
    const status = typeof source.status === 'number' ? source.status : undefined

    // PostgrestError 는 details/hint 에만 단서가 있는 경우가 있습니다.
    if (!message && typeof source.details === 'string') {
      return { message: source.details, code, name, status }
    }
    return { message, code, name, status }
  }

  return { message: String(error) }
}

/**
 * 어떤 오류든 화면에 띄울 수 있는 형태로 바꿉니다.
 * 절대 throw 하지 않습니다 — 오류 처리기가 다시 터지면 아무것도 못 보게 됩니다.
 */
export function translateError(error: unknown, action: AuthAction): TranslatedError {
  const raw = readError(error)
  const original = raw.message || '(오류 메시지가 비어 있습니다)'

  // 1) 코드
  if (raw.code) {
    const hit = BY_CODE[raw.code]
    if (hit) {
      return { message: applyAction(hit, raw.code, action), original, code: raw.code, unmapped: false }
    }
  }

  // 2) 메시지
  for (const [pattern, korean] of BY_MESSAGE) {
    if (pattern.test(raw.message)) {
      return { message: korean, original, code: raw.code, unmapped: false }
    }
  }

  // 3) 이름만으로 판별되는 네트워크 오류 (메시지가 비었거나 특이한 경우)
  if (raw.name && NETWORK_ERROR_NAMES.has(raw.name) && !raw.status) {
    return { message: NETWORK_MESSAGE, original, code: raw.code, unmapped: false }
  }

  // 4) 5xx 는 서버 문제로 뭉뚱그려도 됩니다.
  if (raw.status && raw.status >= 500) {
    return {
      message: '서버에 문제가 생겼습니다. 잠시 뒤에 다시 시도하세요.',
      original,
      code: raw.code,
      unmapped: false,
    }
  }

  // 5) 모르는 오류 — 원문을 그대로 노출합니다(숨기지 않습니다).
  return { message: original, original, code: raw.code, unmapped: true }
}

/** 같은 코드라도 로그인/가입 맥락에 따라 안내가 달라지는 몇 가지. */
function applyAction(message: string, code: string, action: AuthAction): string {
  if (code === 'user_not_found' && action === 'signup') {
    return '가입에 실패했습니다. 아이디와 비밀번호를 확인하세요.'
  }
  if (code === 'invalid_credentials' && action === 'signup') {
    return '이미 가입된 아이디이거나 비밀번호가 맞지 않습니다.'
  }
  return message
}

/** 서버까지 가지 않고 클라이언트에서 만든 오류. 항상 한국어이므로 unmapped=false. */
export const localError = (message: string): TranslatedError => ({
  message,
  original: message,
  unmapped: false,
})
