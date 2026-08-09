/**
 * ChecklistApp.tsx — 체크리스트 모듈의 유일한 진입점.
 *
 * 통합 담당은 이렇게만 부른다:
 *   <ChecklistApp displayName="주호" onSignOut={() => {}} />
 *
 * 이 컴포넌트는 인증 상태를 스스로 조회하지 않는다. 표시 이름과 로그아웃 동작은
 * 전부 props 로 받는다. QueryClientProvider 도 상위에서 감싸는 것을 전제로 한다.
 *
 * 탭 구조에 대해:
 *   지금은 탭이 하나뿐이라 탭 바를 그리지 않는다(하나짜리 탭 바는 의미가 없다).
 *   나중에 예산(budget_items)이나 업체(vendors)를 붙일 때는 아래 TABS 배열에
 *   { id, label, render } 를 하나 더 넣기만 하면 탭 바가 자동으로 나타난다.
 *   ChecklistScreen 은 자기 필터·데이터를 스스로 들고 있으므로 다른 탭과 상태가 얽히지 않는다.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import './checklist.css'
import { ChecklistScreen } from './ChecklistScreen'
import { WEDDING_DATE, ddayLabel, longDate } from './dates'

export type ChecklistAppProps = {
  /** 로그인한 사람의 표시 이름. '주호' 같은 값이면 담당자 기본값으로도 쓰인다. */
  displayName: string
  /** 헤더의 로그아웃 버튼이 호출한다. 세션 종료는 호출자 책임. */
  onSignOut: () => void
}

type TabDef = {
  id: string
  label: string
  render: (props: ChecklistAppProps) => ReactNode
}

const TABS: TabDef[] = [
  {
    id: 'checklist',
    label: '체크리스트',
    render: ({ displayName }) => <ChecklistScreen displayName={displayName} />,
  },
  // 예: { id: 'budget', label: '예산', render: () => <BudgetScreen /> },
]

export const ChecklistApp = (props: ChecklistAppProps) => {
  const { displayName, onSignOut } = props
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <div className="ck-app">
      <header className="ck-hero">
        <div className="ck-hero__eyebrow">Wedding Checklist</div>
        <h1 className="ck-hero__title">결혼 준비</h1>
        <div className="ck-hero__dday">
          <b>{ddayLabel(WEDDING_DATE)}</b>
          <span>{longDate(WEDDING_DATE)} 예식</span>
        </div>
        {displayName && <div className="ck-hero__who">{displayName} 님으로 로그인</div>}
        <button type="button" className="ck-ghostbtn" onClick={onSignOut}>
          로그아웃
        </button>
      </header>

      {TABS.length > 1 && (
        <div className="ck-sticky">
          <div className="ck-chiprow" role="tablist" aria-label="화면 전환">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className="ck-chip"
                aria-selected={t.id === tab.id}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab.render(props)}

      <footer className="ck-footnote">
        D-day 는 예식일 {WEDDING_DATE} 기준입니다. 체크 상태는 두 사람의 화면에 실시간으로
        공유됩니다.
      </footer>
    </div>
  )
}

export default ChecklistApp
