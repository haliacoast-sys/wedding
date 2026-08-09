/**
 * ItemRow.tsx — 목록 한 줄.
 *
 * 줄 전체가 버튼이다. 탭하면 아래로 편집기가 열린다. 편집 아이콘을 따로 두면
 * 폰에서 조준해야 할 목표가 하나 더 생기고, 그 아이콘은 44px 을 지키기 어렵다.
 *
 * 오른쪽에 큰 숫자 하나만 둔다. 실제가 있으면 실제, 없으면 견적이며
 * 견적일 때만 '예상' 표시를 붙인다. 두 숫자를 같은 크기로 나란히 두면
 * 어느 쪽이 진짜 나간 돈인지 매번 다시 읽어야 한다.
 */
import { shortDate } from './dates'
import { formatSignedWon, formatWon } from './money'
import type { BudgetItem } from './types'

export type ItemRowProps = {
  item: BudgetItem
  vendorName?: string
  expanded: boolean
  onToggle: () => void
}

export const ItemRow = ({ item, vendorName, expanded, onToggle }: ItemRowProps) => {
  const hasActual = item.actual != null
  const amount = item.actual ?? item.estimate
  const delta = hasActual && item.estimate != null ? item.actual! - item.estimate : null

  return (
    <button
      type="button"
      className="bd-row"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <span className="bd-row__main">
        <span className="bd-row__label">{item.label}</span>
        <span className="bd-row__meta">
          {item.category?.trim() && <span className="bd-tag">{item.category.trim()}</span>}
          {vendorName && <span className="bd-row__vendor">{vendorName}</span>}
          {item.paid_at ? (
            <span className="bd-row__paid">{shortDate(item.paid_at)} 결제완료</span>
          ) : (
            <span className="bd-row__due">미결제</span>
          )}
        </span>
      </span>

      <span className="bd-row__nums">
        <span className={hasActual ? 'bd-amt' : 'bd-amt bd-amt--est'}>
          {amount == null ? '금액 미정' : formatWon(amount)}
          {!hasActual && amount != null && <i className="bd-amt__mark">예상</i>}
        </span>
        {hasActual && item.estimate != null && (
          <span className="bd-row__sub">
            견적 {formatWon(item.estimate)}
            <b className={delta! > 0 ? 'bd-delta bd-delta--over' : 'bd-delta bd-delta--under'}>
              {delta === 0 ? '± 0' : formatSignedWon(delta!)}
            </b>
          </span>
        )}
        {hasActual && item.estimate == null && <span className="bd-row__sub">견적 없음</span>}
        {!hasActual && item.estimate != null && <span className="bd-row__sub">실제 미입력</span>}

        {/* 시세는 견적(=업체가 부른 값)과 비교한다. 실제 지출과 비교하면
            "얼마에 계약했어야 했나"가 아니라 "얼마 썼나"가 되어 판단에 쓸 수 없다.
            차액이 양수면 시세보다 비싸게 부른 것이므로 초과와 같은 색을 쓴다. */}
        {item.market_avg != null && (
          <span className="bd-row__sub bd-row__market">
            시세 {formatWon(item.market_avg)}
            {item.estimate != null && item.estimate !== item.market_avg && (
              <b
                className={
                  item.estimate > item.market_avg
                    ? 'bd-delta bd-delta--over'
                    : 'bd-delta bd-delta--under'
                }
              >
                {formatSignedWon(item.estimate - item.market_avg)}
              </b>
            )}
            {item.estimate != null && item.estimate === item.market_avg && (
              <b className="bd-delta">시세와 같음</b>
            )}
          </span>
        )}
      </span>
    </button>
  )
}
