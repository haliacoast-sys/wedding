/**
 * types.ts — 하객 명단 화면이 다루는 타입과 상수.
 *
 * 행 타입은 자동 생성된 database.types.ts 에서 파생시킨다. 손으로 다시 적으면
 * 마이그레이션이 바뀌었을 때 타입만 옛말을 한다.
 *
 * ★ head_count 와 meal_count 는 다른 값이다.
 *   아이가 함께 오면 참석 인원(head)에는 세지만 식대(meal)는 안 나갈 수 있다.
 *   이 둘을 한 컬럼으로 합치면 보증인원 통보 숫자가 틀린다. 화면에서도 끝까지 나눠 둔다.
 */
import { Constants } from '../lib/database.types'
import type { Enums, Tables, TablesInsert, TablesUpdate } from '../lib/database.types'

// ── 테이블 ───────────────────────────────────────────────────

export type Guest = Tables<'guests'>
export type GuestInsert = TablesInsert<'guests'>
export type GuestUpdate = TablesUpdate<'guests'>

/**
 * 기준값이 들어 있는 한 행짜리 표. 이 화면은 읽기만 한다.
 * (보증인원·1인 식대를 고치는 건 '당일' 화면의 일이다. 두 화면에서 같은 행을 쓰면
 *  누가 마지막에 썼는지에 따라 값이 흔들린다.)
 */
export type DayOfConfig = Tables<'day_of_config'>

// ── enum ─────────────────────────────────────────────────────

export type WeddingSide = Enums<'wedding_side'>
export type Attendance = Enums<'attendance'>
export type InviteState = Enums<'invite_state'>

/** enum 값의 단일 출처. 문자열 배열을 따로 적어두면 마이그레이션과 어긋난다. */
export const SIDES = Constants.public.Enums.wedding_side // 신랑 · 신부 · 공통
export const ATTENDANCES = Constants.public.Enums.attendance // 미정 · 참석 · 불참
export const INVITE_STATES = Constants.public.Enums.invite_state // 미전달 · 전달완료 · 모바일

/**
 * relation 은 text 컬럼이라 아무 값이나 들어간다. 여기 목록은 '빠른 선택'일 뿐
 * 제약이 아니다. 직접 입력한 값도 그대로 저장되고 목록에서 그룹으로 살아난다.
 */
export const RELATIONS = ['가족', '친척', '친구', '직장', '지인', '기타'] as const
export type Relation = (typeof RELATIONS)[number]

/** relation 이 비어 있는 행을 묶는 이름. DB 에는 저장하지 않는다(표시용). */
export const NO_RELATION = '미분류'

// ── 기준값 폴백 ──────────────────────────────────────────────

/**
 * day_of_config 를 아직 못 읽었거나 컬럼이 비어 있을 때 쓰는 값.
 * 마이그레이션 20260817000001 이 넣어 둔 시드와 같은 숫자다.
 * 화면에서는 "기본값을 쓰는 중"임을 반드시 밝힌다 — 조용히 다른 단가로 계산하면
 * 보증인원 판단이 통째로 틀어진다.
 */
export const FALLBACK_MEAL_UNIT_PRICE = 58_000
export const FALLBACK_GUARANTEE = 200

// ── 편집 폼이 다루는 필드 ────────────────────────────────────

export type GuestDraft = {
  name: string
  side: WeddingSide
  relation: string | null
  contact: string | null
  invitation: InviteState
  attending: Attendance
  head_count: number
  meal_count: number
  gift_amount: number | null
  thanks: string | null
  memo: string | null
}

export const emptyDraft = (side: WeddingSide = '신랑'): GuestDraft => ({
  name: '',
  side,
  relation: null,
  contact: null,
  invitation: '미전달',
  attending: '미정',
  head_count: 1,
  meal_count: 1,
  gift_amount: null,
  thanks: null,
  memo: null,
})

export const draftOf = (guest: Guest): GuestDraft => ({
  name: guest.name,
  side: guest.side,
  relation: guest.relation,
  contact: guest.contact,
  invitation: guest.invitation,
  attending: guest.attending,
  head_count: guest.head_count,
  meal_count: guest.meal_count,
  gift_amount: guest.gift_amount,
  thanks: guest.thanks,
  memo: guest.memo,
})

// ── 필터 ─────────────────────────────────────────────────────

/** null = 전체. 쿼리 키에는 넣지 않는다(필터는 클라이언트 계산이다). */
export type Filters = {
  side: WeddingSide | null
  attending: Attendance | null
  invitation: InviteState | null
  /** 이름·연락처 검색어. */
  query: string
}

export const EMPTY_FILTERS: Filters = {
  side: null,
  attending: null,
  invitation: null,
  query: '',
}

export const isFiltering = (f: Filters): boolean =>
  f.side !== null || f.attending !== null || f.invitation !== null || f.query.trim() !== ''

/** 인원 입력의 상한. 한 줄(=한 집)에 100명이 오는 일은 없다. 오타 방지용. */
export const MAX_PEOPLE_PER_ROW = 99
