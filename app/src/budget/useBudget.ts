/**
 * useBudget.ts — 조회 + 쓰기(항목·결제·업체).
 *
 * 쓰기는 전부 같은 골격을 따른다.
 *   onMutate  : 쓰기 카운터를 올리고 → 진행 중 refetch 취소 → 캐시 스냅샷 → 캐시 선반영
 *   onError   : 스냅샷으로 되돌린다
 *   onSettled : 카운터를 내리고, 남은 쓰기가 없을 때만 무효화한다
 *
 * onSettled 에서 조건 없이 무효화하지 않는 이유:
 *   금액을 연달아 고치면(예산 → 계약금액 → 예정일) 매번 전체 목록을 다시 받아오게 되고,
 *   먼저 끝난 응답이 아직 진행 중인 다른 필드의 낙관적 값을 덮어쓴다.
 *   마지막 쓰기가 끝나는 순간 한 번만 맞추면 충분하다.
 *
 * ── payments 를 건드리면 budget_rollup 도 낡는다 ─────────────
 * 목록은 뷰(budget_rollup)에서 읽는데, 그 뷰의 paid_sum·unpaid 는 payments 의 합계다.
 * 결제를 넣거나 지우면 뷰 쪽 캐시도 같이 낡으므로 두 키를 함께 무효화한다.
 * 다만 화면 숫자는 무효화를 기다리지 않는다 — selectors 가 payments 캐시로 실지출을
 * 다시 세기 때문에(selectors.ts 주석 참고) 잔금은 낙관적 삽입 즉시 움직이고,
 * 무효화는 그 뒤에 서버 값으로 조용히 확인 도장을 찍는 역할만 한다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import {
  deleteItem,
  deletePayment,
  fetchItems,
  fetchPayments,
  fetchVendors,
  insertItem,
  insertPayment,
  insertVendor,
  itemsKey,
  membershipKey,
  newId,
  paymentsKey,
  probeMembership,
  updateItem,
  updatePayment,
  vendorsKey,
} from './budgetApi'
import { beginLocalWrite, endLocalWrite, hasLocalWrites } from './writeGuard'
import type {
  BudgetItemUpdate,
  BudgetRow,
  ItemDraft,
  ItemInsertRow,
  Payment,
  PaymentDraft,
  PaymentInsertRow,
  PaymentUpdate,
  Vendor,
  VendorInsert,
} from './types'

type Snapshot<T> = { previous: T[] | undefined }

const startOptimistic = async <T>(
  qc: QueryClient,
  key: QueryKey,
  update: (previous: T[]) => T[],
): Promise<Snapshot<T>> => {
  // 첫 줄에서 동기적으로 올린다. await 뒤로 밀면 그 사이 도착한 Realtime 이벤트가
  // 아직 '쓰기 없음'으로 판단해 캐시를 덮어쓴다.
  beginLocalWrite()
  await qc.cancelQueries({ queryKey: key })
  const previous = qc.getQueryData<T[]>(key)
  if (previous) qc.setQueryData<T[]>(key, update(previous))
  return { previous }
}

const rollback = <T>(qc: QueryClient, key: QueryKey, context: Snapshot<T> | undefined): void => {
  if (context?.previous) qc.setQueryData<T[]>(key, context.previous)
}

/** 쓰기가 전부 끝났을 때만 무효화한다. keys 가 여럿이면 함께 맞춘다. */
const settle = (qc: QueryClient, keys: QueryKey[]): void => {
  endLocalWrite()
  if (hasLocalWrites()) return
  for (const key of keys) void qc.invalidateQueries({ queryKey: key })
}

/** 항목 insert 행을 화면에 바로 그릴 수 있는 완전한 행으로 부풀린다. */
const materializeItem = (row: ItemInsertRow): BudgetRow => {
  const now = new Date().toISOString()
  return {
    id: row.id,
    label: row.label,
    category: row.category ?? null,
    estimate: row.estimate ?? null,
    contracted: row.contracted ?? null,
    actual: row.actual ?? null,
    paid_at: row.paid_at ?? null,
    due_on: row.due_on ?? null,
    deal_status: row.deal_status ?? null,
    owner: row.owner ?? null,
    vendor_id: row.vendor_id ?? null,
    vendor_name: row.vendor_name ?? null,
    vendor_contact: row.vendor_contact ?? null,
    memo: row.memo ?? null,
    // 시세는 조사로 채우는 값이라 사용자가 새로 만든 항목에는 없다.
    // 되살리기의 경우에도 서버 왕복 후 원래 값이 돌아온다.
    market_avg: row.market_avg ?? null,
    market_note: row.market_note ?? null,
    // 새 항목은 기본이 선지출이다. 축의금 정산 대상은 홀 청구분뿐이라
    // 사용자가 직접 만드는 항목은 거의 전부 우리 돈으로 나간다.
    funding: row.funding ?? '선지출',
    sort_order: row.sort_order ?? 0,
    // 되살리기(삭제 취소)는 원래 created_at 을 그대로 넘긴다. 그래야 목록에서
    // 지우기 전 자리로 돌아온다. 새로 만들 때는 지금 시각.
    created_at: row.created_at ?? now,
    updated_at: row.updated_at ?? now,
    // 뷰가 붙여 주는 집계. 새 항목에는 결제가 없고, 되살린 항목은 selectors 가
    // payments 캐시에서 다시 세므로 여기 값이 화면에 남지 않는다.
    paid_sum: 0,
    payment_count: 0,
  }
}

const materializePayment = (row: PaymentInsertRow): Payment => {
  const now = new Date().toISOString()
  return {
    id: row.id,
    paid_on: row.paid_on,
    budget_item_id: row.budget_item_id ?? null,
    category: row.category ?? null,
    item_label: row.item_label ?? null,
    description: row.description ?? null,
    amount: row.amount,
    method: row.method ?? null,
    payer: row.payer ?? null,
    has_receipt: row.has_receipt ?? false,
    memo: row.memo ?? null,
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
  contracted: draft.contracted,
  due_on: draft.due_on,
  deal_status: draft.deal_status.trim() || null,
  vendor_name: draft.vendor_name.trim() || null,
  vendor_contact: draft.vendor_contact.trim() || null,
  vendor_id: draft.vendor_id,
  owner: draft.owner,
  funding: draft.funding,
  memo: draft.memo.trim() || null,
})

/**
 * 결제 초안 → insert 행.
 * category·item_label 을 항목에서 베껴 둔다. 항목이 지워지면 budget_item_id 가
 * null 로 끊기는데(on delete set null), 그때 이 두 칸이 없으면 무슨 돈이었는지 알 수 없다.
 */
export const buildPaymentRow = (draft: PaymentDraft, item: BudgetRow): PaymentInsertRow => ({
  id: newId(),
  paid_on: draft.paid_on,
  budget_item_id: item.id,
  category: item.category,
  item_label: item.label,
  description: draft.description.trim() || null,
  amount: draft.amount ?? 0,
  method: draft.method.trim() || null,
  payer: draft.payer.trim() || null,
  has_receipt: draft.has_receipt,
  memo: draft.memo.trim() || null,
})

/** 삭제한 항목을 그대로 되돌려 넣기 위한 insert 행. id 와 created_at 을 보존한다. */
export const buildRestoreRow = (item: BudgetRow): ItemInsertRow => ({
  id: item.id,
  label: item.label,
  category: item.category,
  estimate: item.estimate,
  contracted: item.contracted,
  actual: item.actual,
  paid_at: item.paid_at,
  due_on: item.due_on,
  deal_status: item.deal_status,
  owner: item.owner,
  vendor_id: item.vendor_id,
  vendor_name: item.vendor_name,
  vendor_contact: item.vendor_contact,
  memo: item.memo,
  market_avg: item.market_avg,
  market_note: item.market_note,
  funding: item.funding,
  sort_order: item.sort_order,
  created_at: item.created_at,
})

/** 삭제한 결제를 되돌려 넣기 위한 insert 행. */
export const buildRestorePayment = (payment: Payment): PaymentInsertRow => ({
  id: payment.id,
  paid_on: payment.paid_on,
  budget_item_id: payment.budget_item_id,
  category: payment.category,
  item_label: payment.item_label,
  description: payment.description,
  amount: payment.amount,
  method: payment.method,
  payer: payment.payer,
  has_receipt: payment.has_receipt,
  memo: payment.memo,
  created_at: payment.created_at,
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

export const usePaymentsQuery = () =>
  useQuery({
    queryKey: paymentsKey,
    queryFn: fetchPayments,
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

// ── 항목 쓰기 ─────────────────────────────────────────────────

export const useCreateItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'create'],
    mutationFn: (row: ItemInsertRow) => insertItem(row),
    onMutate: (row) =>
      startOptimistic<BudgetRow>(qc, itemsKey, (previous) => [...previous, materializeItem(row)]),
    onError: (_error, _variables, context) => rollback(qc, itemsKey, context),
    onSettled: () => settle(qc, [itemsKey]),
  })
}

export const useUpdateItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: BudgetItemUpdate }) => updateItem(id, patch),
    onMutate: ({ id, patch }) =>
      startOptimistic<BudgetRow>(qc, itemsKey, (previous) =>
        previous.map((item) =>
          item.id === id
            ? // updated_at 은 DB 트리거가 채운다. 여기 넣는 값은 화면용 임시 거울이고
              // 서버로는 보내지 않는다. 무효화 때 진짜 값으로 교체된다.
              { ...item, ...patch, updated_at: new Date().toISOString() }
            : item,
        ),
      ),
    onError: (_error, _variables, context) => rollback(qc, itemsKey, context),
    onSettled: () => settle(qc, [itemsKey]),
  })
}

/**
 * 항목을 지운다. payments.budget_item_id 는 on delete set null 이라 결제 기록은 남고
 * 연결만 끊긴다(그 결제는 '연결 끊긴 결제'로 따로 보인다). 그래서 원장 캐시도 함께 맞춘다.
 */
export const useDeleteItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'delete'],
    mutationFn: (id: string) => deleteItem(id),
    onMutate: (id) =>
      startOptimistic<BudgetRow>(qc, itemsKey, (previous) => previous.filter((i) => i.id !== id)),
    onError: (_error, _variables, context) => rollback(qc, itemsKey, context),
    onSettled: () => settle(qc, [itemsKey, paymentsKey]),
  })
}

/** 삭제 취소. 지운 행을 같은 id 로 다시 넣는다. 상대방 화면에도 되살아난다. */
export const useRestoreItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...itemsKey, 'restore'],
    mutationFn: (row: ItemInsertRow) => insertItem(row),
    onMutate: (row) =>
      startOptimistic<BudgetRow>(qc, itemsKey, (previous) =>
        previous.some((i) => i.id === row.id) ? previous : [...previous, materializeItem(row)],
      ),
    onError: (_error, _variables, context) => rollback(qc, itemsKey, context),
    onSettled: () => settle(qc, [itemsKey, paymentsKey]),
  })
}

// ── 결제 원장 쓰기 ────────────────────────────────────────────

export const useCreatePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...paymentsKey, 'create'],
    mutationFn: (row: PaymentInsertRow) => insertPayment(row),
    onMutate: (row) =>
      startOptimistic<Payment>(qc, paymentsKey, (previous) => [
        ...previous,
        materializePayment(row),
      ]),
    onError: (_error, _variables, context) => rollback(qc, paymentsKey, context),
    // 결제가 바뀌면 뷰의 paid_sum·unpaid 도 바뀐다. 두 키를 함께 맞춘다.
    onSettled: () => settle(qc, [paymentsKey, itemsKey]),
  })
}

export const useUpdatePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...paymentsKey, 'update'],
    mutationFn: ({ id, patch }: { id: string; patch: PaymentUpdate }) => updatePayment(id, patch),
    onMutate: ({ id, patch }) =>
      startOptimistic<Payment>(qc, paymentsKey, (previous) =>
        previous.map((p) =>
          p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p,
        ),
      ),
    onError: (_error, _variables, context) => rollback(qc, paymentsKey, context),
    onSettled: () => settle(qc, [paymentsKey, itemsKey]),
  })
}

export const useDeletePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...paymentsKey, 'delete'],
    mutationFn: (id: string) => deletePayment(id),
    onMutate: (id) =>
      startOptimistic<Payment>(qc, paymentsKey, (previous) => previous.filter((p) => p.id !== id)),
    onError: (_error, _variables, context) => rollback(qc, paymentsKey, context),
    onSettled: () => settle(qc, [paymentsKey, itemsKey]),
  })
}

/** 결제 삭제 취소. 같은 id 로 다시 넣으므로 상대 화면에서도 되살아난다. */
export const useRestorePayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: [...paymentsKey, 'restore'],
    mutationFn: (row: PaymentInsertRow) => insertPayment(row),
    onMutate: (row) =>
      startOptimistic<Payment>(qc, paymentsKey, (previous) =>
        previous.some((p) => p.id === row.id) ? previous : [...previous, materializePayment(row)],
      ),
    onError: (_error, _variables, context) => rollback(qc, paymentsKey, context),
    onSettled: () => settle(qc, [paymentsKey, itemsKey]),
  })
}

// ── 업체 ──────────────────────────────────────────────────────

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
