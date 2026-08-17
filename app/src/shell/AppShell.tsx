/**
 * AppShell.tsx — 앱의 껍데기. 얇은 상단 헤더 + 하단 고정 네비게이션.
 *
 * 이 파일이 아는 것은 '탭 다섯 개'와 '지금 어느 탭인가' 뿐이다.
 * 각 탭에 무엇을 그릴지는 children 으로 받는다. 그래서 여기서
 * checklist/budget/guests/dayof 폴더를 import 하지 않는다(그 폴더들은 다른 사람이 만든다).
 *
 * ── 헤더를 fixed/sticky 로 두지 않은 이유 ──────────────────────
 * 다른 화면들이 이미 `position: sticky; top: 0` 인 툴바를 갖고 있다
 * (예: checklist 의 필터 칩 줄, z-index 30). 셸이 상단을 점유하면 그 툴바가
 * 헤더 뒤로 들어가 글자가 겹친다. 셸은 화면마다 다른 내부 사정을 알 수 없으므로
 * 상단은 비워 두고, 헤더는 그냥 문서 흐름에 두어 스크롤과 함께 올라가게 했다.
 * 결과적으로 세로 공간을 상시 점유하는 것은 하단 네비 하나뿐이다.
 * 헤더로 돌아가려면 현재 탭을 한 번 더 누르면 맨 위로 스크롤된다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { BudgetIcon, ChecklistIcon, DayOfIcon, GuestsIcon, HomeIcon } from './icons'
import './shell.css'

export type TabKey = 'home' | 'checklist' | 'budget' | 'guests' | 'dayof'

type TabDef = {
  key: TabKey
  label: string
  Icon: (props: { active?: boolean }) => ReactElement
}

/**
 * 순서는 '지금 얼마나 자주 여는가' 순이고, 뒤로 갈수록 예식일에 가까워진다.
 *
 *   홈        매번 처음 보는 화면이라 고정 1번.
 *   체크리스트 준비 기간 내내 매일 여는 화면.
 *   가계부     계약·결제가 붙을 때마다 연다. 체크리스트 다음으로 잦다.
 *   하객       명단은 지금부터 쌓지만 실제로 붙어 있게 되는 건 청첩장 이후다.
 *   당일       예식 당일에만 쓴다. 그래서 맨 끝.
 *
 * 하객을 당일 앞에 끼워 넣은 덕에 기존 세 탭의 위치가 그대로 유지된다.
 * 이미 손가락이 기억하고 있는 자리를 흔들지 않는 편이 낫다.
 */
const TABS: TabDef[] = [
  { key: 'home', label: '홈', Icon: HomeIcon },
  { key: 'checklist', label: '체크리스트', Icon: ChecklistIcon },
  { key: 'budget', label: '가계부', Icon: BudgetIcon },
  { key: 'guests', label: '하객', Icon: GuestsIcon },
  { key: 'dayof', label: '당일', Icon: DayOfIcon },
]

/** 복원 시도를 몇 프레임까지 이어갈지. 60fps 기준 약 0.5초. */
const RESTORE_FRAMES = 30

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function AppShell(props: {
  displayName: string
  onSignOut: () => void
  active: TabKey
  onNavigate: (key: TabKey) => void
  children: ReactNode
}): ReactElement {
  const { displayName, onSignOut, active, onNavigate, children } = props

  /* ── 탭별 스크롤 위치 보존 ────────────────────────────────────
     children 은 활성 탭 것만 들어온다(비활성 탭은 언마운트된다).
     그래서 DOM 을 숨겨두는 방식은 쓸 수 없고, 위치를 숫자로 기억했다가
     탭이 바뀐 뒤 되감는다.

     되감기를 한 프레임에 끝내지 않는 이유:
     새 탭의 내용은 대개 서버 응답을 기다리는 중이라 문서가 아직 짧다.
     scrollTo(0, 900) 를 불러도 문서 높이가 400 이면 400 까지만 간다.
     그래서 문서가 목표 높이에 도달하거나 시간이 다 될 때까지 매 프레임 다시 민다.
     그 사이 사용자가 직접 스크롤하면 즉시 손을 뗀다(아래 cancel 리스너). */
  const positions = useRef<Partial<Record<TabKey, number>>>({})
  const activeRef = useRef<TabKey>(active)
  const rafRef = useRef<number>(0)

  const stopRestore = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  // 스크롤할 때마다 현재 탭의 위치를 갱신한다. rAF 로 한 프레임에 한 번만 읽는다.
  useEffect(() => {
    let queued = false
    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        positions.current[activeRef.current] = window.scrollY
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 사용자가 직접 스크롤을 시작하면 복원을 포기한다. 손가락과 싸우지 않는다.
  useEffect(() => {
    const events: (keyof WindowEventMap)[] = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    for (const name of events) window.addEventListener(name, stopRestore, { passive: true })
    return () => {
      for (const name of events) window.removeEventListener(name, stopRestore)
      stopRestore()
    }
  }, [stopRestore])

  useLayoutEffect(() => {
    // 첫 렌더에서는 activeRef 와 active 가 같다 → 복원할 것이 없다(문서는 맨 위).
    if (activeRef.current === active) return
    activeRef.current = active
    stopRestore()

    const target = positions.current[active] ?? 0
    if (target <= 0) {
      window.scrollTo(0, 0)
      return
    }

    let frames = 0
    const step = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, Math.max(0, Math.min(target, max)))
      frames += 1
      if (max >= target || frames >= RESTORE_FRAMES) {
        rafRef.current = 0
        return
      }
      rafRef.current = requestAnimationFrame(step)
    }
    step()

    return stopRestore
  }, [active, stopRestore])

  const handleTab = (key: TabKey) => {
    if (key === active) {
      // 활성 탭을 다시 누르면 맨 위로. 모바일에서 익숙한 동작이고,
      // 흐름에 있는 헤더(로그아웃)로 돌아가는 길이기도 하다.
      stopRestore()
      positions.current[key] = 0
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      return
    }
    // 리스너가 이미 기록하고 있지만, 전환 직전 값을 한 번 더 확정해 둔다.
    positions.current[active] = window.scrollY
    onNavigate(key)
  }

  return (
    <div className="sh-shell">
      <header className="sh-header">
        <div className="sh-header__inner">
          <span className="sh-header__brand">이주호 · 송지영</span>
          <span className="sh-header__who">{displayName}</span>
          <button type="button" className="sh-signout" onClick={onSignOut}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="sh-main">{children}</main>

      <nav className="sh-nav" aria-label="주요 화면">
        <ul className="sh-nav__list">
          {TABS.map(({ key, label, Icon }) => {
            const isActive = key === active
            return (
              <li key={key}>
                <button
                  type="button"
                  className="sh-tab"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleTab(key)}
                >
                  <span className="sh-tab__icon">
                    <Icon active={isActive} />
                  </span>
                  <span className="sh-tab__label">{label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
