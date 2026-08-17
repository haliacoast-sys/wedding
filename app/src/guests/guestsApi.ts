/**
 * guestsApi.ts — Supabase 호출과 에러 정규화. React 는 여기 들어오지 않는다.
 *
 * 이 화면은 테이블 하나(public.guests)만 쓴다. 진행표처럼 뷰가 끼지 않으므로
 * 읽기와 쓰기의 모양이 같고, Realtime payload 를 캐시에 그대로 넣을 수 있다.
 *
 * day_of_config 는 읽기만 한다. 보증인원·1인 식대를 이 화면에서 고치지 않는 이유는
 * types.ts 의 주석에 적어 뒀다.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { DayOfConfig, Guest, GuestInsert, GuestUpdate } from './types'

/**
 * 하객 화면 캐시의 뿌리. 참조가 고정된 상수라 Set 에 담아 재사용할 수 있다.
 * (Realtime 이 '밀린 쿼리'를 Set 으로 모을 때 참조 비교가 통해야 한다.)
 */
export const guestsRoot = ['guests'] as const
export const guestsKey = ['guests', 'list'] as const
export const configKey = ['guests', 'config'] as const
export const membershipKey = ['guests', 'is-member'] as const

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

// ── 하객 ─────────────────────────────────────────────────────

/**
 * 정렬은 selectors.sortGuests 가 담당한다. 서버 정렬과 이중으로 두면
 * 낙관적으로 끼워 넣은 행의 위치가 두 규칙 사이에서 흔들린다.
 */
export const fetchGuests = async (): Promise<Guest[]> => {
  const { data, error } = await supabase.from('guests').select('*')
  if (error) throw toFailure(error)
  return data ?? []
}

/**
 * 여러 행을 한 번에 넣는다. 단건 추가도 길이 1 배열로 이 경로를 쓴다.
 *
 * 배열 insert 를 쓰는 이유: 엑셀에서 옮겨 적는 30명을 한 명씩 보내면 왕복이 30번이고,
 * 중간에 하나만 실패했을 때 어디까지 들어갔는지 알 수 없다. 한 문장으로 보내면
 * 전부 들어가거나 전부 안 들어간다(단일 statement = 단일 트랜잭션).
 */
export const insertGuests = async (rows: GuestInsert[]): Promise<void> => {
  if (rows.length === 0) return
  const { error } = await supabase.from('guests').insert(rows)
  if (error) throw toFailure(error)
}

export const updateGuest = async (id: string, patch: GuestUpdate): Promise<void> => {
  const { error } = await supabase.from('guests').update(patch).eq('id', id)
  if (error) throw toFailure(error)
}

export const deleteGuest = async (id: string): Promise<void> => {
  const { error } = await supabase.from('guests').delete().eq('id', id)
  if (error) throw toFailure(error)
}

// ── 기준값 (읽기 전용) ───────────────────────────────────────

/**
 * 행이 없을 수도 있다(시드 미투입). 그때는 null 을 돌려주고,
 * 화면은 폴백 단가를 쓰되 "기본값으로 계산 중"임을 밝힌다.
 */
export const fetchConfig = async (): Promise<DayOfConfig | null> => {
  const { data, error } = await supabase.from('day_of_config').select('*').eq('id', 1).maybeSingle()
  if (error) throw toFailure(error)
  return data ?? null
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
