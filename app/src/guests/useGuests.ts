/**
 * useGuests.ts — 조회와 쓰기.
 *
 * 쓰기는 전부 같은 골격이다.
 *   onMutate  : 쓰기 카운터를 올리고 → 진행 중 refetch 취소 → 캐시 스냅샷 → 캐시 선반영
 *   onError   : 스냅샷으로 되돌린다
 *   onSettled : 카운터를 내리고, 남은 쓰기가 없을 때만 무효화한다
 *
 * onSettled 에서 조건 없이 무효화하지 않는 이유:
 *   명단을 훑으며 참석 여부를 연달아 누른다. 매번 전체 목록을 다시 받아오면
 *   먼저 끝난 응답이 아직 진행 중인 다른 행의 낙관적 상태를 덮어쓴다.
 *   마지막 쓰기가 끝나는 순간 한 번만 맞추면 충분하다.
 *
 * ★ 이 화면은 뷰를 거치지 않는다.
 *   진행표(day_of_schedule)와 달리 guests 는 테이블을 그대로 읽고 그대로 쓴다.
 *   서버가 계산해 주는 컬럼이 없으므로 낙관적 행을 클라이언트가 완전히 지어낼 수 있다.
 *   단 하나 예외가 updated_at 인데, 화면에 쓰지 않으므로 대충 채워도 해가 없다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  configKey,
  deleteGuest,
  fetchConfig,
  fetchGuests,
  guestsKey,
  insertGuests,
  membershipKey,
  newId,
  probeMembership,
  updateGuest,
} from './guestsApi'
import { nextSortOrder } from './selectors'
import { beginLocalWrite, endLocalWrite, hasLocalWrites } from './writeGuard'
import type { Guest, GuestDraft, GuestInsert, GuestUpdate, WeddingSide } from './types'

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

/** 남은 쓰기가 없을 때만 무효화한다. */
const settle = (qc: QueryClient, key: readonly unknown[]) => {
  endLocalWrite()
  if (hasLocalWrites()) return
  void qc.invalidateQueries({ queryKey: key })
}

const nowIso = () => new Date().toISOString()

const trimOrNull = (value: string | null | undefined): string | null => {
  const t = value?.trim()
  return t ? t : null
}

// ══ 조회 ══════════════════════════════════════════════════════

export const useGuestsQuery = () =>
  useQuery({ queryKey: guestsKey, queryFn: fetchGuests, staleTime: 30_000, retry: 1 })

/**
 * 보증인원·1인 식대가 들어 있는 한 행.
 *
 * day_of_config 는 Realtime publication 에 없다(20260809000005 는 events/items/roles 만,
 * 20260817000001 은 payments/guests 만 추가한다). 즉 상대가 보증인원을 바꿔도
 * 이벤트가 오지 않는다. 그래서 여기만 staleTime 을 짧게 두어 화면에 다시 들어오거나
 * 포커스가 돌아올 때 비교적 빨리 따라잡게 한다.
 */
export const useConfigQuery = () =>
  useQuery({ queryKey: configKey, queryFn: fetchConfig, staleTime: 10_000, retry: 1 })

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

// ══ insert 행 만들기 ══════════════════════════════════════════

/**
 * 초안 → guests insert 행.
 * id 를 클라이언트가 정해야 Realtime INSERT 메아리가 도착했을 때 같은 행으로 인식돼
 * 목록에 같은 사람이 두 줄로 남지 않는다.
 */
export const buildInsert = (
  existing: Guest[],
  draft: GuestDraft,
  sortOrder?: number,
): GuestInsert & { id: string } => ({
  id: newId(),
  name: draft.name.trim(),
  side: draft.side,
  relation: trimOrNull(draft.relation),
  contact: trimOrNull(draft.contact),
  invitation: draft.invitation,
  attending: draft.attending,
  head_count: draft.head_count,
  meal_count: draft.meal_count,
  gift_amount: draft.gift_amount,
  thanks: trimOrNull(draft.thanks),
  memo: trimOrNull(draft.memo),
  sort_order: sortOrder ?? nextSortOrder(existing),
})

/**
 * 여러 명을 한 번에. sort_order 를 100씩 띄워 붙여넣은 원본 순서를 그대로 지킨다.
 * (같은 값을 주면 이름순으로 재정렬돼 엑셀과 대조가 안 된다.)
 */
export const buildInserts = (
  existing: Guest[],
  drafts: GuestDraft[],
): (GuestInsert & { id: string })[] => {
  const base = nextSortOrder(existing)
  return drafts.map((draft, i) => buildInsert(existing, draft, base + i * 100))
}

/** insert 행을 화면에 바로 그릴 수 있는 완전한 행으로 부풀린다. */
const materialize = (row: GuestInsert & { id: string }): Guest => {
  const now = nowIso()
  return {
    id: row.id,
    name: row.name,
    side: row.side ?? '공통',
    relation: row.relation ?? null,
    contact: row.contact ?? null,
    invitation: row.invitation ?? '미전달',
    attending: row.attending ?? '미정',
    head_count: row.head_count ?? 1,
    meal_count: row.meal_count ?? 1,
    gift_amount: row.gift_amount ?? null,
    thanks: row.thanks ?? null,
    memo: row.memo ?? null,
    sort_order: row.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  }
}

// ══ 쓰기 ══════════════════════════════════════════════════════

export const useCreateGuests = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...guestsKey, 'create'],
    mutationFn: (rows: (GuestInsert & { id: string })[]) => insertGuests(rows),
    onMutate: (rows) =>
      startOptimistic<Guest[]>(qc, guestsKey, (previous) => [...previous, ...rows.map(materialize)]),
    onError: (_e, _v, ctx) => rollback(qc, guestsKey, ctx),
    onSettled: () => settle(qc, guestsKey),
  })
}

export const useUpdateGuest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...guestsKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: GuestUpdate }) => updateGuest(id, patch),
    onMutate: ({ id, patch }) =>
      startOptimistic<Guest[]>(qc, guestsKey, (previous) =>
        previous.map((g) => (g.id === id ? { ...g, ...patch, updated_at: nowIso() } : g)),
      ),
    onError: (_e, _v, ctx) => rollback(qc, guestsKey, ctx),
    onSettled: () => settle(qc, guestsKey),
  })
}

export const useDeleteGuest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...guestsKey, 'delete'],
    mutationFn: ({ id }: { id: string }) => deleteGuest(id),
    onMutate: ({ id }) =>
      startOptimistic<Guest[]>(qc, guestsKey, (previous) => previous.filter((g) => g.id !== id)),
    onError: (_e, _v, ctx) => rollback(qc, guestsKey, ctx),
    onSettled: () => settle(qc, guestsKey),
  })
}

/**
 * 참석 여부 한 칸만 바꾸는 전용 경로.
 * 목록에서 제일 자주 누르는 동작이라 편집 시트를 열지 않고 행에서 바로 돌린다.
 * 미정 → 참석 → 불참 → 미정 으로 순환한다.
 */
export const nextAttendance = (current: Guest['attending']): Guest['attending'] =>
  current === '미정' ? '참석' : current === '참석' ? '불참' : '미정'

/** 다음 청첩장 상태. 미전달 → 전달완료 → 모바일 → 미전달. */
export const nextInvitation = (current: Guest['invitation']): Guest['invitation'] =>
  current === '미전달' ? '전달완료' : current === '전달완료' ? '모바일' : '미전달'

/** 빠른 추가에서 쓰는 최소 초안. 이름과 측만 있으면 행이 만들어진다. */
export const quickDraft = (
  name: string,
  side: WeddingSide,
  relation: string | null,
): GuestDraft => ({
  name,
  side,
  relation,
  contact: null,
  invitation: '미전달',
  attending: '미정',
  head_count: 1,
  meal_count: 1,
  gift_amount: null,
  thanks: null,
  memo: null,
})
