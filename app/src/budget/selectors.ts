/**
 * selectors.ts — 집계 계산. 전부 순수 함수이고 정수 덧셈만 쓴다.
 *
 * 계산식을 여기 한 번에 적어 둔다. 화면 여러 곳에서 같은 수를 다르게 세면
 * 사용자가 제일 먼저 눈치챈다.
 *
 *   총 견적   estimateTotal = Σ estimate            (미입력은 0으로 세지 않고 건너뛴다)
 *   총 실제   actualTotal   = Σ actual
 *   예상 최종 projected     = Σ (actual ?? estimate) — 실제가 들어온 항목은 실제로,
 *                            아직 안 들어온 항목은 견적으로 잡은 '지금 시점의 예상 총액'
 *   결제 완료 paid          = Σ (actual ?? estimate) where paid_at is not null
 *   미결제   unpaid        = projected - paid
 *   차액     diff          = Σ (actual - estimate)  단, 둘 다 들어온 항목만
 *
 * 차액을 굳이 '둘 다 들어온 항목만'으로 좁힌 이유:
 *   단순히 actualTotal - estimateTotal 로 하면, 아직 결제하지 않아 실제가 비어 있는
 *   항목들 때문에 항상 큰 폭의 '절감'처럼 보인다. 그건 절감이 아니라 미기록이다.
 *   비교가 성립하는 항목만 세고, 그 개수(diffCount)를 화면에 같이 적어 근거를 밝힌다.
 */
import { UNCATEGORIZED } from './types'
import type { BudgetItem } from './types'

export type Totals = {
  count: number
  estimateTotal: number
  actualTotal: number
  projected: number
  paid: number
  unpaid: number
  paidCount: number
  unpaidCount: number
  diff: number
  /** 견적·실제가 모두 있어 차액 계산에 들어간 항목 수 */
  diffCount: number
  /** 견적도 실제도 없는 항목 수. 합계에 0원으로 들어가 있으므로 따로 알려 줘야 한다. */
  unpricedCount: number
  /**
   * 자금 출처별 분리. 총액보다 이쪽이 급한 숫자다 —
   * 웨딩홀 청구분은 예식 당일 축의금으로 정산하지만, 외부 업체는 예식 전에
   * 우리 현금이 먼저 나간다. 둘을 섞어 보면 실제로 마련해야 할 돈을 알 수 없다.
   */
  ownCash: number
  /** 선지출 중 아직 결제하지 않은 금액. 앞으로 실제로 준비해야 하는 현금이다. */
  ownCashRemaining: number
  giftMoney: number
}

/** 그 항목이 지금 시점에 '얼마짜리'인지. 실제가 있으면 실제, 없으면 견적. */
export const effectiveWon = (item: BudgetItem): number => item.actual ?? item.estimate ?? 0

export const totalsOf = (items: BudgetItem[]): Totals => {
  const t: Totals = {
    count: items.length,
    estimateTotal: 0,
    actualTotal: 0,
    projected: 0,
    paid: 0,
    unpaid: 0,
    paidCount: 0,
    unpaidCount: 0,
    diff: 0,
    diffCount: 0,
    unpricedCount: 0,
    ownCash: 0,
    ownCashRemaining: 0,
    giftMoney: 0,
  }

  for (const item of items) {
    if (item.estimate != null) t.estimateTotal += item.estimate
    if (item.actual != null) t.actualTotal += item.actual
    if (item.estimate == null && item.actual == null) t.unpricedCount += 1

    const eff = effectiveWon(item)
    t.projected += eff

    if (item.paid_at) {
      t.paid += eff
      t.paidCount += 1
    } else {
      t.unpaid += eff
      t.unpaidCount += 1
    }

    if (item.funding === '축의금') {
      t.giftMoney += eff
    } else {
      t.ownCash += eff
      // 이미 결제한 것은 앞으로 마련할 돈이 아니다.
      if (!item.paid_at) t.ownCashRemaining += eff
    }

    if (item.actual != null && item.estimate != null) {
      t.diff += item.actual - item.estimate
      t.diffCount += 1
    }
  }

  return t
}

export type CategoryTotal = {
  category: string
  count: number
  projected: number
  estimateTotal: number
  actualTotal: number
  paid: number
}

/** 카테고리별 소계. 금액이 큰 순으로 돌려준다(비중 막대가 자연스럽게 내림차순이 된다). */
export const byCategory = (items: BudgetItem[]): CategoryTotal[] => {
  const map = new Map<string, CategoryTotal>()

  for (const item of items) {
    const key = item.category?.trim() || UNCATEGORIZED
    let row = map.get(key)
    if (!row) {
      row = { category: key, count: 0, projected: 0, estimateTotal: 0, actualTotal: 0, paid: 0 }
      map.set(key, row)
    }
    row.count += 1
    row.projected += effectiveWon(item)
    if (item.estimate != null) row.estimateTotal += item.estimate
    if (item.actual != null) row.actualTotal += item.actual
    if (item.paid_at) row.paid += effectiveWon(item)
  }

  return [...map.values()].sort(
    (a, b) => b.projected - a.projected || a.category.localeCompare(b.category, 'ko'),
  )
}

/**
 * 비중(%). 화면에 그리는 값일 뿐 금액 계산에 되먹이지 않으므로 나눗셈을 써도 된다.
 * 정수 퍼센트로 반올림한다.
 */
export const sharePercent = (part: number, total: number): number =>
  total > 0 ? Math.round((part * 100) / total) : 0

/** 카테고리 목록(필터 칩용). 항목이 많은 순서가 아니라 금액 큰 순서. */
export const categoryNames = (items: BudgetItem[]): string[] =>
  byCategory(items).map((c) => c.category)

export type SortMode = 'amount' | 'recent'

export type Filter = {
  category: string | null
  unpaidOnly: boolean
}

export const filterItems = (items: BudgetItem[], filter: Filter): BudgetItem[] =>
  items.filter((item) => {
    if (filter.unpaidOnly && item.paid_at) return false
    if (filter.category == null) return true
    return (item.category?.trim() || UNCATEGORIZED) === filter.category
  })

/**
 * 정렬. 동점일 때 created_at 으로 한 번 더 갈라 두지 않으면 금액이 같은 항목들의
 * 순서가 리렌더마다 흔들려서 탭하려던 줄이 다른 줄로 바뀐다.
 */
export const sortItems = (items: BudgetItem[], mode: SortMode): BudgetItem[] => {
  const copy = items.slice()
  copy.sort((a, b) => {
    if (mode === 'amount') {
      const diff = effectiveWon(b) - effectiveWon(a)
      if (diff !== 0) return diff
    }
    const created = b.created_at.localeCompare(a.created_at)
    if (created !== 0) return created
    return a.id.localeCompare(b.id)
  })
  return copy
}
