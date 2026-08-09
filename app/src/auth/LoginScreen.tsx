/* ============================================================
   LoginScreen.tsx — 아이디로 로그인 / 가입

   이 앱은 이메일이 아니라 아이디로 로그인합니다. 사용자가 juho 라고 치면
   lib/supabase.ts 의 toAuthEmail() 이 juho@wedding.local 을 만들어 Supabase 에
   넘깁니다. 실재하는 메일함이 아니므로 화면 어디에도 "이메일"이라고 쓰지 않습니다.

   두 사람 다 아직 가입 전이라 가입 모드가 로그인과 동등한 위치에 있습니다.
   ============================================================ */

import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { signIn, signUp } from '../lib/supabase'
import {
  MIN_PASSWORD_LENGTH,
  REGISTERED_USERNAMES_LABEL,
  USERNAME_PATTERN,
  isRegisteredUsername,
  normalizeUsername,
} from './config'
import { localError, translateError } from './errors'
import type { TranslatedError } from './errors'
import './auth.css'
import './LoginScreen.css'

type Mode = 'signin' | 'signup'

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [revealPassword, setRevealPassword] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<TranslatedError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // setSubmitting 은 다음 렌더에나 반영됩니다. 엔터를 연타하면 그 사이에 두 번째
  // 제출이 들어올 수 있으므로 동기적으로 읽히는 ref 로 한 번 더 막습니다.
  const busyRef = useRef(false)

  // 로그인에 성공하면 이 컴포넌트는 곧바로 언마운트됩니다.
  // 사라진 뒤 상태를 건드리지 않도록 표시해 둡니다.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const formId = useId()
  const usernameId = `${formId}-username`
  const passwordId = `${formId}-password`
  const confirmId = `${formId}-password-confirm`
  const hintId = `${formId}-username-hint`

  const normalized = normalizeUsername(username)

  // 화이트리스트에 없는 아이디 경고.
  // 서버는 이런 아이디도 가입·로그인을 받아 주지만 데이터가 0행으로 보입니다.
  const unknownUsername =
    usernameTouched && normalized.length > 0 && !isRegisteredUsername(normalized)

  function switchMode(next: Mode) {
    if (submitting || next === mode) return
    setMode(next)
    setError(null)
    setNotice(null)
    setPasswordConfirm('')
  }

  /** 서버에 보내기 전 클라이언트에서 거르는 규칙. 통과하면 null. */
  function validate(): string | null {
    if (!normalized) return '아이디를 입력하세요.'
    if (!USERNAME_PATTERN.test(normalized)) {
      return '아이디는 영문 소문자·숫자로 시작하는 2~32자여야 합니다.'
    }
    if (!password) return '비밀번호를 입력하세요.'
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다. (지금 ${password.length}자)`
    }
    if (mode === 'signup' && password !== passwordConfirm) {
      return '두 비밀번호가 서로 다릅니다.'
    }
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busyRef.current) return

    setNotice(null)

    const problem = validate()
    if (problem) {
      setError(localError(problem))
      return
    }
    setError(null)

    busyRef.current = true
    setSubmitting(true)

    // 성공한 경우에는 잠금을 풀지 않습니다. onAuthStateChange → 리렌더 → 언마운트까지는
    // 한 틱이 걸리는데, 그 사이에 버튼이 되살아나면 같은 요청이 한 번 더 나갑니다.
    let handOff = false

    try {
      if (mode === 'signin') {
        const { error: authError } = await signIn(normalized, password)
        if (authError) {
          if (mountedRef.current) setError(translateError(authError, 'signin'))
          return
        }
        handOff = true // 성공. 화면 전환은 AuthProvider 가 맡습니다.
        return
      }

      const { data, error: authError } = await signUp(normalized, password)
      if (!mountedRef.current) return

      if (authError) {
        setError(translateError(authError, 'signup'))
        return
      }

      // Supabase 는 이미 있는 계정으로 가입을 시도해도 계정 존재 여부를 숨기려고
      // 성공처럼 응답합니다. 그때 identities 가 빈 배열로 옵니다.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError(localError('이미 가입된 아이디입니다. 로그인으로 바꿔서 시도하세요.'))
        setMode('signin')
        return
      }

      if (!data.session) {
        // 이메일 확인이 켜져 있으면 세션 없이 끝납니다(현재 설정에서는 꺼져 있음).
        setNotice(
          '가입은 됐지만 자동 로그인이 되지 않았습니다. 로그인으로 바꿔 같은 비밀번호로 들어가세요.',
        )
        setMode('signin')
        return
      }

      handOff = true // 가입과 동시에 세션이 생겼습니다.
    } catch (caught) {
      if (mountedRef.current) setError(translateError(caught, mode))
    } finally {
      if (!handOff) {
        busyRef.current = false
        if (mountedRef.current) setSubmitting(false)
      }
    }
  }

  const submitLabel = submitting
    ? mode === 'signin'
      ? '확인 중…'
      : '가입 중…'
    : mode === 'signin'
      ? '로그인'
      : '가입하고 시작하기'

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-eyebrow">2027 · 09 · 04</div>
        <h1 className="auth-title">이주호 &amp; 송지영</h1>
        <p className="auth-lede">결혼 준비 체크리스트</p>

        <div className="login-tabs" role="tablist" aria-label="로그인 또는 가입">
          <button
            type="button"
            role="tab"
            className="login-tab"
            aria-selected={mode === 'signin'}
            aria-controls={formId}
            disabled={submitting}
            onClick={() => switchMode('signin')}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            className="login-tab"
            aria-selected={mode === 'signup'}
            aria-controls={formId}
            disabled={submitting}
            onClick={() => switchMode('signup')}
          >
            가입
          </button>
        </div>

        <form
          id={formId}
          className="login-form"
          onSubmit={handleSubmit}
          aria-busy={submitting}
          noValidate
        >
          <div className="login-field">
            <label className="login-label" htmlFor={usernameId}>
              아이디
              <span className="login-label__hint">영문 소문자</span>
            </label>
            <input
              id={usernameId}
              className="auth-input"
              type="text"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onBlur={() => setUsernameTouched(true)}
              placeholder="juho"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="next"
              disabled={submitting}
              aria-describedby={unknownUsername ? hintId : undefined}
            />
          </div>

          {unknownUsername && (
            <p className="auth-alert auth-alert--warn" id={hintId}>
              <strong className="auth-alert__title">등록되지 않은 아이디</strong>
              <code>{normalized}</code> 은(는) 허용 목록에 없습니다. 이 아이디로도 가입과
              로그인은 되지만 준비 항목·예산이 하나도 보이지 않습니다. 등록된 아이디는{' '}
              <strong>{REGISTERED_USERNAMES_LABEL}</strong> 입니다.
            </p>
          )}

          <div className="login-field">
            <label className="login-label" htmlFor={passwordId}>
              비밀번호
              <span className="login-label__hint">{MIN_PASSWORD_LENGTH}자 이상</span>
            </label>
            <div className="login-password">
              <input
                id={passwordId}
                className="auth-input"
                type={revealPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={mode === 'signin' ? 'go' : 'next'}
                disabled={submitting}
              />
              <button
                type="button"
                className="login-password__toggle"
                onClick={() => setRevealPassword((shown) => !shown)}
                disabled={submitting}
                aria-pressed={revealPassword}
              >
                {revealPassword ? '숨기기' : '보기'}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="login-field">
              <label className="login-label" htmlFor={confirmId}>
                비밀번호 확인
              </label>
              <input
                id={confirmId}
                className="auth-input"
                type={revealPassword ? 'text' : 'password'}
                name="password-confirm"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                disabled={submitting}
                aria-invalid={
                  passwordConfirm.length > 0 && passwordConfirm !== password ? true : undefined
                }
              />
            </div>
          )}

          {notice && (
            <p className="auth-alert auth-alert--good" role="status">
              {notice}
            </p>
          )}

          {error && (
            <p className="auth-alert auth-alert--error" role="alert">
              {error.unmapped ? (
                <>
                  {/* 번역 규칙에 없는 오류. 숨기면 원인을 알 길이 없으므로
                      원문을 그대로, 대신 눈에 띄게 보여 줍니다. */}
                  <strong className="auth-alert__title">처리하지 못한 오류</strong>
                  <span className="auth-alert__raw">
                    {error.message}
                    {error.code && (
                      <span className="auth-alert__code">code: {error.code}</span>
                    )}
                  </span>
                </>
              ) : (
                error.message
              )}
            </p>
          )}

          <button
            type="submit"
            className="auth-btn auth-btn--primary login-submit"
            disabled={submitting}
          >
            {submitting && <span className="auth-spinner" aria-hidden="true" />}
            {submitLabel}
          </button>
        </form>

        <p className="login-switch">
          {mode === 'signin' ? '아직 계정이 없나요?' : '이미 계정이 있나요?'}
          <button
            type="button"
            className="login-switch__button"
            disabled={submitting}
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? '가입하기' : '로그인하기'}
          </button>
        </p>

        {mode === 'signup' && (
          <p className="auth-foot">
            이 앱은 메일 주소를 쓰지 않습니다. 그래서 비밀번호를 잊어도 재설정 메일을 보낼 수
            없습니다. 잊지 않을 비밀번호로 정하고, 브라우저 비밀번호 관리자에 저장해 두세요.
          </p>
        )}
      </div>
    </div>
  )
}

export default LoginScreen
