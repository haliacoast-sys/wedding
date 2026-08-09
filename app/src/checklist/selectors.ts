/**
 * selectors.ts — 순수 함수만. 정렬·필터·그룹핑·진행률.
 *
 * 서버에 필터를 위임하지 않고 전부 클라이언트에서 계산한다. 이유:
 *   1. 두 사람의 결혼 준비 체크리스트라 행 수가 수백 단위를 넘지 않는다.
 *   2. 쿼리 키가 ['checklist','tasks'] 하나로 고정되므로 낙관적 업데이트가
 *      캐시 한 곳만 고치면 된다. 필터마다 키가 갈리면 롤백 대상이 흩어진다.
 */
import { dueToneOf, toDayNumber, todayIso } from './dates'
import type { Filters, Task } from './types'

/**
 * 마감일 오름차순, 마감일 없는 항목은 맨 뒤.
 * 같은 날이면 sort_order, 그 다음 생성순으로 안정화한다.
 */
export const compareTasks = (a: Task, b: Task): number => {
  const da = a.due_date ? toDayNumber(a.due_date) : Number.POSITIVE_INFINITY
  const db = b.due_date ? toDayNumber(b.due_date) : Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return a.created_at.localeCompare(b.created_at)
}

const matchesAssignee = (task: Task, filter: Filters['assignee']): boolean => {
  if (filter === 'all') return true
  if (filter === 'none') return task.assignee === null
  return task.assignee === filter
}

/** 담당자·카테고리 필터만 적용한 '집계 대상'. 완료 숨기기는 여기 넣지 않는다. */
export const scopeTasks = (tasks: Task[], filters: Filters): Task[] =>
  tasks.filter(
    (t) =>
      matchesAssignee(t, filters.assignee) &&
      (filters.category === 'all' || t.category === filters.category),
  )

/** 실제로 화면에 그릴 목록. 집계 대상에서 완료 숨기기만 더 적용한다. */
export const visibleTasks = (scoped: Task[], filters: Filters): Task[] =>
  filters.hideDone ? scoped.filter((t) => t.status !== 'done') : scoped

export type Progress = { done: number; total: number; ratio: number }

export const progressOf = (tasks: Task[]): Progress => {
  const total = tasks.length
  const done = tasks.reduce((n, t) => (t.status === 'done' ? n + 1 : n), 0)
  return { done, total, ratio: total === 0 ? 0 : done / total }
}

export type CategoryGroup = {
  category: string
  /** 화면에 그릴 항목 (완료 숨기기 반영) */
  tasks: Task[]
  /** 진행률은 숨긴 완료 항목까지 포함해 센다. 숨긴다고 분모가 줄면 안 된다. */
  progress: Progress
  /** 마감 지난 미완료 개수 */
  overdue: number
}

/**
 * 카테고리별로 묶는다.
 * 카테고리 순서는 '미완료 항목 중 가장 이른 마감일' 기준 — 급한 카테고리가 위로 온다.
 * 마감일이 하나도 없는 카테고리는 뒤로 밀고 이름순으로 안정화한다.
 */
export const groupByCategory = (
  scoped: Task[],
  filters: Filters,
  today: string = todayIso(),
): CategoryGroup[] => {
  const buckets = new Map<string, Task[]>()
  for (const t of scoped) {
    const list = buckets.get(t.category)
    if (list) list.push(t)
    else buckets.set(t.category, [t])
  }

  const groups: { group: CategoryGroup; urgency: number }[] = []
  for (const [category, all] of buckets) {
    const sorted = [...all].sort(compareTasks)
    const urgency = sorted.reduce((min, t) => {
      if (t.status === 'done' || !t.due_date) return min
      return Math.min(min, toDayNumber(t.due_date))
    }, Number.POSITIVE_INFINITY)
    const overdue = sorted.reduce(
      (n, t) => (dueToneOf(t.due_date, t.status === 'done', today) === 'overdue' ? n + 1 : n),
      0,
    )
    groups.push({
      urgency,
      group: {
        category,
        tasks: visibleTasks(sorted, filters),
        progress: progressOf(sorted),
        overdue,
      },
    })
  }

  groups.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency - b.urgency
    return a.group.category.localeCompare(b.group.category, 'ko')
  })

  return groups.map((g) => g.group)
}

/** 필터 칩에 쓸 카테고리 목록. 전체 데이터 기준이라 필터를 걸어도 사라지지 않는다. */
export const allCategories = (tasks: Task[]): string[] =>
  [...new Set(tasks.map((t) => t.category))].sort((a, b) => a.localeCompare(b, 'ko'))

/** 마감 지난 미완료 전체 개수 — 상단 경고 배너용. */
export const overdueCount = (tasks: Task[], today: string = todayIso()): number =>
  tasks.reduce(
    (n, t) => (dueToneOf(t.due_date, t.status === 'done', today) === 'overdue' ? n + 1 : n),
    0,
  )

/** 새 항목의 sort_order. 같은 카테고리 맨 뒤에 붙인다. */
export const nextSortOrder = (tasks: Task[], category: string): number => {
  const max = tasks.reduce(
    (m, t) => (t.category === category ? Math.max(m, t.sort_order) : m),
    0,
  )
  return max + 1
}
