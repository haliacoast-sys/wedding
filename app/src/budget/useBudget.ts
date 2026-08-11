/**
 * useBudget.ts — 조회 + 쓰기(추가/수정/삭제/되살리기/업체 추가).
 *
 * 쓰기는 전부 같은 골격을 따른다.
 *   onMutate  : 쓰기 카운터를 올리고 → 진행 중 refetch 취소 → 캐시 스냅샷 → 캐시 선반영
 *   onError   : 스냅샷으로 되돌린다
 *   onSettled : 카운터를 내리고, 남은 쓰기가 없을 때만 무효화한다
 *
 * onSettled 에서 조건 없이 무효화하지 않는 이유:
 *   금액을 연달아 고치면(견적 → 실제 → 결제일) 매번 전체 목록을 다시 받아오게 되고,
 *   먼저 끝난 응답이 아직 진행 중인 다른 필드의 낙관적 값을 덮어쓴다.
 *   마지막 쓰기가 끝나는 순간 한 번만 맞추면 충분하다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  deleteItem,
  fetchItems,
  fetchVendors,
  insertItem,
  insertVendor,
  itemsKey,
  membershipKey,
  newId,
  probeMembership,
  updateItem,
  vendorsKey,
} from './budgetApi'
import { beginLocalWrite, endLocalWrite, hasLocalWrites } from './writeGuard'
import type {
  BudgetItem,
  BudgetItemUpdate,
  ItemDraft,
  ItemInsertRow,
  Vendor,
  VendorInsert,
} from './types'

type Snapshot = { previous: BudgetItem[] | undefined }

const startOptimistic = async (
  qc: QueryClient,
  update: (previous: BudgetItem[]) => BudgetItem[],
): Promise<Snapshot> => {
  // 첫 줄에서 동기적으로 올린다. await 뒤로 밀면 그 사이 도착한 Realtime 이벤트가
  // 아직 '쓰기 없음'으로 판단해 캐시를 덮어쓴다.
  beginLocalWrite()
  await qc.cancelQueries({ queryKey: itemsKey })
  const previous = qc.getQueryData<BudgetItem[]>(itemsKey)
  if (previous) qc.setQueryData<BudgetItem[]>(itemsKey, update(previous))
  return { previous }
}

const rollback = (qc: QueryClient, context: Snapshot | undefined): void => {
  if (context?.previous) qc.setQueryData<BudgetItem[]>(itemsKey, context.previous)
}

const settle = (qc: QueryClient): void => {
  endLocalWrite()
  if (!hasLocalWrites()) void qc.invalidateQueries({ queryKey: itemsKey })
}

/** insert 행을 화면에 바로 그릴 수 있는 완전한 행으로 부풀린다. */
const materialize = (row: ItemInsertRow): BudgetItem => {
  const now = new Date().toISOString()
  return {
    id: row.id,
    label: row.label,
    category: row.category ?? null,
    estimate: row.estimate ?? null,
    actual: row.actual ?? null,
    paid_at: row.paid_at ?? null,
    vendor_id: row.vendor_id ?? null,
    memo: row.memo ?? null,
    // 시세는 조사로 채우는 값이라 사용자가 새로 만든 항목에는 없다.
    // 되살리기의 경우에도 서버 왕복 후 원래 값이 돌아온다.
    market_avg: row.market_avg ?? null,
    market_note: row.market_note ?? null,
    // 새 항목은 기본이 선지출이다. 축의금 정산 대상은 홀 청구분뿐이라
    // 사용자가 직접 만드는 항목은 거의 전부 우리 돈으로 나간다.
    funding: row.funding ?? '선지출',
    // 되살리기(삭제 취소)는 원래 created_at 을 그대로 넘긴다. 그래야 목록에서
    // 지우기 전 자리로 돌아온다. 새로 만들 때는 지금 시각.
    created_at: row.created_at ?? now,
    updated_at: row.updated_at ?? now,
  }
}

/** 초안 → insert 행. id 를 클라이언트가 정해야 Realtime 메아리와 행이 겹치지 않는다. */
export const buildInsertRow = (draft: ItemDraft): ItemInsertRow => ({
  id: newId(),
  label: draft.label.trim(),
  category: draft.category.trim() || null,
  estimate: draft.estimate,
  actual: draft.actual,
  paid_at: draft.paid_at,
  vendor_id: draft.vendor_id,
  memo: draft.memo.trim() || null,
})

/** 삭제한 행을 그대로 되돌려 넣기 위한 insert 행. id 와 created_at 을 보존한다. */
export const buildRestoreRow = (item: BudgetItem): ItemInsertRow => ({
  id: item.id,
  label: item.label,
  category: item.category,
  estimate: item.estimate,
  actual: item.actual,
  paid_at: item.paid_at,
  vendor_id: item.vendor_id,
  memo: item.memo,
  created_at: item.created_at,
})

// ── 조회 ──────────────────────────────────────────────────────

export const useItemsQuery = () =>
  useQuery({
    queryKey: itemsKey,
    queryFn: fetchItems,
    // Realtime 이 실시간 반영을 맡으므로 폴링은 없다.
    // 구독이 끊겨 있던 동안 놓친 변경을 위해 포커스 복귀 시에는 다시 받는다.
    staleTime: 30_000,
    retry: 1,
  })

export const useVendorsQuery = () =>
  useQuery({
    queryKey: vendorsKey,
    queryFn: fetchVendors,
    staleTime: 5 * 60_000,
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

export const useCreateItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'create'],
    mutationFn: (row: ItemInsertRow) => insertItem(row),
    onMutate: (row) => startOptimistic(qc, (previous) => [...previous, materialize(row)]),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}

export const useUpdateItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: BudgetItemUpdate }) => updateItem(id, patch),
    onMutate: ({ id, patch }) =>
      startOptimistic(qc, (previous) =>
        previous.map((item) =>
          item.id === id
            ? // updated_at 은 DB 트리거가 채운다. 여기 넣는 값은 화면용 임시 거울이고
              // 서버로는 보내지 않는다. 무효화 때 진짜 값으로 교체된다.
              { ...item, ...patch, updated_at: new Date().toISOString() }
            : item,
        ),
      ),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}

export const useDeleteItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'delete'],
    mutationFn: (id: string) => deleteItem(id),
    onMutate: (id) => startOptimistic(qc, (previous) => previous.filter((i) => i.id !== id)),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}

/** 삭제 취소. 지운 행을 같은 id 로 다시 넣는다. 상대방 화면에도 되살아난다. */
export const useRestoreItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'restore'],
    mutationFn: (row: ItemInsertRow) => insertItem(row),
    onMutate: (row) =>
      startOptimistic(qc, (previous) =>
        previous.some((i) => i.id === row.id) ? previous : [...previous, materialize(row)],
      ),
    onError: (_error, _variables, context) => rollback(qc, context),
    onSettled: () => settle(qc),
  })
}

/**
 * 항목 편집 중에 업체를 즉석에서 만든다.
 * vendors 는 Realtime 을 구독하지 않으므로(편집 중에만 쓰는 목록이라 실시간일 필요가 없다)
 * 낙관적 삽입 후 응답이 끝나면 그냥 다시 받아온다.
 */
export const useCreateVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...vendorsKey, 'create'],
    mutationFn: (row: VendorInsert & { id: string }) => insertVendor(row),
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: vendorsKey })
      const previous = qc.getQueryData<Vendor[]>(vendorsKey)
      const now = new Date().toISOString()
      if (previous) {
        qc.setQueryData<Vendor[]>(vendorsKey, [
          ...previous,
          {
            id: row.id,
            name: row.name,
            category: row.category ?? null,
            contact: row.contact ?? null,
            url: row.url ?? null,
            memo: row.memo ?? null,
            created_at: now,
            updated_at: now,
          },
        ])
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData<Vendor[]>(vendorsKey, context.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: vendorsKey })
    },
  })
}
