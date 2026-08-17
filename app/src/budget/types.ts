/**
 * types.ts — 예산 모듈이 쓰는 타입과 상수.
 *
 * 행 타입은 전부 lib/database.types.ts 에서 파생시킨다. 손으로 다시 적으면
 * 스키마가 바뀌었을 때 컴파일이 통과해 버려서 틀린 걸 알 수 없다.
 *
 * ── 돈의 세 단계 ────────────────────────────────────────────
 *   estimate   예산      잡아둔 돈
 *   contracted 계약금액  업체와 확정한 금액
 *   payments   실지출    결제 원장의 합계 (budget_items.actual 한 칸이 아니다)
 *
 *   미지급 잔금 = contracted − 실지출   ← 앞으로 낼 돈. 이 화면의 주인공이다.
 *
 * ── 읽기와 쓰기의 출처가 다르다 ─────────────────────────────
 *   읽기: budget_rollup 뷰 (budget_items + paid_sum + unpaid + payment_count)
 *   쓰기: budget_items 테이블 (뷰는 쓸 수 없다)
 *
 *   뷰의 컬럼은 생성기가 전부 nullable 로 뽑는다(left join 이 섞여 있으니 당연하다).
 *   그대로 화면까지 끌고 가면 `label` 하나 찍을 때마다 null 검사를 하게 되므로,
 *   fromRollup() 에서 한 번만 테이블의 실제 제약대로 좁힌다.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types'

export type BudgetItem = Tables<'budget_items'>
export type BudgetItemInsert = TablesInsert<'budget_items'>
export type BudgetItemUpdate = TablesUpdate<'budget_items'>

/** budget_rollup 뷰의 원본 행. 화면에서 직접 쓰지 않는다 — fromRollup() 을 거친다. */
export type RollupRow = Tables<'budget_rollup'>

export type Payment = Tables<'payments'>
export type PaymentInsert = TablesInsert<'payments'>
export type PaymentUpdate = TablesUpdate<'payments'>

export type Vendor = Tables<'vendors'>
export type VendorInsert = TablesInsert<'vendors'>

export type Funding = BudgetItem['funding']
export type Owner = BudgetItem['owner']

/**
 * 화면이 다루는 행. budget_items 의 모든 컬럼 + 원장 집계 두 개.
 * paid_sum / payment_count 는 '서버가 마지막으로 알려 준 값'이다. 실제 표시는
 * payments 캐시로 다시 계산한다(selectors.viewOf). 이유는 selectors.ts 주석 참고.
 */
export type BudgetRow = BudgetItem & {
  paid_sum: number
  payment_count: number
}

/** id 가 반드시 있는 insert 행. 낙관적 삽입과 Realtime 메아리를 같은 행으로 맞추기 위해 필요하다. */
export type ItemInsertRow = BudgetItemInsert & { id: string }
export type PaymentInsertRow = PaymentInsert & { id: string }

/** created_at 이 비어 있는 행이 정렬 비교에 들어가도 터지지 않게 하는 바닥값. */
const EPOCH = '1970-01-01T00:00:00.000Z'

/**
 * 뷰 행 → 화면 행. id·label 이 없는 행은 있을 수 없지만(둘 다 NOT NULL 컬럼),
 * 타입상 가능하므로 조용히 버린다. 여기서 예외를 던지면 행 하나 때문에 화면 전체가 죽는다.
 */
export const fromRollup = (r: RollupRow): BudgetRow | null => {
  if (r.id == null || r.label == null) return null
  return {
    id: r.id,
    label: r.label,
    category: r.category,
    estimate: r.estimate,
    contracted: r.contracted,
    actual: r.actual,
    paid_at: r.paid_at,
    due_on: r.due_on,
    deal_status: r.deal_status,
    owner: r.owner,
    vendor_id: r.vendor_id,
    vendor_name: r.vendor_name,
    vendor_contact: r.vendor_contact,
    memo: r.memo,
    market_avg: r.market_avg,
    market_note: r.market_note,
    funding: r.funding ?? '선지출',
    sort_order: r.sort_order ?? 0,
    created_at: r.created_at ?? EPOCH,
    updated_at: r.updated_at ?? EPOCH,
    paid_sum: r.paid_sum ?? 0,
    payment_count: r.payment_count ?? 0,
  }
}

// ── 항목 초안 ────────────────────────────────────────────────

/**
 * 편집 중인 초안. 서버로 가기 전 단계라 금액은 비어 있을 수 있다(= null).
 * 금액은 언제나 원 단위 정수이며 이 타입 어디에도 문자열 금액은 없다.
 *
 * actual · paid_at 은 일부러 없다. 실지출은 이제 payments 원장이 맡는다.
 * (기존 데이터에 남아 있는 값은 ItemEditor 가 읽기 전용으로만 보여 준다.)
 */
export type ItemDraft = {
  label: string
  category: string
  estimate: number | null
  contracted: number | null
  due_on: string | null
  deal_status: string
  vendor_name: string
  vendor_contact: string
  vendor_id: string | null
  owner: Owner
  funding: Funding
  memo: string
}

export const emptyDraft = (category = ''): ItemDraft => ({
  label: '',
  category,
  estimate: null,
  contracted: null,
  due_on: null,
  deal_status: '',
  vendor_name: '',
  vendor_contact: '',
  vendor_id: null,
  owner: null,
  funding: '선지출',
  memo: '',
})

export const draftOf = (item: BudgetRow): ItemDraft => ({
  label: item.label,
  category: item.category ?? '',
  estimate: item.estimate,
  contracted: item.contracted,
  due_on: item.due_on,
  deal_status: item.deal_status ?? '',
  vendor_name: item.vendor_name ?? '',
  vendor_contact: item.vendor_contact ?? '',
  vendor_id: item.vendor_id,
  owner: item.owner,
  funding: item.funding,
  memo: item.memo ?? '',
})

// ── 결제 초안 ────────────────────────────────────────────────

export type PaymentDraft = {
  paid_on: string
  amount: number | null
  description: string
  method: string
  payer: string
  has_receipt: boolean
  memo: string
}

export const emptyPaymentDraft = (paid_on: string): PaymentDraft => ({
  paid_on,
  amount: null,
  description: '',
  method: '',
  payer: '',
  has_receipt: false,
  memo: '',
})

// ── 상수 ─────────────────────────────────────────────────────

/**
 * deal_status 는 DB 에서 enum 이 아니라 text 다(마이그레이션 주석 기준 6종).
 * 그래서 이 배열은 '허용 목록'이 아니라 '입력 도우미'다. 목록에 없는 값이 들어와도
 * 그대로 보여 준다 — 엑셀에서 옮겨온 값이 조금 다를 수 있기 때문이다.
 */
export const DEAL_STATUSES = ['미정', '견적중', '가계약', '계약완료', '결제완료', '취소'] as const
export type DealStatus = (typeof DEAL_STATUSES)[number]

/** 취소된 건은 합계에서 뺀다. 계약금액이 남아 있어도 나갈 돈이 아니다. */
export const CANCELLED = '취소'

export const statusOf = (row: { deal_status: string | null }): string =>
  row.deal_status?.trim() || '미정'

/** 상태칩 색. 목록에 없는 값은 기본 톤으로 떨어진다. */
export const statusTone = (status: string): string => {
  switch (status) {
    case '계약완료':
    case '결제완료':
      return 'good'
    case '가계약':
      return 'warn'
    case '취소':
      return 'off'
    default:
      return 'plain'
  }
}

/** 결제 내용. 계약금 → 중도금 → 잔금 순서로 나가는 것이 보통이다. */
export const PAYMENT_KINDS = ['계약금', '중도금', '잔금', '추가금', '환불'] as const
export const PAYMENT_METHODS = ['카드', '계좌이체', '현금'] as const
/** assignee enum 과 같은 어휘를 쓴다. 자유 입력이므로 다른 이름도 적을 수 있다. */
export const PAYERS = ['주호', '지영', '같이'] as const
export const OWNERS = ['주호', '지영', '같이'] as const
export const FUNDINGS = ['선지출', '축의금'] as const

/** category 가 null 인 행을 화면에서 부르는 이름. DB 에는 이 문자열을 저장하지 않는다. */
export const UNCATEGORIZED = '미분류'

/** 카테고리 입력을 도와주는 기본 후보. 자유 입력이므로 강제는 아니다. */
export const CATEGORY_SUGGESTIONS = [
  '예식장',
  '스드메',
  '예물·예단',
  '신혼여행',
  '신혼집',
  '청첩장',
  '본식스냅',
  '기타',
] as const
