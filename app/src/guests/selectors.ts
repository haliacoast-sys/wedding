/**
 * selectors.ts — 순수 계산. 정렬·필터·집계만 있고 React 도 Supabase 도 없다.
 *
 * 필터를 쿼리 키에 넣지 않고 여기서 거르는 이유:
 *   200명 명단은 한 번에 받아도 수십 KB 다. 필터마다 서버를 다시 부르면
 *   칩을 누를 때마다 화면이 비었다 채워지고, 낙관적으로 넣은 행이 필터 전환 중에 사라진다.
 *   한 번 받아서 클라이언트가 거르는 편이 폰에서 압도적으로 빠르다.
 *
 * ── 집계에서 헷갈리기 쉬운 세 가지 ──────────────────────────
 *
 * ① 참석 인원(head)과 식사 인원(meal)은 다르다.
 *    아이가 함께 오면 head 에는 세지만 식대는 안 나갈 수 있다.
 *    보증인원 통보에 쓰는 숫자는 meal 쪽이다.
 *
 * ② 축의금은 참석 여부와 무관하게 전부 더한다.
 *    불참이어도 축의금은 들어온다. '참석한 사람의 축의금'만 세면 재원이 과소평가된다.
 *
 * ③ 보증인원은 하한이지 상한이 아니다.
 *    실제로 내는 식대 = max(식사 인원, 보증인원) × 단가.
 *    미달해도 보증인원분은 그대로 내고, 초과하면 초과분을 당일 추가로 낸다.
 *    그래서 "예상 식대(식사 인원 기준)"와 "실제 청구액"을 따로 계산한다.
 */
import { NO_RELATION, RELATIONS } from './types'
import type { Attendance, Filters, Guest, InviteState, WeddingSide } from './types'
import { onlyDigits } from './format'

// ── 정렬 ─────────────────────────────────────────────────────

/**
 * 넣은 순서(sort_order)를 그대로 지킨다. 엑셀에서 옮겨 적을 때 원본 순서가
 * 유지돼야 어디까지 옮겼는지 눈으로 대조할 수 있다. 같으면 이름으로 안정화한다.
 * (안정화가 없으면 Realtime 으로 행 하나가 갱신될 때마다 순서가 미세하게 튄다.)
 */
export const sortGuests = (rows: Guest[]): Guest[] =>
  rows.slice().sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    const byName = a.name.localeCompare(b.name, 'ko')
    if (byName !== 0) return byName
    return a.id.localeCompare(b.id)
  })

export const nextSortOrder = (rows: Guest[]): number =>
  rows.reduce((m, r) => (r.sort_order > m ? r.sort_order : m), 0) + 100

// ── 필터 ─────────────────────────────────────────────────────

/**
 * 검색은 이름과 연락처 둘 다 본다.
 * 연락처는 숫자만 남겨서 비교한다 — "01012345678" 로 쳐도 "010-1234-5678" 이 걸린다.
 * 관계·메모까지 뒤지면 "친구"를 검색했을 때 메모에 '친구 소개'라고 적힌 사람이
 * 딸려 나온다. 검색은 사람을 찾는 도구지 분류 도구가 아니다(분류는 필터가 한다).
 */
export const matchesQuery = (guest: Guest, query: string): boolean => {
  const q = query.trim()
  if (!q) return true
  const lower = q.toLowerCase()
  if (guest.name.toLowerCase().includes(lower)) return true
  const digits = onlyDigits(q)
  if (digits.length >= 2 && guest.contact) {
    return onlyDigits(guest.contact).includes(digits)
  }
  return false
}

export const applyFilters = (rows: Guest[], f: Filters): Guest[] =>
  rows.filter((g) => {
    if (f.side !== null && g.side !== f.side) return false
    if (f.attending !== null && g.attending !== f.attending) return false
    if (f.invitation !== null && g.invitation !== f.invitation) return false
    return matchesQuery(g, f.query)
  })

// ── 그룹 ─────────────────────────────────────────────────────

export type RelationGroup = {
  relation: string
  rows: Guest[]
  /** 그룹 머리에 바로 붙이는 요약. 200명 명단은 그룹 단위로 훑게 된다. */
  totals: Totals
}

/**
 * 관계로 묶는다. relation 은 자유 텍스트라 목록에 없는 값도 들어올 수 있다.
 * 순서는 RELATIONS 선언 순서 → 그 밖의 값(가나다) → 미분류.
 * 미분류를 맨 뒤로 보내는 이유: 아직 안 채운 칸이라 목록 위쪽을 차지하면 안 된다.
 */
export const groupByRelation = (rows: Guest[]): RelationGroup[] => {
  const buckets = new Map<string, Guest[]>()
  for (const row of sortGuests(rows)) {
    const key = row.relation?.trim() || NO_RELATION
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  const rank = (name: string): number => {
    if (name === NO_RELATION) return 2
    return (RELATIONS as readonly string[]).includes(name) ? 0 : 1
  }

  return [...buckets]
    .map(([relation, list]) => ({ relation, rows: list, totals: totalsOf(list) }))
    .sort((a, b) => {
      const ra = rank(a.relation)
      const rb = rank(b.relation)
      if (ra !== rb) return ra - rb
      if (ra === 0) {
        return (
          (RELATIONS as readonly string[]).indexOf(a.relation) -
          (RELATIONS as readonly string[]).indexOf(b.relation)
        )
      }
      return a.relation.localeCompare(b.relation, 'ko')
    })
}

// ── 집계 ─────────────────────────────────────────────────────

export type Totals = {
  /** 명단 건수. 사람 수가 아니라 '줄 수'다 — 한 줄이 가족 4명일 수 있다. */
  count: number
  /** 참석으로 확정된 줄 수. */
  attendingCount: number
  undecidedCount: number
  declinedCount: number
  /** 참석 확정된 줄의 head_count 합. 실제로 식장에 오는 사람 수. */
  headCount: number
  /** 참석 확정된 줄의 meal_count 합. 식대가 나가는 사람 수. */
  mealCount: number
  /** 아직 미정인 줄의 head/meal 합. 이 사람들이 다 오면 얼마가 되는지 보려고 따로 센다. */
  pendingHeadCount: number
  pendingMealCount: number
  /** 축의금 합. ★ 참석 여부와 무관하게 전부 더한다(불참이어도 축의금은 들어온다). */
  gift: number
  /** 축의금이 적힌 줄 수. 합계만 보면 '아직 안 적은 것'과 '0원'이 구분되지 않는다. */
  giftFilled: number
}

const EMPTY_TOTALS: Totals = {
  count: 0,
  attendingCount: 0,
  undecidedCount: 0,
  declinedCount: 0,
  headCount: 0,
  mealCount: 0,
  pendingHeadCount: 0,
  pendingMealCount: 0,
  gift: 0,
  giftFilled: 0,
}

export const totalsOf = (rows: Guest[]): Totals => {
  const t: Totals = { ...EMPTY_TOTALS }
  for (const g of rows) {
    t.count += 1
    if (g.attending === '참석') {
      t.attendingCount += 1
      t.headCount += g.head_count
      t.mealCount += g.meal_count
    } else if (g.attending === '미정') {
      t.undecidedCount += 1
      t.pendingHeadCount += g.head_count
      t.pendingMealCount += g.meal_count
    } else {
      t.declinedCount += 1
    }
    if (g.gift_amount !== null && g.gift_amount !== undefined) {
      t.gift += g.gift_amount
      t.giftFilled += 1
    }
  }
  return t
}

export type SideBreakdown = {
  side: WeddingSide
  totals: Totals
}

/** 신랑 · 신부 · 공통 순서로 고정한다(SIDES 선언 순서). 0건인 측도 줄을 남긴다. */
export const totalsBySide = (rows: Guest[], sides: readonly WeddingSide[]): SideBreakdown[] =>
  sides.map((side) => ({ side, totals: totalsOf(rows.filter((g) => g.side === side)) }))

// ── 식대 · 보증인원 ──────────────────────────────────────────

export type MealMath = {
  unitPrice: number
  guarantee: number

  /** 참석 확정 기준 식사 인원. 보증인원과 비교하는 값이 이것이다. */
  mealCount: number
  /** 미정이 전부 참석한다면 도달할 식사 인원. 보증인원 통보 전 상한 감각용. */
  potentialMealCount: number

  /** 예상 식대 = 식사 인원 × 1인 식대. */
  mealCost: number
  /** ★ 실제 청구 인원 = max(식사 인원, 보증인원). 보증인원은 하한이다. */
  billedCount: number
  billedCost: number

  /** 보증인원을 넘은 인원(0 이상). 이만큼은 당일 추가 정산이다. */
  overBy: number
  overCost: number
  /** 보증인원에 모자란 인원(0 이상). 안 와도 이만큼의 식대는 그대로 나간다. */
  shortBy: number
  shortCost: number

  /** 축의금 − 예상 식대. 명세가 말하는 '실질 수지'. */
  net: number
  /** 축의금 − 실제 청구액. 보증인원 미달분까지 반영한 진짜 지갑 기준. */
  netBilled: number

  /** 기준값이 DB 가 아니라 폴백에서 왔는가. 화면에서 반드시 밝혀야 한다. */
  unitPriceIsFallback: boolean
  guaranteeIsFallback: boolean
}

export const mealMath = ({
  mealCount,
  potentialMealCount,
  gift,
  unitPrice,
  guarantee,
  unitPriceIsFallback,
  guaranteeIsFallback,
}: {
  mealCount: number
  potentialMealCount: number
  gift: number
  unitPrice: number
  guarantee: number
  unitPriceIsFallback: boolean
  guaranteeIsFallback: boolean
}): MealMath => {
  const mealCost = mealCount * unitPrice
  const billedCount = Math.max(mealCount, guarantee)
  const billedCost = billedCount * unitPrice
  const overBy = Math.max(0, mealCount - guarantee)
  const shortBy = Math.max(0, guarantee - mealCount)
  return {
    unitPrice,
    guarantee,
    mealCount,
    potentialMealCount,
    mealCost,
    billedCount,
    billedCost,
    overBy,
    overCost: overBy * unitPrice,
    shortBy,
    shortCost: shortBy * unitPrice,
    net: gift - mealCost,
    netBilled: gift - billedCost,
    unitPriceIsFallback,
    guaranteeIsFallback,
  }
}

// ── 청첩장 ───────────────────────────────────────────────────

export type InviteCounts = Record<InviteState, number> & {
  /** 미전달을 뺀 나머지. '전달완료 + 모바일'을 매번 더하지 않게 미리 센다. */
  delivered: number
  total: number
}

export const inviteCounts = (rows: Guest[]): InviteCounts => {
  const c: InviteCounts = { 미전달: 0, 전달완료: 0, 모바일: 0, delivered: 0, total: rows.length }
  for (const g of rows) {
    c[g.invitation] += 1
  }
  c.delivered = c.전달완료 + c.모바일
  return c
}

/** 청첩장 발송 권장 시작 시점 = 예식 6주 전. */
export const INVITE_LEAD_DAYS = 42

// ── 상태별 개수 (필터 칩의 뱃지) ─────────────────────────────

export const attendanceCounts = (rows: Guest[]): Record<Attendance, number> => {
  const base: Record<Attendance, number> = { 미정: 0, 참석: 0, 불참: 0 }
  for (const g of rows) base[g.attending] += 1
  return base
}

export const sideCounts = (rows: Guest[]): Record<WeddingSide, number> => {
  const base: Record<WeddingSide, number> = { 신랑: 0, 신부: 0, 공통: 0 }
  for (const g of rows) base[g.side] += 1
  return base
}

// ── 중복 이름 ────────────────────────────────────────────────

/**
 * 같은 이름이 이미 있는지. 엑셀을 두 번 옮겨 적는 사고가 실제로 잦다.
 * 동명이인이 있을 수 있으므로 막지는 않고 알리기만 한다.
 */
export const nameSet = (rows: Guest[]): Set<string> =>
  new Set(rows.map((g) => g.name.trim().replace(/\s+/g, '')))
