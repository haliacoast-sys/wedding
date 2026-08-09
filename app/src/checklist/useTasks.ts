/**
 * useTasks.ts — 조회 + 네 가지 쓰기(추가/수정/상태토글/삭제).
 *
 * 쓰기는 전부 같은 골격을 따른다.
 *   onMutate  : 쓰기 카운터를 올리고 → 진행 중 refetch 취소 → 캐시 스냅샷 → 캐시 선반영
 *   onError   : 스냅샷으로 되돌린다
 *   onSettled : 카운터를 내리고, 남은 쓰기가 없을 때만 무효화한다
 *
 * onSettled 에서 조건 없이 무효화하지 않는 이유:
 *   체크박스를 연달아 여러 개 누르면 매번 전체 목록을 다시 받아오게 되고,
 *   먼저 끝난 응답이 아직 진행 중인 다른 항목의 낙관적 상태를 덮어쓴다.
 *   마지막 쓰기가 끝나는 순간 한 번만 맞추면 충분하다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  deleteTask,
  fetchTasks,
  insertTask,
  membershipKey,
  newTaskId,
  probeMembership,
  tasksKey,
  updateTask,
} from './tasksApi'
import { nextSortOrder } from './selectors'
import { beginLocalWrite, endLocalWrite, hasLocalWrites } from './writeGuard'
import type { Task, TaskDraft, TaskInsert, TaskStatus, TaskUpdate } from './types'

type Snapshot = { previous: Task[] | undefined }

const startOptimistic = async (
  qc: QueryClient,
  update: (previous: Task[]) => Task[],
): Promise<Snapshot> => {
  // 첫 줄에서 동기적으로 올린다. await 뒤로 밀면 그 사이 도착한 Realtime 이벤트가
  // 아직 '쓰기 없음'으로 판단해 캐시를 덮어쓴다.
  beginLocalWrite()
  await qc.cancelQueries({ queryKey: tasksKey })
  const previous = qc.getQueryData<Task[]>(tasksKey)
  if (previous) qc.setQueryData<Task[]>(tasksKey, update(previous))
  return { previous }
}

const rollback = (qc: QueryClient, context: Snapshot | undefined): void => {
  if (context?.previous) qc.setQueryData<Task[]>(tasksKey, context.previous)
}

const settle = (qc: QueryClient): void => {
  endLocalWrite()
  if (!hasLocalWrites()) void qc.invalidateQueries({ queryKey: tasksKey })
}

/**
 * done_at 은 DB 트리거가 채운다. 여기서 넣는 값은 화면에서만 쓰는 임시 거울이고
 * 서버로는 절대 보내지 않는다. onSettled 무효화 때 진짜 값으로 교체된다.
 */
const mirrorDoneAt = (status: TaskStatus): string | null =>
  status === 'done' ? new Date().toISOString() : null

const applyPatch = (task: Task, patch: TaskUpdate): Task => {
  const next: Task = { ...task, ...patch } as Task
  if (patch.status !== undefined && patch.status !== task.status) {
    next.done_at = mirrorDoneAt(patch.status)
  }
  next.updated_at = new Date().toISOString()
  return next
}

/** 초안 → insert 행. id 를 클라이언트가 정해야 Realtime 메아리와 행이 겹치지 않는다. */
export const buildTaskInsert = (existing: Task[], draft: TaskDraft): TaskInsert & { id: string } => ({
  id: newTaskId(),
  title: draft.title.trim(),
  category: draft.category.trim() || '기타',
  due_date: draft.due_date,
  assignee: draft.assignee,
  status: draft.status,
  note: draft.note?.trim() ? draft.note.trim() : null,
  sort_order: nextSortOrder(existing, draft.category.trim() || '기타'),
})

/** insert 행을 화면에 바로 그릴 수 있는 완전한 Task 로 부풀린다. */
const materialize = (row: TaskInsert & { id: string }): Task => {
  const now = new Date().toISOString()
  const status = row.status ?? 'todo'
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? null,
    category: row.category,
    due_date: row.due_date ?? null,
    assignee: row.assignee ?? null,
    status,
    vendor_id: row.vendor_id ?? null,
    sort_order: row.sort_order ?? 0,
    created_by: row.created_by ?? null,
    done_at: mirrorDoneAt(status),
    created_at: now,
    updated_at: now,
  }
}

// ── 조회 ──────────────────────────────────────────────────────

export const useTasksQuery = () =>
  useQuery({
    queryKey: tasksKey,
    queryFn: fetchTasks,
    // Realtime 이 실시간 반영을 맡으므로 폴링은 필요 없다.
    // 다만 구독이 끊겨 있던 동안 놓친 변경을 위해 포커스 복귀 시에는 다시 받는다.
    staleTime: 30_000,
    retry: 1,
  })

/**
 * 0행인데 에러가 없을 때만 켠다.
 * 항상 켜두면 정상 상태에서도 매번 rpc 를 한 번씩 더 부르게 된다.
 */
export const useMembershipProbe = (enabled: boolean) =>
  useQuery({
    queryKey: membershipKey,
    queryFn: probeMembership,
    enabled,
    retry: false,
    staleTime: 60_000,
  })

// ── 쓰기 ──────────────────────────────────────────────────────

/** 체크박스. todo ↔ done 뿐 아니라 doing/hold 에서 done 으로도 넘어온다. */
export const useToggleStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...tasksKey, 'toggle'],
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTask(id, { status }),
    onMutate: ({ id, status }) =>
      startOptimistic(qc, (previous) =>
        previous.map((t) => (t.id === id ? applyPatch(t, { status }) : t)),
      ),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}

export const useCreateTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...tasksKey, 'create'],
    mutationFn: (row: TaskInsert & { id: string }) => insertTask(row),
    onMutate: (row) => startOptimistic(qc, (previous) => [...previous, materialize(row)]),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}

export const useUpdateTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...tasksKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdate }) => updateTask(id, patch),
    onMutate: ({ id, patch }) =>
      startOptimistic(qc, (previous) =>
        previous.map((t) => (t.id === id ? applyPatch(t, patch) : t)),
      ),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}

export const useDeleteTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...tasksKey, 'delete'],
    mutationFn: ({ id }: { id: string }) => deleteTask(id),
    onMutate: ({ id }) =>
      startOptimistic(qc, (previous) => previous.filter((t) => t.id !== id)),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}
