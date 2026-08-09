/**
 * types.ts — 체크리스트가 다루는 타입과 상수.
 *
 * 행(row) 타입은 전부 자동 생성된 database.types.ts 에서 파생시킨다.
 * 손으로 다시 정의하면 스키마가 바뀌었을 때 타입이 거짓말을 하기 시작한다.
 */
import { Constants } from '../lib/database.types'
import type { Enums, Tables, TablesInsert, TablesUpdate } from '../lib/database.types'

export type Task = Tables<'tasks'>
export type TaskInsert = TablesInsert<'tasks'>
export type TaskUpdate = TablesUpdate<'tasks'>

export type Assignee = Enums<'assignee'>
export type TaskStatus = Enums<'task_status'>

/** enum 값의 단일 출처. 문자열 배열을 따로 적어두면 마이그레이션과 어긋난다. */
export const ASSIGNEES = Constants.public.Enums.assignee
export const TASK_STATUSES = Constants.public.Enums.task_status

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '할 일',
  doing: '진행 중',
  done: '완료',
  hold: '보류',
}

/** 담당자 필터. 'none' 은 assignee 가 null 인 항목. */
export type AssigneeFilter = 'all' | Assignee | 'none'

/** 카테고리 필터. 'all' 이거나 실제 카테고리 문자열. */
export type CategoryFilter = string

export type Filters = {
  assignee: AssigneeFilter
  category: CategoryFilter
  hideDone: boolean
}

export const DEFAULT_FILTERS: Filters = {
  assignee: 'all',
  category: 'all',
  hideDone: false,
}

/** 편집 폼이 다루는 필드만 추린 것. done_at 은 DB 트리거 소관이라 들어 있지 않다. */
export type TaskDraft = {
  title: string
  category: string
  due_date: string | null
  assignee: Assignee | null
  status: TaskStatus
  note: string | null
}

/**
 * 로그인 표시 이름을 assignee enum 으로 옮긴다.
 * display_name 이 '이주호' 처럼 성을 포함해도 '주호' 로 맞춘다.
 * 매칭이 안 되면 null — 그 경우 담당자 기본값 없이 동작한다.
 */
export const resolveAssignee = (displayName: string | undefined): Assignee | null => {
  if (!displayName) return null
  const name = displayName.trim()
  const exact = ASSIGNEES.find((a) => a === name)
  if (exact) return exact
  const contained = ASSIGNEES.find((a) => name.includes(a))
  return contained ?? null
}
