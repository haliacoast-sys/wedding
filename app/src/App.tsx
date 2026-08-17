import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import './App.css'

import { AuthProvider, AuthGate, useAuth } from './auth'
import { AppShell, HomeScreen } from './shell'
import type { TabKey } from './shell'

/*
 * 홈을 뺀 세 탭은 지연 로딩한다.
 *
 * 주 사용 환경이 폰이라 첫 로딩이 중요한데, 정적 import 로 두면 로그인 화면을
 * 그리는 데 체크리스트·가계부·당일 코드가 전부 딸려온다(합쳐서 568kB / gzip 160kB).
 * 로그인 직후 보게 되는 건 홈 하나뿐이므로 나머지는 탭을 누를 때 받는다.
 * 각 모듈이 자기 CSS 를 import 하므로 스타일도 같은 청크로 함께 쪼개진다.
 */
const ChecklistTab = lazy(() => import('./screens/ChecklistTab'))
const BudgetTab = lazy(() => import('./budget/BudgetApp'))
const GuestsTab = lazy(() => import('./guests/GuestsApp'))
const DayOfTab = lazy(() => import('./dayof/DayOfApp'))

const TAB_KEYS: readonly TabKey[] = ['home', 'checklist', 'budget', 'guests', 'dayof']

const readTab = (): TabKey => {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return (TAB_KEYS as readonly string[]).includes(raw) ? (raw as TabKey) : 'home'
}

/**
 * 탭 상태를 URL 해시에 둔다. 기존 문서(wedding.html)의 탭 방식과 결이 같고,
 * 무엇보다 안드로이드 뒤로가기 버튼이 동작한다 — 폰에서 쓰는 앱이라 이게 중요하다.
 */
const useHashTab = (): [TabKey, (next: TabKey) => void] => {
  const [tab, setTab] = useState<TabKey>(readTab)

  useEffect(() => {
    const onHashChange = () => setTab(readTab())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: TabKey) => {
    // 같은 해시를 다시 쓰면 hashchange 가 발생하지 않으므로 상태도 함께 세팅한다.
    window.location.hash = `#/${next}`
    setTab(next)
  }, [])

  return [tab, navigate]
}

/** 청크를 받는 동안의 자리표시. 레이아웃이 튀지 않게 높이를 미리 잡아 둔다. */
const TabFallback = () => (
  <div className="app-tabloading" role="status" aria-live="polite">
    불러오는 중…
  </div>
)

/**
 * AuthGate 안쪽. 여기 도달했다는 것은 세션이 있고 allowed_emails 화이트리스트
 * 등록까지 확인됐다는 뜻이라 displayName 은 항상 존재한다.
 */
const Shell = () => {
  const { displayName, signOut } = useAuth()
  const [tab, navigate] = useHashTab()
  const who = displayName ?? ''

  return (
    <AppShell
      displayName={who}
      onSignOut={() => void signOut()}
      active={tab}
      onNavigate={navigate}
    >
      <Suspense fallback={<TabFallback />}>
        {tab === 'home' && <HomeScreen onNavigate={navigate} />}
        {tab === 'checklist' && <ChecklistTab displayName={who} />}
        {tab === 'budget' && <BudgetTab />}
        {tab === 'guests' && <GuestsTab />}
        {tab === 'dayof' && <DayOfTab />}
      </Suspense>
    </AppShell>
  )
}

const App = () => (
  <AuthProvider>
    <AuthGate>
      <Shell />
    </AuthGate>
  </AuthProvider>
)

export default App
