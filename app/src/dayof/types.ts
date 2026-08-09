/**
 * types.ts — 본식 당일 화면이 다루는 타입과 상수.
 *
 * 행 타입은 전부 자동 생성된 database.types.ts 에서 파생시킨다.
 * 손으로 다시 적으면 마이그레이션이 바뀌었을 때 타입만 옛말을 하게 된다.
 *
 * ── 읽기(뷰)와 쓰기(테이블)의 분리 ─────────────────────────
 *   읽기 : day_of_schedule  (뷰. starts_at/ends_at/role_name/role_person 이 붙어 나온다)
 *   쓰기 : day_of_events    (테이블. 뷰는 읽기 전용이라 여기에 쓴다)
 * 그래서 ScheduleRow(화면용) 와 EventRow(쓰기용) 를 다른 타입으로 둔다.
 * 둘을 하나로 합치면 "뷰에 update 를 날리는" 실수가 타입으로 걸러지지 않는다.
 */
import { Constants } from '../lib/database.types'
import type { Enums, Tables, TablesInsert, TablesUpdate } from '../lib/database.types'

// ── 테이블 (쓰기 대상) ────────────────────────────────────────

export type DayOfConfig = Tables<'day_of_config'>
export type DayOfConfigInsert = TablesInsert<'day_of_config'>
export type DayOfConfigUpdate = TablesUpdate<'day_of_config'>

export type EventRow = Tables<'day_of_events'>
export type EventInsert = TablesInsert<'day_of_events'>
export type EventUpdate = TablesUpdate<'day_of_events'>

export type Role = Tables<'day_of_roles'>
export type RoleInsert = TablesInsert<'day_of_roles'>
export type RoleUpdate = TablesUpdate<'day_of_roles'>

export type Item = Tables<'day_of_items'>
export type ItemInsert = TablesInsert<'day_of_items'>
export type ItemUpdate = TablesUpdate<'day_of_items'>

// ── 뷰 (읽기 전용) ────────────────────────────────────────────

/** 자동 생성 타입에서는 뷰 컬럼이 전부 nullable 이다. 화면용으로는 아래 ScheduleRow 를 쓴다. */
export type ScheduleView = Tables<'day_of_schedule'>

// ── enum ─────────────────────────────────────────────────────

export type DayOfPhase = Enums<'day_of_phase'>
export type WeddingSide = Enums<'wedding_side'>
export type TaskStatus = Enums<'task_status'>
export type Assignee = Enums<'assignee'>

/** enum 값의 단일 출처. 문자열 배열을 따로 적어두면 마이그레이션과 어긋난다. */
export const PHASES = Constants.public.Enums.day_of_phase
export const SIDES = Constants.public.Enums.wedding_side
export const ASSIGNEES = Constants.public.Enums.assignee
export const TASK_STATUSES = Constants.public.Enums.task_status

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '대기',
  doing: '진행 중',
  done: '완료',
  hold: '보류',
}

// ── 화면용 진행표 행 ──────────────────────────────────────────

export type ScheduleRow = {
  id: string
  phase: DayOfPhase
  /** 예식 시작 기준 상대 분. 음수는 예식 전. */
  offset_min: number
  duration_min: number | null
  title: string
  location: string | null
  role_id: string | null
  role_name: string | null
  role_person: string | null
  note: string | null
  status: TaskStatus
  sort_order: number
  /**
   * 뷰가 계산한 실제 시각.
   * null 인 경우는 하나뿐이다 — 방금 낙관적으로 끼워 넣어 아직 서버를 거치지 않은 행.
   * 클라이언트가 offset 을 환산해 채워 넣지 않는다. 그렇게 하면 기준 시각 계산이
   * 뷰와 클라이언트 두 곳에 생기고, 언젠가 반드시 어긋난다.
   */
  starts_at: string | null
  ends_at: string | null
}

/** 뷰 행(전 컬럼 nullable)을 화면용으로 좁힌다. 핵심 컬럼이 비면 그 행은 버린다. */
export const normalizeScheduleRow = (row: ScheduleView): ScheduleRow | null => {
  if (!row.id || !row.phase || !row.title) return null
  if (row.offset_min === null || row.offset_min === undefined) return null
  return {
    id: row.id,
    phase: row.phase,
    offset_min: row.offset_min,
    duration_min: row.duration_min ?? null,
    title: row.title,
    location: row.location ?? null,
    role_id: row.role_id ?? null,
    role_name: row.role_name ?? null,
    role_person: row.role_person ?? null,
    note: row.note ?? null,
    status: row.status ?? 'todo',
    sort_order: row.sort_order ?? 0,
    starts_at: row.starts_at ?? null,
    ends_at: row.ends_at ?? null,
  }
}

// ── 편집 폼이 다루는 필드 ─────────────────────────────────────

export type EventDraft = {
  title: string
  phase: DayOfPhase
  offset_min: number
  duration_min: number | null
  location: string | null
  role_id: string | null
  note: string | null
  status: TaskStatus
}

export type RoleDraft = {
  role: string
  side: WeddingSide
  person_name: string | null
  contact: string | null
  fee: number | null
  confirmed: boolean
  note: string | null
}

export type ItemDraft = {
  label: string
  category: string
  owner: Assignee | null
  note: string | null
}

export type SectionId = 'schedule' | 'roles' | 'items'
