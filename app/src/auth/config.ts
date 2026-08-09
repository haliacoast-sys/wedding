/* ============================================================
   config.ts — 인증 화면이 참조하는 상수

   여기 값은 전부 서버(Supabase 설정·마이그레이션)에 이미 정해져 있는 값의
   복사본입니다. 클라이언트에서 미리 걸러 주기 위한 것이지 진짜 관문이 아닙니다.
   서버 쪽을 바꾸면 이 파일도 같이 고쳐야 합니다.
   ============================================================ */

/**
 * 비밀번호 최소 길이. Supabase Auth 설정(password_min_length)과 같은 값이어야 합니다.
 * 클라이언트에서 먼저 막는 이유: 서버까지 갔다 와서 영어 오류를 받는 것보다
 * 입력 즉시 한국어로 알려 주는 편이 낫기 때문입니다.
 */
export const MIN_PASSWORD_LENGTH = 10

/**
 * 아이디로 쓸 수 있는 문자.
 *
 * 아이디는 lib/supabase.ts 의 toAuthEmail() 이 뒤에 `@wedding.local` 을 붙여
 * 합성 이메일로 만듭니다. 따라서 이메일 로컬파트로 쓸 수 없는 문자가 들어가면
 * Supabase 가 email_address_invalid 를 돌려줍니다. 그 전에 여기서 막습니다.
 *
 * 첫 글자는 영소문자·숫자, 이후 2~32자.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/

/**
 * 실제로 등록된 아이디.
 * supabase/migrations/20260809000003_username_login.sql 의 allowed_emails 와 같아야 합니다.
 *
 * 이 목록에 없는 아이디로도 "가입과 로그인은 성공"합니다. 다만 handle_new_user()
 * 트리거가 members 에 행을 넣지 않으므로 모든 테이블이 RLS 에서 0행이 됩니다.
 * 즉 "로그인은 됐는데 화면이 텅 비는" 상태가 됩니다. 그래서 미리 경고합니다.
 */
export const REGISTERED_USERNAMES: readonly string[] = ['juho', 'jiyoung']

/** 표시용. 화이트리스트 안내 문구에서 씁니다. */
export const REGISTERED_USERNAMES_LABEL = REGISTERED_USERNAMES.join(', ')

/**
 * toAuthEmail() 과 같은 정규화를 클라이언트 검증·비교에도 적용합니다.
 * (대문자로 입력해도 juho 로 로그인되도록)
 */
export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase()

/** 등록된 아이디인지. 빈 문자열은 판단하지 않습니다(호출부에서 처리). */
export const isRegisteredUsername = (username: string): boolean =>
  REGISTERED_USERNAMES.includes(normalizeUsername(username))
