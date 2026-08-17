/**
 * selectors.ts — 집계 계산. 전부 순수 함수이고 정수 덧셈만 쓴다.
 *
 * ── 왜 서버 뷰의 unpaid 를 그대로 쓰지 않는가 ───────────────
 * budget_rollup 의 정의는 `coalesce(contracted,0) - coalesce(paid_sum,0)` 이다.
 * 두 경우에 화면에 쓰기 나쁜 값이 나온다.
 *   ① 계약 전인데 결제부터 한 항목(계약금만 낸 상태) → 음수가 나온다. 그건 '앞으로
 *      받을 돈'이 아니라 '계약금액을 아직 안 적었다'는 뜻이다.
 *   ② 계약금액이 아예 없는 항목 → 0 이 나와서 '다 냈다'와 구별되지 않는다.
 * 그래서 여기서는 계약금액이 없으면 잔금을 null(= 알 수 없음)로 두고, 초과 지급은
 * overpaid 로 따로 뺀다. 합계에 음수가 섞이면 총액이 조용히 줄어드는 게 제일 나쁘다.
 *
 * ── 왜 실지출을 payments 캐시에서 다시 세는가 ────────────────
 * paid_sum 은 서버가 마지막으로 계산해 준 값이다. 결제를 한 줄 추가하면 그 순간
 * 캐시의 paid_sum 은 낡는다. 원장 전체를 이미 들고 있으므로(budgetApi.fetchPayments)
 * 여기서 다시 세면 서버 왕복 없이도 잔금 숫자가 즉시 움직인다.
 * 원장이 아직 도착하지 않았을 때만 뷰의 paid_sum 을 쓴다(첫 페인트용 폴백).
 *
 * ── 계산식 ──────────────────────────────────────────────────
 *   실지출   paid      = Σ payments.amount           (그 항목에 달린 결제)
 *   미지급   unpaid    = max(contracted - paid, 0)   contracted 가 없으면 null
 *   초과지급 overpaid  = max(paid - contracted, 0)
 *   무게     weight    = contracted ?? (paid > 0 ? paid : null) ?? estimate ?? 0
 *                        정렬·비중 막대에 쓰는 '지금 이 항목은 얼마짜리인가'
 *   취소(deal_status = '취소')된 항목은 어떤 합계에도 들어가지 않는다.
 */
import { CANCELLED, UNCATEGORIZED, statusOf } from './types'
import type { BudgetRow, Payment } from './types'
import { daysBetween } from './dates'

/**
 * 이 안에 들어오는 결제 예정일은 '곧 나갈 돈'으로 본다. 여섯 주.
 * 30일로 잡으면 실제 데이터의 한복 정계약 기한(2026-09-30, 오늘 기준 44일)처럼
 * 놓치면 금액이 달라지는 마감이 화면에 안 뜬다. 반대로 90일로 늘리면 예식 반년 전부터
 * 거의 모든 항목이 '임박'이 되어 배지가 의미를 잃는다.
 */
export const DUE_SOON_DAYS = 45

// ── 원장 색인 ────────────────────────────────────────────────

export type PaidStat = { sum: number; count: number }

/**
 * 원장 색인. ready 가 핵심이다.
 *   ready = true  → 원장을 받았다. 색인에 없는 항목은 결제가 0건인 것이다.
 *   ready = false → 아직 못 받았다. 뷰가 준 paid_sum 으로 버틴다.
 * 이 구분이 없으면 마지막 결제를 지웠을 때(색인에서 사라짐) 뷰의 낡은 paid_sum 으로
 * 되돌아가서, 지운 결제가 아직 살아 있는 것처럼 보인다.
 */
export type Ledger = {
  index: Map<string, PaidStat>
  ready: boolean
}

export const emptyLedger: Ledger = { index: new Map(), ready: false }

/** 결제 원장을 budget_item_id 별로 합산한다. 항목에 연결되지 않은 결제는 건너뛴다. */
export const indexPayments = (payments: Payment[]): Ledger => {
  const index = new Map<string, PaidStat>()
  for (const p of payments) {
    if (!p.budget_item_id) continue
    const stat = index.get(p.budget_item_id)
    if (stat) {
      stat.sum += p.amount
      stat.count += 1
    } else {
      index.set(p.budget_item_id, { sum: p.amount, count: 1 })
    }
  }
  return { index, ready: true }
}

/** 항목에 달린 결제만 골라 최근 지급일 순으로. 같은 날이면 나중에 적은 것이 위. */
export const paymentsOf = (payments: Payment[], itemId: string): Payment[] =>
  payments
    .filter((p) => p.budget_item_id === itemId)
    .sort(
      (a, b) =>
        b.paid_on.localeCompare(a.paid_on) ||
        b.created_at.localeCompare(a.created_at) ||
        a.id.localeCompare(b.id),
    )

/** 항목에 연결되지 않은(= 항목이 지워진 뒤 남은) 결제. 합계에서 새는 돈이라 알려 줘야 한다. */
export const orphanPayments = (payments: Payment[]): Payment[] =>
  payments.filter((p) => !p.budget_item_id)

// ── 행 단위 계산 ─────────────────────────────────────────────

export type RowView = {
  row: BudgetRow
  id: string
  status: string
  cancelled: boolean
  contracted: number | null
  estimate: number | null
  /** 실지출 = 원장 합계 */
  paid: number
  paymentCount: number
  /** 미지급 잔금. 계약금액이 없으면 null = 알 수 없음 */
  unpaid: number | null
  /** 계약금액을 넘겨 낸 금액. 보통 0 */
  overpaid: number
  /** 정렬·비중용 '지금 이 항목의 무게' */
  weight: number
  /** 예산과 계약금액의 차이. 둘 다 있을 때만 */
  gap: number | null
  /** 결제 예정일까지 남은 일수. due_on 이 없으면 null */
  dueInDays: number | null
  /** 잔금이 남아 있고 예정일이 코앞이거나 이미 지났다 */
  dueSoon: boolean
  overdue: boolean
}

export const viewOf = (row: BudgetRow, ledger: Ledger, today: string): RowView => {
  const stat = ledger.index.get(row.id)
  // 원장을 받았으면 색인이 진실이다. 아직이면 뷰가 준 값으로 버틴다.
  const paid = ledger.ready ? (stat?.sum ?? 0) : row.paid_sum
  const paymentCount = ledger.ready ? (stat?.count ?? 0) : row.payment_count

  const contracted = row.contracted
  const estimate = row.estimate
  const status = statusOf(row)
  const cancelled = status === CANCELLED

  const unpaid = contracted == null ? null : Math.max(contracted - paid, 0)
  const overpaid = contracted == null ? 0 : Math.max(paid - contracted, 0)
  const weight = contracted ?? (paid > 0 ? paid : null) ?? estimate ?? 0

  const dueInDays = row.due_on ? daysBetween(today, row.due_on) : null
  const owes = !cancelled && (unpaid == null ? false : unpaid > 0)

  return {
    row,
    id: row.id,
    status,
    cancelled,
    contracted,
    estimate,
    paid,
    paymentCount,
    unpaid,
    overpaid,
    weight,
    gap: contracted != null && estimate != null ? contracted - estimate : null,
    dueInDays,
    dueSoon: owes && dueInDays != null && dueInDays >= 0 && dueInDays <= DUE_SOON_DAYS,
    overdue: owes && dueInDays != null && dueInDays < 0,
  }
}

export const viewsOf = (rows: BudgetRow[], ledger: Ledger, today: string): RowView[] =>
  rows.map((row) => viewOf(row, ledger, today))

// ── 전체 집계 ────────────────────────────────────────────────

/**
 * 자금 출처별 조각. 총액보다 이쪽이 급한 숫자다 —
 * 웨딩홀 청구분은 예식 당일 축의금으로 정산하지만, 외부 업체는 예식 전에
 * 우리 현금이 먼저 나간다. 둘을 섞어 보면 실제로 마련해야 할 돈을 알 수 없다.
 */
export type FundingSlice = {
  count: number
  contracted: number
  paid: number
  unpaid: number
}

export type Totals = {
  /** 취소를 뺀 항목 수 */
  count: number
  cancelledCount: number

  /** 계약 총액 = Σ contracted */
  contractedTotal: number
  contractedCount: number
  /** 실지출 = Σ 원장 */
  paidTotal: number
  paymentCount: number
  /** 미지급 잔금 합계 = 앞으로 낼 돈 */
  unpaidTotal: number
  unpaidCount: number
  overpaidTotal: number

  /** 예산 = Σ estimate */
  estimateTotal: number
  /** 아직 계약금액이 없는 항목들의 예산 합. 계약 총액에 앞으로 더해질 몫이다. */
  openEstimate: number
  openCount: number
  /** 예산도 계약금액도 실지출도 없는 항목 수. 0원으로 세고 있으니 밝혀 줘야 한다. */
  unpricedCount: number

  /** 계약금액 − 예산. 둘 다 있는 항목만 센다. */
  gap: number
  gapCount: number

  own: FundingSlice
  gift: FundingSlice

  /** 결제 예정일이 코앞이거나 지난 항목 */
  dueSoonCount: number
  dueSoonAmount: number
  overdueCount: number
  overdueAmount: number
  /** 가장 급한 예정일까지 남은 일수 */
  nextDueInDays: number | null
}

const emptySlice = (): FundingSlice => ({ count: 0, contracted: 0, paid: 0, unpaid: 0 })

export const totalsOf = (views: RowView[]): Totals => {
  const t: Totals = {
    count: 0,
    cancelledCount: 0,
    contractedTotal: 0,
    contractedCount: 0,
    paidTotal: 0,
    paymentCount: 0,
    unpaidTotal: 0,
    unpaidCount: 0,
    overpaidTotal: 0,
    estimateTotal: 0,
    openEstimate: 0,
    openCount: 0,
    unpricedCount: 0,
    gap: 0,
    gapCount: 0,
    own: emptySlice(),
    gift: emptySlice(),
    dueSoonCount: 0,
    dueSoonAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
    nextDueInDays: null,
  }

  for (const v of views) {
    // 취소된 건은 세지 않는다. 계약금액이 적혀 있어도 나갈 돈이 아니다.
    if (v.cancelled) {
      t.cancelledCount += 1
      continue
    }
    t.count += 1

    const slice: FundingSlice = v.row.funding === '축의금' ? t.gift : t.own
    slice.count += 1

    if (v.contracted != null) {
      t.contractedTotal += v.contracted
      t.contractedCount += 1
      slice.contracted += v.contracted
    } else if (v.estimate != null) {
      t.openEstimate += v.estimate
      t.openCount += 1
    }

    t.paidTotal += v.paid
    t.paymentCount += v.paymentCount
    slice.paid += v.paid

    if (v.unpaid != null && v.unpaid > 0) {
      t.unpaidTotal += v.unpaid
      t.unpaidCount += 1
      slice.unpaid += v.unpaid
    }
    t.overpaidTotal += v.overpaid

    if (v.estimate != null) t.estimateTotal += v.estimate
    if (v.estimate == null && v.contracted == null && v.paid === 0) t.unpricedCount += 1

    if (v.gap != null) {
      t.gap += v.gap
      t.gapCount += 1
    }

    if (v.overdue) {
      t.overdueCount += 1
      t.overdueAmount += v.unpaid ?? 0
    } else if (v.dueSoon) {
      t.dueSoonCount += 1
      t.dueSoonAmount += v.unpaid ?? 0
    }

    if ((v.overdue || v.dueSoon) && v.dueInDays != null) {
      t.nextDueInDays = t.nextDueInDays == null ? v.dueInDays : Math.min(t.nextDueInDays, v.dueInDays)
    }
  }

  return t
}

// ── 카테고리별 ───────────────────────────────────────────────

export type CategoryTotal = {
  category: string
  count: number
  weight: number
  contracted: number
  paid: number
  unpaid: number
}

/** 카테고리별 소계. 금액이 큰 순으로 돌려준다(비중 막대가 자연스럽게 내림차순이 된다). */
export const byCategory = (views: RowView[]): CategoryTotal[] => {
  const map = new Map<string, CategoryTotal>()

  for (const v of views) {
    const key = v.row.category?.trim() || UNCATEGORIZED
    let row = map.get(key)
    if (!row) {
      row = { category: key, count: 0, weight: 0, contracted: 0, paid: 0, unpaid: 0 }
      map.set(key, row)
    }
    row.count += 1
    if (v.cancelled) continue
    row.weight += v.weight
    row.contracted += v.contracted ?? 0
    row.paid += v.paid
    row.unpaid += v.unpaid ?? 0
  }

  return [...map.values()].sort(
    (a, b) => b.weight - a.weight || a.category.localeCompare(b.category, 'ko'),
  )
}

/**
 * 비중(%). 화면에 그리는 값일 뿐 금액 계산에 되먹이지 않으므로 나눗셈을 써도 된다.
 * 정수 퍼센트로 반올림한다.
 */
export const sharePercent = (part: number, total: number): number =>
  total > 0 ? Math.round((part * 100) / total) : 0

// ── 거르기 · 줄 세우기 ───────────────────────────────────────

export type Filter = {
  category: string | null
  /** 잔금이 남은 항목만 */
  unpaidOnly: boolean
  /** 결제 예정일이 코앞이거나 지난 항목만 */
  dueOnly: boolean
}

export const filterViews = (views: RowView[], filter: Filter): RowView[] =>
  views.filter((v) => {
    if (filter.unpaidOnly && !(v.unpaid != null && v.unpaid > 0 && !v.cancelled)) return false
    if (filter.dueOnly && !(v.dueSoon || v.overdue)) return false
    if (filter.category == null) return true
    return (v.row.category?.trim() || UNCATEGORIZED) === filter.category
  })

export type SortMode = 'unpaid' | 'due' | 'recent'

export const SORT_LABEL: Record<SortMode, string> = {
  unpaid: '잔금 큰 순',
  due: '예정일 순',
  recent: '최근 추가 순',
}

export const nextSort = (mode: SortMode): SortMode =>
  mode === 'unpaid' ? 'due' : mode === 'due' ? 'recent' : 'unpaid'

/**
 * 정렬. 동점일 때 created_at 으로 한 번 더 갈라 두지 않으면 금액이 같은 항목들의
 * 순서가 리렌더마다 흔들려서 탭하려던 줄이 다른 줄로 바뀐다.
 *
 * 취소된 항목은 어느 정렬에서든 맨 뒤로 보낸다. 목록 한가운데 있으면
 * 남은 잔금이 있는 줄처럼 보인다.
 */
export const sortViews = (views: RowView[], mode: SortMode): RowView[] => {
  const copy = views.slice()
  copy.sort((a, b) => {
    if (a.cancelled !== b.cancelled) return a.cancelled ? 1 : -1

    if (mode === 'unpaid') {
      // 잔금이 남은 것이 먼저, 그 안에서 큰 순. 잔금이 없으면 무게로 줄을 세운다.
      const diff = (b.unpaid ?? -1) - (a.unpaid ?? -1)
      if (diff !== 0) return diff
      const weight = b.weight - a.weight
      if (weight !== 0) return weight
    }

    if (mode === 'due') {
      // 예정일이 있는 것이 먼저(지난 것 → 임박 순), 없는 것은 뒤로.
      const av = a.dueInDays
      const bv = b.dueInDays
      if (av == null && bv != null) return 1
      if (av != null && bv == null) return -1
      if (av != null && bv != null && av !== bv) return av - bv
      const weight = b.weight - a.weight
      if (weight !== 0) return weight
    }

    const created = b.row.created_at.localeCompare(a.row.created_at)
    if (created !== 0) return created
    return a.id.localeCompare(b.id)
  })
  return copy
}
