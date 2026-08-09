/* ============================================================
   auth/index.ts — 인증 모듈의 공개 표면

   바깥에서는 이 파일만 import 하세요.

     import { AuthProvider, AuthGate, useAuth } from './auth'

   내부 파일(config, errors 등)을 직접 import 하지 않아도 되도록
   필요한 것은 전부 여기서 다시 내보냅니다.
   ============================================================ */

export { AuthProvider, useAuth } from './AuthProvider'
export type { AuthContextValue, MemberState } from './AuthProvider'

export { AuthGate, AuthSplash, UnregisteredNotice } from './AuthGate'
export { LoginScreen } from './LoginScreen'

export { translateError, localError } from './errors'
export type { TranslatedError, AuthAction } from './errors'

export {
  MIN_PASSWORD_LENGTH,
  REGISTERED_USERNAMES,
  REGISTERED_USERNAMES_LABEL,
  USERNAME_PATTERN,
  isRegisteredUsername,
  normalizeUsername,
} from './config'
