/**
 * homeApi.ts — 홈 대시보드가 서버에서 읽어오는 것 전부. React 는 들어오지 않는다.
 *
 * 설계 메모
 * 1) 홈은 '쓰기'를 하지 않는다. 읽기 전용이라 낙관적 갱신·Realtime 구독이 없다.
 * 2) 카드마다 count 쿼리를 따로 던지지 않고 필요한 컬럼만 한 번에 받아서
 *    브라우저에서 집계한다. 항목 수가 수백 단위라 왕복 한 번이 훨씬 싸고,
 *    진행률·임박·지연·카테고리 집계가 항상 같은 스냅샷에서 나온다
 *    (쿼리를 쪼개면 "완료 12/40 인데 임박 목록에는 이미 끝낸 항목"이 보일 수 있다).
 * 3) 캐시 키는 ['home', ...] 로 격리한다. 체크리스트 모듈이 ['checklist','tasks'] 를
 *    쓰므로 같은 키에 서로 다른 queryFn 이 붙는 사고를 원천 차단한다.
 */
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

export type TaskStatus = Database['public']['Enums']['task_status']

export const homeTasksKey = ['home', 'tasks'] as const
export const homeBudgetKey = ['home', 'budget'] as const

/** 홈이 실제로 쓰는 컬럼만. select 문자열과 이 타입은 함께 고쳐야 한다. */
export type HomeTask = {
  id: string
  title: string
  category: string
  status: TaskStatus
  due_date: string | null
}

export type HomeBudgetRow = {
  id: string
  label: string
  category: string | null
  estimate: number | null
  actual: number | null
}

/** PostgrestError 든 네트워크 예외든 화면에 띄울 수 있는 한 줄로 만든다. */
export const toMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return String(error)
}

export const fetchHomeTasks = async (): Promise<HomeTask[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,category,status,due_date')
  if (error) throw new Error(error.message)
  return data ?? []
}

export const fetchHomeBudget = async (): Promise<HomeBudgetRow[]> => {
  const { data, error } = await supabase
    .from('budget_items')
    .select('id,label,category,estimate,actual')
  if (error) throw new Error(error.message)
  return data ?? []
}
