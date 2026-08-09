/**
 * dayofApi.ts — Supabase 호출과 에러 정규화. React 는 여기 들어오지 않는다.
 *
 * ★ 읽기와 쓰기의 대상이 다르다.
 *     fetchSchedule() → public.day_of_schedule (뷰, 읽기 전용)
 *     insert/update/deleteEvent() → public.day_of_events (테이블)
 *   뷰에는 실제 시각(starts_at/ends_at)이 계산돼 있지만 쓸 수는 없다.
 *   함수 이름을 Schedule(읽기) / Event(쓰기) 로 갈라 둔 이유가 이것이다.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { normalizeScheduleRow } from './types'
import type {
  DayOfConfig,
  DayOfConfigInsert,
  DayOfConfigUpdate,
  EventInsert,
  EventUpdate,
  Item,
  ItemInsert,
  ItemUpdate,
  Role,
  RoleInsert,
  RoleUpdate,
  ScheduleRow,
} from './types'

/** 당일 화면 캐시의 뿌리. 참조가 고정된 상수라 Set 에 담아 재사용할 수 있다. */
export const dayofRoot = ['dayof'] as const
export const configKey = ['dayof', 'config'] as const
export const scheduleKey = ['dayof', 'schedule'] as const
export const rolesKey = ['dayof', 'roles'] as const
export const itemsKey = ['dayof', 'items'] as const
export const membershipKey = ['dayof', 'is-member'] as const

export type FailureInfo = {
  message: string
  code?: string
  details?: string
  hint?: string
}

/**
 * PostgrestError 를 Error 로 감싸되 code/hint 를 잃지 않는다.
 * RLS 거부(42501)나 enum 불일치(22P02)는 code 를 봐야 원인을 알 수 있다.
 */
export class SupabaseFailure extends Error {
  info: FailureInfo

  constructor(info: FailureInfo) {
    super(info.message)
    this.name = 'SupabaseFailure'
    this.info = info
  }
}

export const toFailure = (error: PostgrestError): SupabaseFailure =>
  new SupabaseFailure({
    message: error.message,
    code: error.code ?? undefined,
    details: error.details ?? undefined,
    hint: error.hint ?? undefined,
  })

export const describeError = (error: unknown): FailureInfo => {
  if (error instanceof SupabaseFailure) return error.info
  if (error instanceof Error) return { message: error.message }
  return { message: String(error) }
}

// ── 기준 시각 ────────────────────────────────────────────────

/**
 * 행이 없을 수도 있다(시드 미투입). 그때는 null 을 돌려준다.
 * 이 경우 day_of_schedule 뷰도 cross join 때문에 0행이 되므로 진행표가 통째로 비어 보인다.
 * 화면에서 그 인과관계를 안내해야 사용자가 원인을 찾을 수 있다.
 */
export const fetchConfig = async (): Promise<DayOfConfig | null> => {
  const { data, error } = await supabase.from('day_of_config').select('*').eq('id', 1).maybeSingle()
  if (error) throw toFailure(error)
  return data ?? null
}

export const updateConfig = async (patch: DayOfConfigUpdate): Promise<void> => {
  const { error } = await supabase.from('day_of_config').update(patch).eq('id', 1)
  if (error) throw toFailure(error)
}

/** 행이 아예 없을 때 쓰는 경로. id=1 은 체크 제약으로 고정돼 있어 두 행이 생길 수 없다. */
export const upsertConfig = async (row: DayOfConfigInsert): Promise<void> => {
  const { error } = await supabase.from('day_of_config').upsert({ ...row, id: 1 })
  if (error) throw toFailure(error)
}

// ── 진행표: 읽기는 뷰 ────────────────────────────────────────

export const fetchSchedule = async (): Promise<ScheduleRow[]> => {
  const { data, error } = await supabase.from('day_of_schedule').select('*')
  if (error) throw toFailure(error)
  // 정렬은 selectors.sortSchedule 이 담당한다. 서버 정렬과 이중으로 두면
  // 낙관적으로 끼워 넣은 행의 위치가 두 규칙 사이에서 흔들린다.
  const rows: ScheduleRow[] = []
  for (const raw of data ?? []) {
    const row = normalizeScheduleRow(raw)
    if (row) rows.push(row)
  }
  return rows
}

// ── 진행표: 쓰기는 테이블 ────────────────────────────────────

export const insertEvent = async (row: EventInsert): Promise<void> => {
  const { error } = await supabase.from('day_of_events').insert(row)
  if (error) throw toFailure(error)
}

export const updateEvent = async (id: string, patch: EventUpdate): Promise<void> => {
  const { error } = await supabase.from('day_of_events').update(patch).eq('id', id)
  if (error) throw toFailure(error)
}

export const deleteEvent = async (id: string): Promise<void> => {
  const { error } = await supabase.from('day_of_events').delete().eq('id', id)
  if (error) throw toFailure(error)
}

// ── 역할 ─────────────────────────────────────────────────────

export const fetchRoles = async (): Promise<Role[]> => {
  const { data, error } = await supabase.from('day_of_roles').select('*')
  if (error) throw toFailure(error)
  return data ?? []
}

export const insertRole = async (row: RoleInsert): Promise<void> => {
  const { error } = await supabase.from('day_of_roles').insert(row)
  if (error) throw toFailure(error)
}

export const updateRole = async (id: string, patch: RoleUpdate): Promise<void> => {
  const { error } = await supabase.from('day_of_roles').update(patch).eq('id', id)
  if (error) throw toFailure(error)
}

export const deleteRole = async (id: string): Promise<void> => {
  const { error } = await supabase.from('day_of_roles').delete().eq('id', id)
  if (error) throw toFailure(error)
}

// ── 준비물 ───────────────────────────────────────────────────

export const fetchItems = async (): Promise<Item[]> => {
  const { data, error } = await supabase.from('day_of_items').select('*')
  if (error) throw toFailure(error)
  return data ?? []
}

export const insertItem = async (row: ItemInsert): Promise<void> => {
  const { error } = await supabase.from('day_of_items').insert(row)
  if (error) throw toFailure(error)
}

export const updateItem = async (id: string, patch: ItemUpdate): Promise<void> => {
  const { error } = await supabase.from('day_of_items').update(patch).eq('id', id)
  if (error) throw toFailure(error)
}

export const deleteItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('day_of_items').delete().eq('id', id)
  if (error) throw toFailure(error)
}

// ── 권한 확인 ────────────────────────────────────────────────

/**
 * 조회가 0행인데 에러도 없을 때, '데이터가 없는 것'과 '권한이 없어 다 잘린 것'을
 * 구분하는 유일한 방법. is_member() 는 security definer 라 비멤버도 호출은 된다.
 */
export const probeMembership = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_member')
  if (error) throw toFailure(error)
  return data === true
}

/**
 * 클라이언트에서 id 를 미리 만든다.
 * 낙관적으로 끼워 넣은 행과 서버가 돌려주는 행의 id 가 같아야
 * Realtime INSERT 메아리가 도착했을 때 중복 행이 생기지 않는다.
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
