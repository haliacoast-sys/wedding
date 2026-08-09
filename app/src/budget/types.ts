/**
 * types.ts — 예산 모듈이 쓰는 타입과 상수.
 *
 * 행 타입은 전부 lib/database.types.ts 에서 파생시킨다. 손으로 다시 적으면
 * 스키마가 바뀌었을 때 컴파일이 통과해 버려서 틀린 걸 알 수 없다.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../lib/database.types'

export type BudgetItem = Tables<'budget_items'>
export type BudgetItemInsert = TablesInsert<'budget_items'>
export type BudgetItemUpdate = TablesUpdate<'budget_items'>

export type Vendor = Tables<'vendors'>
export type VendorInsert = TablesInsert<'vendors'>

/** id 가 반드시 있는 insert 행. 낙관적 삽입과 Realtime 메아리를 같은 행으로 맞추기 위해 필요하다. */
export type ItemInsertRow = BudgetItemInsert & { id: string }

/**
 * 편집 중인 초안. 서버로 가기 전 단계라 금액은 비어 있을 수 있다(= null).
 * 금액은 언제나 원 단위 정수이며 이 타입 어디에도 문자열 금액은 없다.
 */
export type ItemDraft = {
  label: string
  category: string
  estimate: number | null
  actual: number | null
  paid_at: string | null
  vendor_id: string | null
  memo: string
}

export const emptyDraft = (category = ''): ItemDraft => ({
  label: '',
  category,
  estimate: null,
  actual: null,
  paid_at: null,
  vendor_id: null,
  memo: '',
})

export const draftOf = (item: BudgetItem): ItemDraft => ({
  label: item.label,
  category: item.category ?? '',
  estimate: item.estimate,
  actual: item.actual,
  paid_at: item.paid_at,
  vendor_id: item.vendor_id,
  memo: item.memo ?? '',
})

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
