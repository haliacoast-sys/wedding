/**
 * budgetApi.ts — Supabase 호출과 에러 정규화. React 는 여기 들어오지 않는다.
 *
 * 읽기와 쓰기의 대상이 다르다.
 *   읽기 → public.budget_rollup (뷰).  budget_items 의 모든 컬럼에 결제 원장 합계
 *          (paid_sum · unpaid · payment_count)가 붙어 있다. security_invoker = true 라
 *          RLS 는 밑의 테이블 정책이 그대로 걸린다.
 *   쓰기 → public.budget_items (테이블). 뷰에는 쓸 수 없다.
 *
 * 그래서 fetchItems 만 뷰를 보고, insert/update/delete 는 전부 테이블을 본다.
 * 이 비대칭이 이 파일에 갇혀 있어야 위쪽(useBudget · 화면)이 그걸 신경 쓰지 않는다.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fromRollup } from './types'
import type {
  BudgetItemUpdate,
  BudgetRow,
  ItemInsertRow,
  Payment,
  PaymentInsertRow,
  PaymentUpdate,
  Vendor,
  VendorInsert,
} from './types'

/** 예산 캐시의 뿌리. 한 곳에 모아야 무효화가 새지 않는다. */
export const itemsKey = ['budget', 'items'] as const
export const paymentsKey = ['budget', 'payments'] as const
export const vendorsKey = ['budget', 'vendors'] as const
export const membershipKey = ['budget', 'is-member'] as const

export type FailureInfo = {
  message: string
  code?: string
  details?: string
  hint?: string
}

/**
 * PostgrestError 를 Error 로 감싸되 code/hint 를 잃지 않는다.
 * RLS 거부(42501)나 숫자 범위 초과(22003)는 code 를 봐야 원인을 알 수 있다.
 */
export class SupabaseFailure extends Error {
  info: FailureInfo

  constructor(info: FailureInfo) {
    super(info.message)
    this.name = 'SupabaseFailure'
    this.info = info
  }
}

const toFailure = (error: PostgrestError): SupabaseFailure =>
  new SupabaseFailure({
    message: error.message,
    code: error.code ?? undefined,
    details: error.details ?? undefined,
    hint: error.hint ?? undefined,
  })

/** 화면에서 에러를 읽을 때 쓰는 어댑터. 어떤 예외가 와도 표시 가능한 형태로 만든다. */
export const describeError = (error: unknown): FailureInfo => {
  if (error instanceof SupabaseFailure) return error.info
  if (error instanceof Error) return { message: error.message }
  return { message: String(error) }
}

// ── 조회 ──────────────────────────────────────────────────────

/**
 * 목록은 뷰에서 읽는다. 정렬은 selectors.sortRows 가 맡는다 —
 * 서버 정렬과 이중으로 두면 낙관적으로 끼워 넣은 행의 위치가 두 규칙 사이에서 흔들린다.
 */
export const fetchItems = async (): Promise<BudgetRow[]> => {
  const { data, error } = await supabase.from('budget_rollup').select('*')
  if (error) throw toFailure(error)
  const rows: BudgetRow[] = []
  for (const raw of data ?? []) {
    const row = fromRollup(raw)
    if (row) rows.push(row)
  }
  return rows
}

/**
 * 결제 원장 전체를 한 번에 받는다. 항목별로 따로 조회하지 않는 이유:
 *   - 전체가 많아야 수십 줄이다. 항목을 열 때마다 왕복하면 느리기만 하다.
 *   - 원장을 통째로 들고 있어야 항목별 실지출을 클라이언트에서 다시 계산할 수 있고,
 *     그래야 결제를 추가한 순간 잔금 숫자가 서버 왕복 없이 바로 움직인다.
 */
export const fetchPayments = async (): Promise<Payment[]> => {
  const { data, error } = await supabase.from('payments').select('*')
  if (error) throw toFailure(error)
  return data ?? []
}

export const fetchVendors = async (): Promise<Vendor[]> => {
  const { data, error } = await supabase.from('vendors').select('*').order('name')
  if (error) throw toFailure(error)
  return data ?? []
}

/**
 * RLS 통과 여부를 직접 묻는다.
 * 조회가 0행인데 에러도 없을 때 '아직 아무것도 안 넣은 것'과 '권한이 없어 다 잘린 것'을
 * 구분하는 유일한 방법이다. is_member() 는 security definer 라 비멤버도 호출은 된다.
 */
export const probeMembership = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_member')
  if (error) throw toFailure(error)
  return data === true
}

// ── 쓰기 ── 뷰가 아니라 테이블로 간다 ────────────────────────

export const insertItem = async (row: ItemInsertRow): Promise<void> => {
  const { error } = await supabase.from('budget_items').insert(row)
  if (error) throw toFailure(error)
}

export const updateItem = async (id: string, patch: BudgetItemUpdate): Promise<void> => {
  const { error } = await supabase.from('budget_items').update(patch).eq('id', id)
  if (error) throw toFailure(error)
}

export const deleteItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('budget_items').delete().eq('id', id)
  if (error) throw toFailure(error)
}

export const insertPayment = async (row: PaymentInsertRow): Promise<void> => {
  const { error } = await supabase.from('payments').insert(row)
  if (error) throw toFailure(error)
}

export const updatePayment = async (id: string, patch: PaymentUpdate): Promise<void> => {
  const { error } = await supabase.from('payments').update(patch).eq('id', id)
  if (error) throw toFailure(error)
}

export const deletePayment = async (id: string): Promise<void> => {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw toFailure(error)
}

export const insertVendor = async (row: VendorInsert & { id: string }): Promise<void> => {
  const { error } = await supabase.from('vendors').insert(row)
  if (error) throw toFailure(error)
}

/**
 * 클라이언트에서 id 를 미리 만든다.
 * 이유: 낙관적으로 끼워 넣은 행과 서버가 돌려주는 행의 id 가 같아야
 * Realtime INSERT 메아리가 도착했을 때 중복 행이 생기지 않는다.
 * (서버가 id 를 만들면 임시 id 를 찾아 교체하는 화해 로직이 따로 필요해진다.)
 * 삭제 취소로 같은 행을 되살릴 때도 원래 id 를 그대로 다시 넣는다.
 */
export const newId = (): string => {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // randomUUID 는 보안 컨텍스트에서만 보장된다. http 로 띄운 개발 서버 대비 폴백.
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
