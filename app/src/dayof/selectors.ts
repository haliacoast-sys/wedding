/**
 * selectors.ts — 순수 계산. 정렬·그룹핑·집계만 있고 React 도 Supabase 도 없다.
 *
 * 필터를 쿼리 키에 넣지 않는 것과 같은 이유로, 정렬도 서버가 아니라 여기서 한 번만 한다.
 * 서버 정렬과 클라이언트 정렬을 둘 다 두면 낙관적으로 끼워 넣은 행의 위치가
 * 두 규칙 사이에서 흔들린다.
 */
import { PHASES } from './types'
import type { DayOfPhase, Item, Role, ScheduleRow } from './types'

export type Progress = { done: number; total: number; ratio: number }

export const ratio = (done: number, total: number): number => (total === 0 ? 0 : done / total)

// ── 진행표 ───────────────────────────────────────────────────

/**
 * 예식 시작(offset 0) 기준 오름차순.
 * 같은 분에 겹치는 항목은 sort_order → 제목 순으로 안정화한다.
 * (안정화가 없으면 Realtime 으로 행 하나가 갱신될 때마다 순서가 미세하게 튄다.)
 */
export const sortSchedule = (rows: ScheduleRow[]): ScheduleRow[] =>
  rows.slice().sort((a, b) => {
    if (a.offset_min !== b.offset_min) return a.offset_min - b.offset_min
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.title.localeCompare(b.title, 'ko')
  })

export type PhaseGroup = {
  phase: DayOfPhase
  rows: ScheduleRow[]
  progress: Progress
  /** 이 단계의 첫 항목이 예식 시작 몇 분 전/후인지. 그룹 정렬 기준. */
  firstOffset: number
}

/**
 * phase 별로 묶되, 그룹 순서는 '그 단계의 가장 이른 항목' 기준으로 정한다.
 * enum 선언 순서만 믿으면 사용자가 마무리 단계 항목을 예식 전으로 옮겼을 때
 * 진행표가 시간을 거슬러 흐르게 된다. 같은 시각이면 enum 순서로 안정화한다.
 */
export const groupByPhase = (rows: ScheduleRow[]): PhaseGroup[] => {
  const sorted = sortSchedule(rows)
  const buckets = new Map<DayOfPhase, ScheduleRow[]>()
  for (const row of sorted) {
    const bucket = buckets.get(row.phase)
    if (bucket) bucket.push(row)
    else buckets.set(row.phase, [row])
  }

  const groups: PhaseGroup[] = []
  for (const [phase, list] of buckets) {
    groups.push({
      phase,
      rows: list,
      progress: progressOfSchedule(list),
      firstOffset: list[0]?.offset_min ?? 0,
    })
  }

  return groups.sort((a, b) => {
    if (a.firstOffset !== b.firstOffset) return a.firstOffset - b.firstOffset
    return PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase)
  })
}

export const progressOfSchedule = (rows: ScheduleRow[]): Progress => {
  const done = rows.reduce((n, r) => (r.status === 'done' ? n + 1 : n), 0)
  return { done, total: rows.length, ratio: ratio(done, rows.length) }
}

/**
 * 예식 시작 기준선을 어느 행 위에 그릴지.
 * 정렬된 목록에서 offset >= 0 이 처음 나오는 행의 id 를 돌려준다.
 * offset 0 인 행이 따로 없어도(개식 선언을 지웠을 때도) 기준선은 제자리에 남는다.
 */
export const baselineRowId = (rows: ScheduleRow[]): string | null => {
  for (const row of sortSchedule(rows)) {
    if (row.offset_min >= 0) return row.id
  }
  return null
}

/** 같은 offset 에 항목을 새로 끼울 때 쓸 sort_order. 뒤에 붙인다. */
export const nextEventSortOrder = (rows: ScheduleRow[], offsetMin: number): number => {
  const sameSlot = rows.filter((r) => r.offset_min === offsetMin)
  const base = sameSlot.length > 0 ? sameSlot : rows
  const max = base.reduce((m, r) => (r.sort_order > m ? r.sort_order : m), 0)
  return max + 100
}

// ── 역할 ─────────────────────────────────────────────────────

/** 미정(person_name 이 null 이거나 공백)인가. 아직 대부분이 여기 해당한다. */
export const isUnassigned = (role: Role): boolean => !role.person_name?.trim()

export const sortRoles = (roles: Role[]): Role[] =>
  roles.slice().sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.role.localeCompare(b.role, 'ko')
  })

export type FeeTotals = {
  /** 사례비가 적힌 모든 역할의 합. */
  all: number
  /** confirmed 인 역할만의 합. 이 금액은 당일 봉투로 확정 지출이다. */
  confirmed: number
  /** 사람이 아직 정해지지 않았는데 사례비만 적혀 있는 금액. 섭외가 끝나면 실제 지출이 된다. */
  unassigned: number
  withFee: number
  unassignedCount: number
  confirmedCount: number
}

export const feeTotals = (roles: Role[]): FeeTotals => {
  let all = 0
  let confirmed = 0
  let unassigned = 0
  let withFee = 0
  let unassignedCount = 0
  let confirmedCount = 0
  for (const role of roles) {
    if (isUnassigned(role)) unassignedCount += 1
    if (role.confirmed) confirmedCount += 1
    const fee = role.fee ?? 0
    if (role.fee !== null && role.fee !== undefined) withFee += 1
    all += fee
    if (role.confirmed) confirmed += fee
    if (isUnassigned(role)) unassigned += fee
  }
  return { all, confirmed, unassigned, withFee, unassignedCount, confirmedCount }
}

// ── 준비물 ───────────────────────────────────────────────────

export type ItemGroup = { category: string; items: Item[]; progress: Progress }

export const sortItems = (items: Item[]): Item[] =>
  items.slice().sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.label.localeCompare(b.label, 'ko')
  })

/** 분류 순서는 '그 분류의 가장 앞선 항목' 기준. 시드의 sort_order 흐름을 그대로 따른다. */
export const groupItems = (items: Item[]): ItemGroup[] => {
  const sorted = sortItems(items)
  const buckets = new Map<string, Item[]>()
  for (const item of sorted) {
    const key = item.category || '기타'
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }
  // Map 은 삽입 순서를 유지한다. sorted 를 훑었으므로 이미 sort_order 순서다.
  return [...buckets].map(([category, list]) => ({
    category,
    items: list,
    progress: progressOfItems(list),
  }))
}

export const progressOfItems = (items: Item[]): Progress => {
  const done = items.reduce((n, i) => (i.packed ? n + 1 : n), 0)
  return { done, total: items.length, ratio: ratio(done, items.length) }
}

export const itemCategories = (items: Item[]): string[] => {
  const seen: string[] = []
  for (const item of sortItems(items)) {
    const key = item.category || '기타'
    if (!seen.includes(key)) seen.push(key)
  }
  return seen
}

export const nextItemSortOrder = (items: Item[], category: string): number => {
  const inCategory = items.filter((i) => i.category === category)
  const base = inCategory.length > 0 ? inCategory : items
  const max = base.reduce((m, i) => (i.sort_order > m ? i.sort_order : m), 0)
  return max + 100
}

export const nextRoleSortOrder = (roles: Role[]): number =>
  roles.reduce((m, r) => (r.sort_order > m ? r.sort_order : m), 0) + 100

/** 연락처를 tel: 링크로 만든다. 하이픈·공백·괄호는 다이얼러가 싫어한다. */
export const telHref = (contact: string | null | undefined): string | null => {
  if (!contact) return null
  const cleaned = contact.replace(/[^\d+]/g, '')
  return cleaned.length >= 3 ? `tel:${cleaned}` : null
}
