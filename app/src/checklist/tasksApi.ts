/**
 * tasksApi.ts — Supabase 호출과 에러 정규화. React 는 여기 들어오지 않는다.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Task, TaskInsert, TaskUpdate } from './types'

/** 모든 체크리스트 캐시의 뿌리. 한 곳으로 모아야 무효화가 새지 않는다. */
export const tasksKey = ['checklist', 'tasks'] as const
export const membershipKey = ['checklist', 'is-member'] as const

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

/** 화면에서 에러를 읽을 때 쓰는 어댑터. 어떤 예외가 와도 표시 가능한 형태로 만든다. */
export const describeError = (error: unknown): FailureInfo => {
  if (error instanceof SupabaseFailure) return error.info
  if (error instanceof Error) return { message: error.message }
  return { message: String(error) }
}

export const fetchTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase.from('tasks').select('*')
  if (error) throw toFailure(error)
  // 정렬은 selectors.compareTasks 가 담당한다. 서버 정렬과 이중으로 두면
  // 낙관적으로 끼워 넣은 행의 위치가 두 규칙 사이에서 흔들린다.
  return data ?? []
}

export const insertTask = async (row: TaskInsert): Promise<void> => {
  const { error } = await supabase.from('tasks').insert(row)
  if (error) throw toFailure(error)
}

export const updateTask = async (id: string, patch: TaskUpdate): Promise<void> => {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw toFailure(error)
}

export const deleteTask = async (id: string): Promise<void> => {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw toFailure(error)
}

/**
 * RLS 통과 여부를 직접 묻는다.
 * 조회가 0행인데 에러도 없을 때, '데이터가 없는 것'과 '권한이 없어 다 잘린 것'을
 * 구분하는 유일한 방법이다. is_member() 는 security definer 라 비멤버도 호출은 된다.
 */
export const probeMembership = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_member')
  if (error) throw toFailure(error)
  return data === true
}

/**
 * 클라이언트에서 id 를 미리 만든다.
 * 이유: 낙관적으로 끼워 넣은 행과 서버가 돌려주는 행의 id 가 같아야
 * Realtime INSERT 메아리가 도착했을 때 중복 행이 생기지 않는다.
 * (서버가 id 를 만들면 임시 id 를 찾아 교체하는 화해 로직이 따로 필요해진다.)
 */
export const newTaskId = (): string => {
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
