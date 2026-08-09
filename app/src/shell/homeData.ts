/**
 * homeData.ts — 조회 훅 + 집계.
 *
 * 집계 함수는 전부 순수 함수다(입력: 행 배열 + 오늘 날짜). React 를 거치지 않으므로
 * 자정이 지나 오늘이 바뀌면 같은 데이터로 다시 계산만 하면 된다.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchHomeBudget, fetchHomeTasks, homeBudgetKey, homeTasksKey } from './homeApi'
import type { HomeBudgetRow, HomeTask } from './homeApi'
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
  overdue: DueItem[]
  upcoming: DueItem[]
  categories: CategoryProgress[]
}

const OVERDUE_LIMIT = 4
const UPCOMING_LIMIT = 5
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
    overdue: overdue.slice(0, OVERDUE_LIMIT),
    upcoming: upcoming.slice(0, UPCOMING_LIMIT),
    categories,
  }
}

// ── 집계: 예산 ────────────────────────────────────────────────

export type BudgetSummary = {
  count: number
  estimate: number
  actual: number
  /** actual 이 입력된 항목 수 = 이미 값이 확정된 건 */
  settled: number
  /** 실제 − 견적. 양수면 예산 초과. */
  diff: number
}

export const summarizeBudget = (rows: HomeBudgetRow[]): BudgetSummary => {
  let estimate = 0
  let actual = 0
  let settled = 0

  for (const row of rows) {
    if (typeof row.estimate === 'number') estimate += row.estimate
    if (typeof row.actual === 'number') {
      actual += row.actual
      settled += 1
    }
  }

  return { count: rows.length, estimate, actual, settled, diff: actual - estimate }
}
