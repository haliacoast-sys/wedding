/**
 * homeData.ts — 조회 훅 + 집계.
 *
 * 집계 함수는 전부 순수 함수다(입력: 행 배열 + 오늘 날짜). React 를 거치지 않으므로
 * 자정이 지나 오늘이 바뀌면 같은 데이터로 다시 계산만 하면 된다.
 */
import { useQuery } from '@tanstack/react-query'
import {
  fetchHomeBudget,
  fetchHomeGuests,
  fetchHomeTasks,
  homeBudgetKey,
  homeGuestsKey,
  homeTasksKey,
} from './homeApi'
import type { FundingSource, HomeBudgetRow, HomeGuestData, HomeTask } from './homeApi'
import { daysFromToday } from './dday'

// ── 조회 ──────────────────────────────────────────────────────

/**
 * staleTime 15초: 체크리스트 탭에서 항목을 체크하고 홈으로 돌아오면 곧바로 다시 받아온다.
 * (홈은 체크리스트 캐시를 공유하지 않으므로 무효화가 전파되지 않는다. 폴더 간 결합을
 *  만들지 않는 대신 짧은 stale 시간으로 맞춘다.)
 */
export const useHomeTasksQuery = () =>
  useQuery({
    queryKey: homeTasksKey,
    queryFn: fetchHomeTasks,
    staleTime: 15_000,
    retry: 1,
  })

export const useHomeBudgetQuery = () =>
  useQuery({
    queryKey: homeBudgetKey,
    queryFn: fetchHomeBudget,
    staleTime: 15_000,
    retry: 1,
  })

export const useHomeGuestsQuery = () =>
  useQuery({
    queryKey: homeGuestsKey,
    queryFn: fetchHomeGuests,
    staleTime: 15_000,
    retry: 1,
  })

// ── 집계: 할 일 ────────────────────────────────────────────────

export type DueItem = {
  id: string
  title: string
  category: string
  due: string
  /** 오늘 기준 남은 날. 음수면 지난 것. */
  days: number
}

export type CategoryProgress = {
  category: string
  total: number
  done: number
}

export type TaskSummary = {
  total: number
  done: number
  /** 완료가 아닌 모든 항목(todo·doing·hold) */
  open: number
  /** 미완료인데 마감일이 없는 항목 수 */
  noDue: number
  /** 마감이 지난 미완료 전체 개수(목록은 잘려도 숫자는 전부 센다) */
  overdueCount: number
  /** 마감이 남은 미완료 전체 개수 */
  upcomingCount: number
  overdue: DueItem[]
  upcoming: DueItem[]
  categories: CategoryProgress[]
}

/* 목록 길이. 홈은 '요약'이고 전체 목록은 체크리스트 탭에 있다.
   하객 카드가 늘면서 첫 화면 세로가 빠듯해져 4/5 → 3/3 으로 줄였다.
   잘린 개수는 '외 N건'으로 항상 표시하므로 정보가 사라지지는 않는다. */
const OVERDUE_LIMIT = 3
const UPCOMING_LIMIT = 3
const CATEGORY_LIMIT = 4

export const summarizeTasks = (rows: HomeTask[], today: string): TaskSummary => {
  let done = 0
  let noDue = 0
  const overdue: DueItem[] = []
  const upcoming: DueItem[] = []
  const byCategory = new Map<string, CategoryProgress>()

  for (const row of rows) {
    const category = row.category || '기타'
    let bucket = byCategory.get(category)
    if (!bucket) {
      bucket = { category, total: 0, done: 0 }
      byCategory.set(category, bucket)
    }
    bucket.total += 1

    if (row.status === 'done') {
      done += 1
      bucket.done += 1
      continue
    }

    // 여기부터는 미완료(todo·doing·hold)만 남는다.
    // 'hold'(보류)도 아직 끝나지 않은 일이므로 진행률 분모와 마감 판정에 그대로 포함한다.
    if (!row.due_date) {
      noDue += 1
      continue
    }
    const days = daysFromToday(row.due_date, today)
    if (days === null) {
      noDue += 1
      continue
    }
    const item: DueItem = { id: row.id, title: row.title, category, due: row.due_date, days }
    if (days < 0) overdue.push(item)
    else upcoming.push(item)
  }

  // 지연: 가장 오래 밀린 것부터. 임박: 가장 급한 것부터.
  overdue.sort((a, b) => a.days - b.days)
  upcoming.sort((a, b) => a.days - b.days)

  const categories = [...byCategory.values()]
    // 남은 일이 많은 카테고리를 먼저 보여준다. 동률이면 규모가 큰 쪽.
    .sort((a, b) => b.total - b.done - (a.total - a.done) || b.total - a.total)
    .slice(0, CATEGORY_LIMIT)

  return {
    total: rows.length,
    done,
    open: rows.length - done,
    noDue,
    overdueCount: overdue.length,
    upcomingCount: upcoming.length,
    overdue: overdue.slice(0, OVERDUE_LIMIT),
    upcoming: upcoming.slice(0, UPCOMING_LIMIT),
    categories,
  }
}

// ── 집계: 예산 ────────────────────────────────────────────────

/** 결제 예정 한 건. amount 는 그날 나갈 잔금이다(계약 총액이 아니다). */
export type PayDue = {
  id: string
  label: string
  due: string
  /** 오늘 기준 남은 날. 음수면 예정일이 이미 지난 것. */
  days: number
  amount: number
  funding: FundingSource
}

export type BudgetSummary = {
  count: number
  /** 계약금액 합계. 지금 우리가 물려 있는 총 규모. */
  contracted: number
  /** payments 원장 합계 = 지금까지 실제로 나간 돈 */
  paid: number
  /**
   * 예식 전에 우리 현금으로 내야 하는 잔금(선지출 항목의 미지급 합).
   * 홈에서 가장 급한 숫자다 — 계약 총액의 대부분은 축의금으로 정산되는 홀 청구분이라
   * 총액만 보면 실제로 마련해야 할 돈을 몇 배로 오해한다.
   */
  ownRemaining: number
  /** 예식 당일 축의금으로 정산할 잔금. ownRemaining 과 절대 더하지 않는다. */
  giftRemaining: number
  /** 결제 예정일이 잡힌 잔금 전체 건수 */
  upcomingCount: number
  /** 가까운 순 상위 몇 건 */
  upcoming: PayDue[]
}

const PAY_DUE_LIMIT = 2

/**
 * 취소된 건. 계약금액이 남아 있어도 나갈 돈이 아니므로 어떤 합계에도 넣지 않는다.
 *
 * budget 모듈의 CANCELLED 와 같은 값이다. 셸이 budget 폴더를 import 하지 않는다는
 * 규칙(AppShell 주석 참조) 때문에 상수 하나를 복제한다. 문자열 하나를 공유하려고
 * 셸 → 기능 폴더 의존을 만드는 것보다 낫다. deal_status 목록이 바뀌면 함께 고칠 것.
 */
const CANCELLED = '취소'

/**
 * 미지급 잔금. 정의를 가계부 화면과 한 글자도 다르지 않게 맞춘다.
 *
 *   unpaid = max(contracted − paid, 0),  contracted 가 없으면 '알 수 없음'
 *
 * 계약 전 항목의 예산(estimate)을 잔금에 섞고 싶은 유혹이 있는데, 그러면 같은
 * '우리 현금 잔금'이 홈과 가계부에서 다른 숫자로 나온다. 두 화면이 어긋나는 것이
 * 조금 적게 잡히는 것보다 훨씬 나쁘다. 계약 전 항목은 가계부에서 예산으로 본다.
 *
 * 서버 뷰의 unpaid 를 그대로 쓰지 않는 이유도 같다. 뷰는 coalesce(contracted,0) 이라
 * 계약금만 먼저 낸 항목에서 음수가 나오고, 그게 합계에 섞이면 총액이 조용히 줄어든다.
 */
const unpaidOf = (row: HomeBudgetRow): number | null => {
  if (typeof row.contracted !== 'number') return null
  return Math.max(0, row.contracted - (row.paid_sum ?? 0))
}

export const summarizeBudget = (rows: HomeBudgetRow[], today: string): BudgetSummary => {
  let contracted = 0
  let paid = 0
  let ownRemaining = 0
  let giftRemaining = 0
  const upcoming: PayDue[] = []

  for (const row of rows) {
    if ((row.deal_status?.trim() || '') === CANCELLED) continue

    if (typeof row.contracted === 'number') contracted += row.contracted
    paid += row.paid_sum ?? 0

    const unpaid = unpaidOf(row) ?? 0
    // funding 이 비어 있으면(뷰라 nullable) 우리 현금 쪽으로 센다. 적게 잡는 쪽보다 낫다.
    const funding: FundingSource = row.funding ?? '선지출'
    if (funding === '축의금') giftRemaining += unpaid
    else ownRemaining += unpaid

    if (unpaid > 0 && row.due_on && row.id) {
      const days = daysFromToday(row.due_on, today)
      if (days !== null) {
        upcoming.push({
          id: row.id,
          label: row.label ?? '이름 없는 항목',
          due: row.due_on,
          days,
          amount: unpaid,
          funding,
        })
      }
    }
  }

  // 예정일이 지난 것이 맨 위. 그다음 가까운 순.
  upcoming.sort((a, b) => a.days - b.days)

  return {
    count: rows.length,
    contracted,
    paid,
    ownRemaining,
    giftRemaining,
    upcomingCount: upcoming.length,
    upcoming: upcoming.slice(0, PAY_DUE_LIMIT),
  }
}

// ── 집계: 하객 ────────────────────────────────────────────────

export type GuestSummary = {
  /** 명단에 올린 건수(가구/개인 단위). 인원과 다르다. */
  count: number
  /** 참석으로 확정된 인원 합계(head_count) */
  attendingHeads: number
  /** 아직 답을 못 받은 건수 */
  pendingCount: number
  /** 참석자의 식사 인원 합계. 아이처럼 식대가 안 나가는 인원은 빠진다. */
  mealCount: number
  /** 축의금 합계. 불참이어도 봉투는 들어오므로 참석 여부로 거르지 않는다. */
  gift: number
  guarantee: number | null
  mealUnitPrice: number | null
  /** 식사 인원이 보증인원을 넘었는가. 넘으면 식대가 그대로 추가 청구된다. */
  overGuarantee: boolean
}

export const summarizeGuests = (data: HomeGuestData): GuestSummary => {
  let attendingHeads = 0
  let pendingCount = 0
  let mealCount = 0
  let gift = 0

  for (const row of data.rows) {
    if (row.attending === '참석') {
      attendingHeads += row.head_count
      mealCount += row.meal_count
    } else if (row.attending === '미정') {
      pendingCount += 1
    }
    if (typeof row.gift_amount === 'number') gift += row.gift_amount
  }

  return {
    count: data.rows.length,
    attendingHeads,
    pendingCount,
    mealCount,
    gift,
    guarantee: data.guarantee,
    mealUnitPrice: data.mealUnitPrice,
    overGuarantee: data.guarantee !== null && mealCount > data.guarantee,
  }
}
