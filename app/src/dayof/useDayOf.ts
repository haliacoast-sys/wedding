/**
 * useDayOf.ts — 조회와 쓰기.
 *
 * 쓰기는 전부 같은 골격이다.
 *   onMutate  : 쓰기 카운터를 올리고 → 진행 중 refetch 취소 → 캐시 스냅샷 → 캐시 선반영
 *   onError   : 스냅샷으로 되돌린다
 *   onSettled : 카운터를 내리고, 남은 쓰기가 없을 때만 무효화한다
 *
 * onSettled 에서 조건 없이 무효화하지 않는 이유:
 *   당일 현장에서는 체크를 연달아 누른다. 매번 전체 목록을 다시 받아오면
 *   먼저 끝난 응답이 아직 진행 중인 다른 항목의 낙관적 상태를 덮어쓴다.
 *   마지막 쓰기가 끝나는 순간 한 번만 맞추면 충분하다.
 *
 * ★ 진행표는 읽는 곳과 쓰는 곳이 다르다.
 *   캐시(scheduleKey)에는 뷰 행이 들어 있고, 쓰기는 day_of_events 테이블로 나간다.
 *   그래서 낙관적 반영은 "뷰 행의 모양으로" 하되, 뷰가 계산하는 컬럼
 *   (starts_at/ends_at)은 클라이언트가 절대 지어내지 않는다.
 *   offset 이 바뀌었거나 새로 만든 행이면 그 두 값을 null 로 두고,
 *   서버 왕복이 끝난 뒤 뷰에서 진짜 값을 받아 채운다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  configKey,
  deleteEvent,
  deleteItem,
  deleteRole,
  fetchConfig,
  fetchItems,
  fetchRoles,
  fetchSchedule,
  insertEvent,
  insertItem,
  insertRole,
  itemsKey,
  membershipKey,
  newId,
  probeMembership,
  rolesKey,
  scheduleKey,
  updateConfig,
  updateEvent,
  updateItem,
  updateRole,
  upsertConfig,
} from './dayofApi'
import { nextEventSortOrder, nextItemSortOrder, nextRoleSortOrder } from './selectors'
import { beginLocalWrite, endLocalWrite, hasLocalWrites } from './writeGuard'
import type {
  DayOfConfig,
  DayOfConfigUpdate,
  EventDraft,
  EventInsert,
  EventUpdate,
  Item,
  ItemDraft,
  ItemInsert,
  ItemUpdate,
  Role,
  RoleDraft,
  RoleInsert,
  RoleUpdate,
  ScheduleRow,
} from './types'

type Snapshot<T> = { previous: T | undefined }

const startOptimistic = async <T>(
  qc: QueryClient,
  key: readonly unknown[],
  update: (previous: T) => T,
): Promise<Snapshot<T>> => {
  // 첫 줄에서 동기적으로 올린다. await 뒤로 밀면 그 사이 도착한 Realtime 이벤트가
  // 아직 '쓰기 없음'으로 판단해 캐시를 덮어쓴다.
  beginLocalWrite()
  await qc.cancelQueries({ queryKey: key })
  const previous = qc.getQueryData<T>(key)
  if (previous !== undefined) qc.setQueryData<T>(key, update(previous))
  return { previous }
}

const rollback = <T>(qc: QueryClient, key: readonly unknown[], ctx: Snapshot<T> | undefined) => {
  if (ctx && ctx.previous !== undefined) qc.setQueryData<T>(key, ctx.previous)
}

/**
 * 남은 쓰기가 없을 때만 무효화한다.
 * extra 로 함께 맞출 쿼리를 넘길 수 있다. 예: 역할 이름이 바뀌면 진행표의
 * role_name/role_person 도 따라 바뀌므로 진행표까지 다시 받아야 한다.
 */
const settle = (
  qc: QueryClient,
  key: readonly unknown[],
  extra: readonly (readonly unknown[])[] = [],
) => {
  endLocalWrite()
  if (hasLocalWrites()) return
  void qc.invalidateQueries({ queryKey: key })
  for (const other of extra) void qc.invalidateQueries({ queryKey: other })
}

const nowIso = () => new Date().toISOString()

const trimOrNull = (value: string | null | undefined): string | null => {
  const t = value?.trim()
  return t ? t : null
}

// ══ 조회 ══════════════════════════════════════════════════════

export const useConfigQuery = () =>
  useQuery({
    queryKey: configKey,
    queryFn: fetchConfig,
    // day_of_config 는 Realtime publication 에 없다(마이그레이션 8절은 events/items/roles 만 추가).
    // 즉 상대가 예식 시각을 바꿔도 이벤트가 오지 않는다. 그래서 여기만 staleTime 을 짧게 두어
    // 화면에 다시 들어오거나 포커스가 돌아올 때 비교적 빨리 따라잡게 한다.
    staleTime: 10_000,
    retry: 1,
  })

export const useScheduleQuery = () =>
  useQuery({
    queryKey: scheduleKey,
    queryFn: fetchSchedule,
    staleTime: 30_000,
    retry: 1,
  })

export const useRolesQuery = () =>
  useQuery({ queryKey: rolesKey, queryFn: fetchRoles, staleTime: 30_000, retry: 1 })

export const useItemsQuery = () =>
  useQuery({ queryKey: itemsKey, queryFn: fetchItems, staleTime: 30_000, retry: 1 })

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

// ══ 기준 시각 ═════════════════════════════════════════════════

/**
 * ceremony_at 한 행만 고치면 진행표 전체가 따라 움직인다.
 * 그래서 성공 후에는 진행표 캐시도 반드시 함께 무효화한다.
 * (뷰가 다시 계산해 주기 전까지 화면의 시각은 옛 값이다.)
 */
export const useUpdateConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...configKey, 'update'],
    mutationFn: ({ patch, missing }: { patch: DayOfConfigUpdate; missing: boolean }) => {
      // 시드가 안 들어가 행 자체가 없는 경우가 있다. 그때는 update 가 0행을 고치고
      // 조용히 성공한다 — 화면은 저장된 척하고 진행표는 계속 비어 있다. 그래서 upsert 로 간다.
      const ceremonyAt = patch.ceremony_at
      if (missing && ceremonyAt) return upsertConfig({ ...patch, ceremony_at: ceremonyAt })
      return updateConfig(patch)
    },
    onMutate: ({ patch }) =>
      startOptimistic<DayOfConfig | null>(qc, configKey, (previous) =>
        previous ? { ...previous, ...patch, updated_at: nowIso() } : previous,
      ),
    onError: (_e, _v, ctx) => rollback(qc, configKey, ctx),
    // 시각이 바뀌면 모든 항목의 starts_at 이 바뀐다. 진행표를 통째로 다시 받는다.
    onSettled: () => settle(qc, configKey, [scheduleKey]),
  })
}

// ══ 진행표 ════════════════════════════════════════════════════

/** 초안 → day_of_events insert 행. id 를 클라이언트가 정해야 Realtime 메아리와 행이 겹치지 않는다. */
export const buildEventInsert = (
  existing: ScheduleRow[],
  draft: EventDraft,
): EventInsert & { id: string } => ({
  id: newId(),
  phase: draft.phase,
  offset_min: draft.offset_min,
  duration_min: draft.duration_min,
  title: draft.title.trim(),
  location: trimOrNull(draft.location),
  role_id: draft.role_id,
  note: trimOrNull(draft.note),
  status: draft.status,
  sort_order: nextEventSortOrder(existing, draft.offset_min),
})

/**
 * insert 행을 화면에 바로 그릴 수 있는 뷰 행 모양으로 부풀린다.
 * starts_at/ends_at 은 비운다 — 뷰만이 계산할 수 있는 값이다.
 * 역할 이름은 이미 받아 둔 roles 캐시에서 조인해 채운다(이건 단순 조인이라 안전하다).
 */
const materializeEvent = (row: EventInsert & { id: string }, roles: Role[]): ScheduleRow => {
  const role = row.role_id ? roles.find((r) => r.id === row.role_id) : undefined
  return {
    id: row.id,
    phase: row.phase,
    offset_min: row.offset_min,
    duration_min: row.duration_min ?? null,
    title: row.title,
    location: row.location ?? null,
    role_id: row.role_id ?? null,
    role_name: role?.role ?? null,
    role_person: role?.person_name ?? null,
    note: row.note ?? null,
    status: row.status ?? 'todo',
    sort_order: row.sort_order ?? 0,
    starts_at: null,
    ends_at: null,
  }
}

const applyEventPatch = (row: ScheduleRow, patch: EventUpdate, roles: Role[]): ScheduleRow => {
  const next: ScheduleRow = { ...row }
  if (patch.phase !== undefined) next.phase = patch.phase
  if (patch.title !== undefined) next.title = patch.title
  if (patch.location !== undefined) next.location = patch.location ?? null
  if (patch.note !== undefined) next.note = patch.note ?? null
  if (patch.status !== undefined) next.status = patch.status
  if (patch.sort_order !== undefined) next.sort_order = patch.sort_order

  if (patch.role_id !== undefined) {
    next.role_id = patch.role_id ?? null
    const role = patch.role_id ? roles.find((r) => r.id === patch.role_id) : undefined
    next.role_name = role?.role ?? null
    next.role_person = role?.person_name ?? null
  }

  // 시각을 움직이는 두 컬럼. 바뀌면 실제 시각은 뷰가 다시 계산해야 하므로 비운다.
  const offsetChanged = patch.offset_min !== undefined && patch.offset_min !== row.offset_min
  const durationChanged =
    patch.duration_min !== undefined && (patch.duration_min ?? null) !== row.duration_min
  if (patch.offset_min !== undefined) next.offset_min = patch.offset_min
  if (patch.duration_min !== undefined) next.duration_min = patch.duration_min ?? null
  if (offsetChanged) {
    next.starts_at = null
    next.ends_at = null
  } else if (durationChanged) {
    next.ends_at = null
  }

  return next
}

/** 체크 토글. done 이면 todo 로, 그 밖(todo/doing/hold)이면 done 으로. */
export const useToggleEventStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...scheduleKey, 'toggle'],
    mutationFn: ({ id, status }: { id: string; status: ScheduleRow['status'] }) =>
      updateEvent(id, { status }),
    onMutate: ({ id, status }) =>
      startOptimistic<ScheduleRow[]>(qc, scheduleKey, (previous) =>
        previous.map((r) => (r.id === id ? { ...r, status } : r)),
      ),
    onError: (_e, _v, ctx) => rollback(qc, scheduleKey, ctx),
    onSettled: () => settle(qc, scheduleKey),
  })
}

export const useCreateEvent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...scheduleKey, 'create'],
    mutationFn: (row: EventInsert & { id: string }) => insertEvent(row),
    onMutate: (row) => {
      const roles = qc.getQueryData<Role[]>(rolesKey) ?? []
      return startOptimistic<ScheduleRow[]>(qc, scheduleKey, (previous) => [
        ...previous,
        materializeEvent(row, roles),
      ])
    },
    onError: (_e, _v, ctx) => rollback(qc, scheduleKey, ctx),
    onSettled: () => settle(qc, scheduleKey),
  })
}

export const useUpdateEvent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...scheduleKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: EventUpdate }) => updateEvent(id, patch),
    onMutate: ({ id, patch }) => {
      const roles = qc.getQueryData<Role[]>(rolesKey) ?? []
      return startOptimistic<ScheduleRow[]>(qc, scheduleKey, (previous) =>
        previous.map((r) => (r.id === id ? applyEventPatch(r, patch, roles) : r)),
      )
    },
    onError: (_e, _v, ctx) => rollback(qc, scheduleKey, ctx),
    onSettled: () => settle(qc, scheduleKey),
  })
}

export const useDeleteEvent = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...scheduleKey, 'delete'],
    mutationFn: ({ id }: { id: string }) => deleteEvent(id),
    onMutate: ({ id }) =>
      startOptimistic<ScheduleRow[]>(qc, scheduleKey, (previous) =>
        previous.filter((r) => r.id !== id),
      ),
    onError: (_e, _v, ctx) => rollback(qc, scheduleKey, ctx),
    onSettled: () => settle(qc, scheduleKey),
  })
}

// ══ 역할 ══════════════════════════════════════════════════════

export const buildRoleInsert = (existing: Role[], draft: RoleDraft): RoleInsert & { id: string } => ({
  id: newId(),
  role: draft.role.trim(),
  side: draft.side,
  person_name: trimOrNull(draft.person_name),
  contact: trimOrNull(draft.contact),
  fee: draft.fee,
  confirmed: draft.confirmed,
  note: trimOrNull(draft.note),
  sort_order: nextRoleSortOrder(existing),
})

const materializeRole = (row: RoleInsert & { id: string }): Role => {
  const now = nowIso()
  return {
    id: row.id,
    role: row.role,
    side: row.side ?? '공통',
    person_name: row.person_name ?? null,
    contact: row.contact ?? null,
    fee: row.fee ?? null,
    confirmed: row.confirmed ?? false,
    note: row.note ?? null,
    sort_order: row.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  }
}

/** 역할이 바뀌면 진행표의 role_name/role_person 도 바뀐다. 진행표까지 함께 맞춘다. */
const settleRoles = (qc: QueryClient) => settle(qc, rolesKey, [scheduleKey])

export const useCreateRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...rolesKey, 'create'],
    mutationFn: (row: RoleInsert & { id: string }) => insertRole(row),
    onMutate: (row) =>
      startOptimistic<Role[]>(qc, rolesKey, (previous) => [...previous, materializeRole(row)]),
    onError: (_e, _v, ctx) => rollback(qc, rolesKey, ctx),
    onSettled: () => settleRoles(qc),
  })
}

export const useUpdateRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...rolesKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: RoleUpdate }) => updateRole(id, patch),
    onMutate: ({ id, patch }) =>
      startOptimistic<Role[]>(qc, rolesKey, (previous) =>
        previous.map((r) => (r.id === id ? { ...r, ...patch, updated_at: nowIso() } : r)),
      ),
    onError: (_e, _v, ctx) => rollback(qc, rolesKey, ctx),
    onSettled: () => settleRoles(qc),
  })
}

export const useDeleteRole = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...rolesKey, 'delete'],
    mutationFn: ({ id }: { id: string }) => deleteRole(id),
    onMutate: ({ id }) =>
      startOptimistic<Role[]>(qc, rolesKey, (previous) => previous.filter((r) => r.id !== id)),
    onError: (_e, _v, ctx) => rollback(qc, rolesKey, ctx),
    // 역할이 지워지면 그 역할을 참조하던 진행표 항목의 role_id 가 null 로 바뀐다
    // (on delete set null). 진행표를 다시 받아야 담당자 표시가 정확해진다.
    onSettled: () => settleRoles(qc),
  })
}

// ══ 준비물 ════════════════════════════════════════════════════

export const buildItemInsert = (existing: Item[], draft: ItemDraft): ItemInsert & { id: string } => {
  const category = draft.category.trim() || '기타'
  return {
    id: newId(),
    label: draft.label.trim(),
    category,
    owner: draft.owner,
    packed: false,
    note: trimOrNull(draft.note),
    sort_order: nextItemSortOrder(existing, category),
  }
}

const materializeItem = (row: ItemInsert & { id: string }): Item => {
  const now = nowIso()
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    owner: row.owner ?? null,
    packed: row.packed ?? false,
    note: row.note ?? null,
    sort_order: row.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  }
}

export const useTogglePacked = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'toggle'],
    mutationFn: ({ id, packed }: { id: string; packed: boolean }) => updateItem(id, { packed }),
    onMutate: ({ id, packed }) =>
      startOptimistic<Item[]>(qc, itemsKey, (previous) =>
        previous.map((i) => (i.id === id ? { ...i, packed } : i)),
      ),
    onError: (_e, _v, ctx) => rollback(qc, itemsKey, ctx),
    onSettled: () => settle(qc, itemsKey),
  })
}

export const useCreateItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'create'],
    mutationFn: (row: ItemInsert & { id: string }) => insertItem(row),
    onMutate: (row) =>
      startOptimistic<Item[]>(qc, itemsKey, (previous) => [...previous, materializeItem(row)]),
    onError: (_e, _v, ctx) => rollback(qc, itemsKey, ctx),
    onSettled: () => settle(qc, itemsKey),
  })
}

export const useUpdateItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: ItemUpdate }) => updateItem(id, patch),
    onMutate: ({ id, patch }) =>
      startOptimistic<Item[]>(qc, itemsKey, (previous) =>
        previous.map((i) => (i.id === id ? { ...i, ...patch, updated_at: nowIso() } : i)),
      ),
    onError: (_e, _v, ctx) => rollback(qc, itemsKey, ctx),
    onSettled: () => settle(qc, itemsKey),
  })
}

export const useDeleteItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'delete'],
    mutationFn: ({ id }: { id: string }) => deleteItem(id),
    onMutate: ({ id }) =>
      startOptimistic<Item[]>(qc, itemsKey, (previous) => previous.filter((i) => i.id !== id)),
    onError: (_e, _v, ctx) => rollback(qc, itemsKey, ctx),
    onSettled: () => settle(qc, itemsKey),
  })
}
