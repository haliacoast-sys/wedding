/**
 * homeApi.ts — 홈 대시보드가 서버에서 읽어오는 것 전부. React 는 들어오지 않는다.
 *
 * 설계 메모
 * 1) 홈은 '쓰기'를 하지 않는다. 읽기 전용이라 낙관적 갱신·Realtime 구독이 없다.
 * 2) 카드마다 count 쿼리를 따로 던지지 않고 필요한 컬럼만 한 번에 받아서
 *    브라우저에서 집계한다. 항목 수가 수백 단위라 왕복 한 번이 훨씬 싸고,
 *    진행률·임박·지연·카테고리 집계가 항상 같은 스냅샷에서 나온다
 *    (쿼리를 쪼개면 "완료 12/40 인데 임박 목록에는 이미 끝낸 항목"이 보일 수 있다).
 * 3) 캐시 키는 ['home', ...] 로 격리한다. 체크리스트 모듈이 ['checklist','tasks'] 를
 *    쓰므로 같은 키에 서로 다른 queryFn 이 붙는 사고를 원천 차단한다.
 *
 * ── 2026-08-17: budget_items → budget_rollup ──────────────────
 * 결제가 payments 원장으로 쪼개지면서 "지금까지 얼마 냈나"를 budget_items 한 행에서
 * 읽을 수 없게 됐다. 홈에서 budget_items 와 payments 를 따로 받아 브라우저에서 합치는
 * 방법도 있지만, 그러면 (a) 왕복이 두 번이 되고 (b) 두 스냅샷이 어긋날 수 있으며
 * (c) 같은 합산 규칙이 가계부 화면과 홈 두 곳에 각각 생긴다.
 * budget_rollup 뷰는 security_invoker 라 RLS 가 그대로 적용되고 합산 규칙이 DB 한 곳에만
 * 있으므로 홈은 이 뷰를 읽는다. 홈은 읽기 전용이라 뷰에 Realtime 이 없는 것도 문제가 아니다.
 */
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

export type TaskStatus = Database['public']['Enums']['task_status']
export type FundingSource = Database['public']['Enums']['funding_source']
export type Attendance = Database['public']['Enums']['attendance']

export const homeTasksKey = ['home', 'tasks'] as const
export const homeBudgetKey = ['home', 'budget'] as const
export const homeGuestsKey = ['home', 'guests'] as const

/** 홈이 실제로 쓰는 컬럼만. select 문자열과 이 타입은 함께 고쳐야 한다. */
export type HomeTask = {
  id: string
  title: string
  category: string
  status: TaskStatus
  due_date: string | null
}

/**
 * budget_rollup 한 행. 뷰라서 생성 타입의 모든 컬럼이 nullable 이다
 * (Postgres 가 뷰 컬럼의 not-null 을 보장하지 않는다). 집계 쪽에서 전부 방어한다.
 *
 *   estimate    잡아둔 예산
 *   contracted  업체와 확정한 계약금액
 *   paid_sum    payments 원장 합계 = 실지출
 *   unpaid      contracted − paid_sum (미계약 항목이면 음수가 될 수 있어 그대로 쓰지 않는다)
 *   due_on      결제 예정일
 *   deal_status 취소된 건은 어떤 합계에도 넣지 않는다
 */
export type HomeBudgetRow = {
  id: string | null
  label: string | null
  category: string | null
  funding: FundingSource | null
  estimate: number | null
  contracted: number | null
  paid_sum: number | null
  due_on: string | null
  deal_status: string | null
}

export type HomeGuestRow = {
  id: string
  attending: Attendance
  head_count: number
  meal_count: number
  gift_amount: number | null
}

/** 하객 카드는 명단만으로 완성되지 않는다. 보증인원·1인 식대가 있어야 '많다/적다'를 말할 수 있다. */
export type HomeGuestData = {
  rows: HomeGuestRow[]
  /** 홀에 통보하는 보증인원. 식사 인원을 재는 기준선. */
  guarantee: number | null
  mealUnitPrice: number | null
}

/** PostgrestError 든 네트워크 예외든 화면에 띄울 수 있는 한 줄로 만든다. */
export const toMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return String(error)
}

export const fetchHomeTasks = async (): Promise<HomeTask[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,category,status,due_date')
  if (error) throw new Error(error.message)
  return data ?? []
}

export const fetchHomeBudget = async (): Promise<HomeBudgetRow[]> => {
  const { data, error } = await supabase
    .from('budget_rollup')
    .select('id,label,category,funding,estimate,contracted,paid_sum,due_on,deal_status')
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * 하객 명단과 기준값(보증인원·식대)을 함께 받는다.
 *
 * 두 번 왕복하지만 카드 하나가 로딩·실패 상태 하나만 갖도록 한 쿼리로 묶었다.
 * 명단만 오고 보증인원이 늦게 오면 "식사 124명 / 보증 —명" 같은 중간 상태가 보인다.
 */
export const fetchHomeGuests = async (): Promise<HomeGuestData> => {
  const [guests, config] = await Promise.all([
    supabase.from('guests').select('id,attending,head_count,meal_count,gift_amount'),
    supabase
      .from('day_of_config')
      .select('guarantee_count,expected_guests,meal_unit_price')
      .eq('id', 1)
      .maybeSingle(),
  ])
  if (guests.error) throw new Error(guests.error.message)
  if (config.error) throw new Error(config.error.message)

  return {
    rows: guests.data ?? [],
    // 계약상 보증인원이 우선. 아직 안 정했으면 예상 인원으로 대신 잰다.
    guarantee: config.data?.guarantee_count ?? config.data?.expected_guests ?? null,
    mealUnitPrice: config.data?.meal_unit_price ?? null,
  }
}
