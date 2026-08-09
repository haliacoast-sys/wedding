/**
 * icons.tsx — 하단 네비 아이콘. 전부 손으로 그린 인라인 SVG다.
 *
 * 아이콘 라이브러리를 넣지 않는 이유: 탭 4개에 쓰자고 의존성을 하나 더 늘릴 이유가 없고,
 * 대부분의 라이브러리는 트리셰이킹이 되더라도 런타임 래퍼가 따라온다.
 *
 * 규칙
 *  · viewBox 24×24, fill 은 none, 선은 currentColor → 부모의 color 만 바꾸면 된다.
 *  · stroke-width 는 비활성 1.6 / 활성 2.0. 색뿐 아니라 굵기로도 현재 탭을 구분한다.
 *  · aria-hidden. 의미는 옆의 텍스트 라벨이 전달한다.
 */
import type { ReactNode, SVGProps } from 'react'

type IconProps = { active?: boolean } & Omit<SVGProps<SVGSVGElement>, 'children'>

const Frame = ({ active = false, children, ...rest }: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="23"
    height="23"
    fill="none"
    stroke="currentColor"
    strokeWidth={active ? 2 : 1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
)

/** 홈 — 박공지붕 집 */
export const HomeIcon = (props: IconProps) => (
  <Frame {...props}>
    <path d="M3.2 10.4 12 3.6l8.8 6.8" />
    <path d="M5.6 9.1v10.5a.8.8 0 0 0 .8.8h11.2a.8.8 0 0 0 .8-.8V9.1" />
    <path d="M9.8 20.4v-5.1h4.4v5.1" />
  </Frame>
)

/** 체크리스트 — 클립보드 + 체크 */
export const ChecklistIcon = (props: IconProps) => (
  <Frame {...props}>
    <path d="M9 4.6H6.8A1.6 1.6 0 0 0 5.2 6.2v13.2a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V6.2a1.6 1.6 0 0 0-1.6-1.6H15" />
    <path d="M9.6 3h4.8a.9.9 0 0 1 .9.9v2.3H8.7V3.9a.9.9 0 0 1 .9-.9Z" />
    <path d="m8.9 13.4 2.1 2.1 4.1-4.2" />
  </Frame>
)

/** 가계부 — 카드(결제) */
export const BudgetIcon = (props: IconProps) => (
  <Frame {...props}>
    <path d="M3.4 7.8a1.8 1.8 0 0 1 1.8-1.8h13.6a1.8 1.8 0 0 1 1.8 1.8v8.4a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8Z" />
    <path d="M3.4 10.6h17.2" />
    <path d="M6.6 14.6h3.4" />
  </Frame>
)

/** 당일 — 하루가 표시된 달력 */
export const DayOfIcon = (props: IconProps) => (
  <Frame {...props}>
    <path d="M4 7.4a1.6 1.6 0 0 1 1.6-1.6h12.8A1.6 1.6 0 0 1 20 7.4v11.6a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19V7.4Z" />
    <path d="M4 10.6h16" />
    <path d="M8.4 3.6v3.4M15.6 3.6v3.4" />
    <circle cx="12" cy="15.4" r="1.6" fill="currentColor" stroke="none" />
  </Frame>
)
