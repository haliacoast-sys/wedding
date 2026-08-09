/* ============================================================
   AuthGate.tsx — 인증 상태에 따라 무엇을 보여 줄지 정하는 관문

   App.tsx 가 이 컴포넌트 하나만 쓰면 됩니다. 다섯 갈래를 전부 여기서 다룹니다.

     loading                → 스플래시 (새로고침 시 로그인 화면 깜빡임 방지)
     세션 없음              → LoginScreen
     멤버 조회 중           → 스플래시
     멤버 조회 실패         → 재시도 / 로그아웃
     화이트리스트 미등록    → 안내 (여기서 children 을 그리면 안 됩니다.
                              데이터가 0행이라 "고장난 화면"처럼 보입니다)
     정상                   → children

   화면을 직접 조립하고 싶으면 useAuth() 를 써서 갈래를 나누면 됩니다.
   ============================================================ */

import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginScreen } from './LoginScreen'
import { REGISTERED_USERNAMES_LABEL } from './config'
import './auth.css'
import './AuthGate.css'

/** 세션·멤버를 확인하는 동안 잠깐 보여 주는 화면. */
export function AuthSplash({ label }: { label: string }) {
  return (
    <div className="auth-shell">
      <div className="gate-splash" role="status" aria-live="polite">
        <span className="auth-spinner" aria-hidden="true" />
        <span className="gate-splash__label">{label}</span>
      </div>
    </div>
  )
}

/**
 * 로그인은 됐는데 allowed_emails 에 없는 경우.
 *
 * 이 상태를 그냥 통과시키면 목록도 예산도 전부 비어 있는 화면이 나오고,
 * 쓰는 사람은 "앱이 고장났다"고 판단하게 됩니다. 원인을 명확히 말해 줍니다.
 */
export function UnregisteredNotice() {
  const { username, refreshMember, signOut } = useAuth()

  return (
    <div className="auth-shell">
      <div className="auth-card gate-card">
        <div className="auth-eyebrow">접근 불가</div>
        <h1 className="auth-title">등록되지 않은 계정입니다</h1>

        <p className="gate-body">
          로그인 자체는 성공했지만 이 아이디는 허용 목록에 없습니다. 그래서 준비 항목·예산·업체가
          <strong> 하나도 보이지 않습니다.</strong> 화면이 고장난 것이 아니라 권한이 없는
          상태입니다.
        </p>

        {username && <span className="gate-who">{username}</span>}

        <p className="gate-body">
          등록된 아이디는 <strong>{REGISTERED_USERNAMES_LABEL}</strong> 입니다. 아이디를 잘못
          입력해 새 계정을 만들었다면 로그아웃하고 올바른 아이디로 다시 하세요.
        </p>

        <div className="gate-actions">
          <button type="button" className="auth-btn auth-btn--primary" onClick={() => void signOut()}>
            로그아웃하고 다시 시도
          </button>
          <button type="button" className="auth-btn auth-btn--quiet" onClick={() => void refreshMember()}>
            다시 확인
          </button>
        </div>

        <p className="auth-foot">
          허용 목록을 바꾸려면 Supabase 의 <code>allowed_emails</code> 테이블에
          <code> &lt;아이디&gt;@wedding.local</code> 을 넣어야 합니다. 이미 가입한 계정이라면
          <code> members</code> 에도 행을 직접 넣어야 합니다(트리거는 가입 순간에만 돕니다).
        </p>
      </div>
    </div>
  )
}

/** members 조회 자체가 실패한 경우. 미등록과 구분해서 보여 줍니다. */
function MemberLookupFailed({ message, unmapped }: { message: string; unmapped: boolean }) {
  const { refreshMember, signOut } = useAuth()

  return (
    <div className="auth-shell">
      <div className="auth-card gate-card">
        <div className="auth-eyebrow">확인 실패</div>
        <h1 className="auth-title">계정을 확인하지 못했습니다</h1>

        <p className="gate-body">
          로그인은 되어 있지만 계정 정보를 읽어 오지 못했습니다. 등록되지 않은 계정이라는 뜻은
          아닙니다. 연결을 확인하고 다시 시도하세요.
        </p>

        <p className="auth-alert auth-alert--error" role="alert">
          {unmapped ? (
            <>
              <strong className="auth-alert__title">처리하지 못한 오류</strong>
              <span className="auth-alert__raw">{message}</span>
            </>
          ) : (
            message
          )}
        </p>

        <div className="gate-actions">
          <button type="button" className="auth-btn auth-btn--primary" onClick={() => void refreshMember()}>
            다시 시도
          </button>
          <button type="button" className="auth-btn auth-btn--quiet" onClick={() => void signOut()}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, member } = useAuth()

  // 1) 저장된 세션을 되살리는 중. 이걸 건너뛰면 새로고침마다 로그인 화면이 깜빡입니다.
  if (loading) return <AuthSplash label="세션 확인 중" />

  // 2) 로그인 전
  if (!session) return <LoginScreen />

  // 3) 세션은 있는데 멤버 조회가 아직. anonymous 는 이펙트가 돌기 직전의 한 프레임입니다.
  if (member.status === 'loading' || member.status === 'anonymous') {
    return <AuthSplash label="계정 확인 중" />
  }

  // 4) 조회 실패 — 미등록과 다릅니다
  if (member.status === 'error') {
    return <MemberLookupFailed message={member.error.message} unmapped={member.error.unmapped} />
  }

  // 5) 화이트리스트 미등록 — 통과시키면 빈 화면이 됩니다
  if (member.status === 'unregistered') return <UnregisteredNotice />

  // 6) 정상
  return <>{children}</>
}

export default AuthGate
