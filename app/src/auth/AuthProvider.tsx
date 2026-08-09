/* ============================================================
   AuthProvider.tsx — 세션 · 멤버 상태의 단일 출처

   두 가지를 분리해서 관리합니다.

     1) 세션(session)  — Supabase Auth 에 로그인했는가.
     2) 멤버(member)   — 그 계정이 allowed_emails 화이트리스트에 들어 있는가.

   이 앱에서 둘은 같지 않습니다. 화이트리스트에 없는 아이디로도 가입과 로그인은
   "성공"합니다. 다만 handle_new_user() 트리거가 members 에 행을 만들지 않고,
   모든 RLS 정책이 is_member() 를 통과하지 못해 tasks/budget_items/vendors 가
   전부 0행으로 보입니다. 화면은 멀쩡한데 내용만 텅 빕니다.

   그래서 members 를 한 번 조회해서 그 상태를 따로 노출합니다.
   조회가 0행이면 곧 "화이트리스트 미등록"입니다. (본인 행은 RLS 상 보입니다.)
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { translateError } from './errors'
import type { TranslatedError } from './errors'

/**
 * 멤버 조회 상태.
 *
 * - anonymous    : 로그인하지 않음(조회할 대상이 없음)
 * - loading      : 조회 중
 * - member       : 화이트리스트 등록 완료. 데이터가 정상적으로 보이는 유일한 상태
 * - unregistered : 로그인은 됐지만 members 에 행이 없음 → 데이터가 0행으로 보임
 * - error        : 조회 자체가 실패(네트워크·권한 등). unregistered 와 구분해야
 *                  "네트워크가 끊긴 것"과 "계정이 등록 안 된 것"을 혼동하지 않습니다
 */
export type MemberState =
  | { status: 'anonymous' }
  | { status: 'loading' }
  | { status: 'member'; displayName: string }
  | { status: 'unregistered' }
  | { status: 'error'; error: TranslatedError }

export interface AuthContextValue {
  /**
   * 최초 세션 복구가 끝나기 전까지 true.
   * 이 값을 보지 않고 session 만 보면 새로고침할 때마다 로그인 화면이 한 번
   * 깜빡였다가 사라집니다. 게이트에서 반드시 먼저 확인하세요.
   *
   * 주의: 멤버 조회는 포함하지 않습니다. 멤버 쪽은 member.status 로 판단하세요.
   */
  loading: boolean
  /** 현재 세션. 없으면 null. */
  session: Session | null
  /** session.user 의 단축. */
  user: User | null
  /** 로그인에 쓴 아이디(합성 이메일에서 @ 앞부분). 예: juho */
  username: string | null
  /** 멤버 조회 상태. 화이트리스트 미등록 판별용. */
  member: MemberState
  /** members.display_name. 예: 주호. 등록 전이면 null. */
  displayName: string | null
  /** 화이트리스트 등록이 확인된 상태(= 데이터가 보이는 상태). */
  isMember: boolean
  /** 로그인은 됐지만 화이트리스트에 없는 상태. */
  isUnregistered: boolean
  /** members 를 다시 조회합니다(대시보드에서 화이트리스트를 고친 뒤 등). */
  refreshMember: () => Promise<void>
  /** 로그아웃. 서버 세션이 이미 사라졌어도 로컬 저장소는 반드시 비웁니다. */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** juho@wedding.local → juho */
function usernameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  return at === -1 ? email : email.slice(0, at)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<MemberState>({ status: 'anonymous' })

  /* ── 1. 세션 복구 + 변화 구독 ────────────────────────────── */
  useEffect(() => {
    let active = true

    // 새로고침 직후 localStorage 에 남아 있는 세션을 되살립니다.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .catch(() => {
        // 저장된 세션이 깨진 경우. 로그인 화면으로 보내면 됩니다.
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // 로그인·로그아웃·토큰 갱신을 모두 여기서 받습니다.
    // 콜백 안에서 다른 supabase 호출을 await 하면 내부 락과 엉킬 수 있으므로
    // 여기서는 상태만 바꾸고, 실제 조회는 아래 2번 이펙트가 담당합니다.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      // 언마운트 시 구독 해제 — 빠뜨리면 HMR·재마운트마다 리스너가 쌓입니다.
      data.subscription.unsubscribe()
    }
  }, [])

  /* ── 2. 멤버 조회 ────────────────────────────────────────── */

  const userId = session?.user.id ?? null

  // 응답이 도착했을 때 그 요청이 아직 유효한지 판별하는 표.
  // 계정을 바꿔 로그인하면 늦게 온 이전 응답이 새 상태를 덮어쓸 수 있습니다.
  const ticketRef = useRef(0)

  const loadMember = useCallback(async (id: string | null): Promise<void> => {
    const ticket = ++ticketRef.current

    if (!id) {
      setMember({ status: 'anonymous' })
      return
    }

    setMember({ status: 'loading' })

    try {
      const { data, error } = await supabase
        .from('members')
        .select('display_name')
        .eq('id', id)
        .maybeSingle()

      if (ticket !== ticketRef.current) return // 더 최신 요청이 있음 → 결과 폐기

      if (error) {
        setMember({ status: 'error', error: translateError(error, 'session') })
        return
      }
      if (!data) {
        // 오류 없이 0행 = RLS 가 막았다 = members 에 내 행이 없다
        //                = allowed_emails 화이트리스트에 없다.
        setMember({ status: 'unregistered' })
        return
      }
      setMember({ status: 'member', displayName: data.display_name })
    } catch (caught) {
      if (ticket !== ticketRef.current) return
      setMember({ status: 'error', error: translateError(caught, 'session') })
    }
  }, [])

  useEffect(() => {
    void loadMember(userId)
    // 언마운트하거나 계정이 바뀌면 진행 중이던 응답을 무효로 만듭니다.
    return () => {
      ticketRef.current += 1
    }
  }, [userId, loadMember])

  const refreshMember = useCallback(() => loadMember(userId), [loadMember, userId])

  /* ── 3. 로그아웃 ─────────────────────────────────────────── */

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut()
    if (!error) return
    // 서버 세션이 이미 없어진 경우(403 session_not_found) 등 — 그래도 기기에서는
    // 나가야 합니다. scope:'local' 은 서버를 부르지 않고 저장소만 비웁니다.
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // 여기서 더 할 수 있는 일이 없습니다. 상태는 onAuthStateChange 가 정리합니다.
    }
  }, [])

  /* ── 4. 컨텍스트 값 ──────────────────────────────────────── */

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    return {
      loading,
      session,
      user,
      username: usernameFromEmail(user?.email),
      member,
      displayName: member.status === 'member' ? member.displayName : null,
      isMember: member.status === 'member',
      isUnregistered: member.status === 'unregistered',
      refreshMember,
      signOut,
    }
  }, [loading, session, member, refreshMember, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/*
 * 아래 훅은 컴포넌트가 아니어서 react/only-export-components 가 경고합니다
 * (이 파일을 고칠 때 Fast Refresh 대신 전체 새로고침이 돕니다).
 * 그래도 Provider 와 같은 파일에 두는 쪽을 택했습니다. 컨텍스트 정의·주입·소비가
 * 흩어지지 않는 편이 읽기 쉽고, 인증 파일은 자주 고치는 파일이 아닙니다.
 */
/**
 * 세션·멤버 상태를 읽습니다. <AuthProvider> 안에서만 쓸 수 있습니다.
 *
 * Provider 밖에서 부르면 undefined 를 받아 나중에 엉뚱한 곳에서 터지는 대신
 * 여기서 바로 원인을 말하고 멈춥니다.
 */
// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error(
      'useAuth() 는 <AuthProvider> 안에서만 쓸 수 있습니다. ' +
        'App.tsx 에서 트리 전체를 <AuthProvider> 로 감쌌는지 확인하세요.',
    )
  }
  return context
}
