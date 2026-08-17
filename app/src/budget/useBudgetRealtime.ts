/**
 * useBudgetRealtime.ts — budget_items + payments 구독.
 *
 * 두 테이블을 한 채널에서 듣는다. 채널을 둘로 쪼개면 연결 상태가 두 개가 되고,
 * 화면에는 점이 하나뿐이라 어느 쪽이 끊긴 건지 말해 줄 수 없다.
 *
 * 낙관적 업데이트와 부딪히지 않게 하는 규칙이 셋 있다.
 *
 * 1) 쓰기가 진행 중이면 캐시를 건드리지 않는다.
 *    writeGuard.hasLocalWrites() 가 true 인 동안 들어온 이벤트는 '밀린 변경' 플래그만
 *    세우고 버린다. 쓰기가 전부 끝나면(onLocalWritesSettled) 그때 한 번 무효화한다.
 *    이것이 없으면 내가 방금 고친 금액의 메아리가 돌아와 낙관적 값을 이전 값으로 되돌린다.
 *
 * 2) 이벤트가 오면 refetch 가 아니라 캐시를 직접 고친다.
 *    replica identity full 이라 payload.new 에 행 전체가 들어 있다. 왕복을 한 번
 *    줄이는 것도 있지만, 더 중요한 건 '내가 안 건드린 행만' 정확히 바뀐다는 점이다.
 *    전체 refetch 는 그 순간 캐시 전체를 갈아끼우므로 부작용 범위가 넓다.
 *
 * 3) 재연결(두 번째 이후의 SUBSCRIBED)에서만 전체를 다시 받는다.
 *    끊겨 있던 동안 놓친 이벤트는 복구되지 않기 때문이다. 첫 구독 때는 useQuery 가
 *    막 받아온 참이라 다시 받지 않는다.
 *
 * ── 상대가 결제를 넣었을 때 ─────────────────────────────────
 * payments 이벤트는 payments 캐시에만 반영한다. 뷰(budget_rollup)의 paid_sum 은
 * 낡은 채로 남지만 화면에는 쓰이지 않는다 — selectors 가 payments 캐시로 실지출을
 * 다시 세기 때문이다. 그래서 결제 하나 들어올 때마다 목록 전체를 다시 받지 않는다.
 * (뷰 값은 다음 무효화·재연결·포커스 복귀 때 자연스럽게 따라온다.)
 *
 * 언마운트 시 removeChannel 은 필수다. 안 하면 StrictMode 이중 마운트나 탭 전환마다
 * 채널이 쌓이고, 같은 이벤트를 채널 수만큼 중복 처리하게 된다.
 */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { itemsKey, paymentsKey } from './budgetApi'
import { fromRollup } from './types'
import { hasLocalWrites, onLocalWritesSettled } from './writeGuard'
import type { BudgetItem, BudgetRow, Payment } from './types'

export type RealtimeState = 'connecting' | 'live' | 'offline'

/** 채널 이름은 마운트마다 달라야 한다. StrictMode 에서 이전 채널이 정리되기 전에 새 채널이 생긴다. */
let channelSeq = 0

/**
 * 캐시 한 벌에 이벤트 하나를 반영한다.
 * toRow 가 필요한 이유: budget_items 이벤트는 테이블 행이 오는데 캐시에는 뷰 행
 * (paid_sum·payment_count 가 붙은 BudgetRow)이 들어 있다. 그 두 칸을 채워 줘야 한다.
 */
const applyChange = <Row extends { id: string }, Wire extends { id?: string }>(
  qc: QueryClient,
  key: QueryKey,
  payload: RealtimePostgresChangesPayload<Wire>,
  toRow: (wire: Wire, previous: Row | undefined) => Row | null,
): void => {
  qc.setQueryData<Row[]>(key, (previous) => {
    // 아직 첫 조회조차 끝나지 않았다면 캐시를 만들지 않는다.
    // 여기서 만들면 그 행 하나만 있는 목록이 완성본인 척하게 되고 합계가 틀린다.
    if (!previous) return previous

    if (payload.eventType === 'DELETE') {
      const removedId = (payload.old as Partial<Wire> | null)?.id
      return removedId ? previous.filter((i) => i.id !== removedId) : previous
    }

    const wire = payload.new as Wire | null
    if (!wire?.id) return previous
    const index = previous.findIndex((i) => i.id === wire.id)
    const row = toRow(wire, index === -1 ? undefined : previous[index])
    if (!row) return previous
    if (index === -1) return [...previous, row]
    const next = previous.slice()
    next[index] = row
    return next
  })
}

/**
 * budget_items 행 → 캐시가 들고 있는 뷰 행.
 * 집계 두 칸은 이 이벤트에 들어 있지 않으므로 캐시에 있던 값을 유지한다
 * (없으면 0. 어차피 selectors 가 payments 캐시로 다시 센다).
 */
const toBudgetRow = (wire: BudgetItem, previous: BudgetRow | undefined): BudgetRow | null => {
  const row = fromRollup({
    ...wire,
    paid_sum: previous?.paid_sum ?? 0,
    unpaid: null,
    payment_count: previous?.payment_count ?? 0,
  })
  return row
}

export const useBudgetRealtime = (): RealtimeState => {
  const qc = useQueryClient()
  const [state, setState] = useState<RealtimeState>('connecting')
  const missedRef = useRef(false)
  const subscribedOnceRef = useRef(false)

  // 쓰기가 끝나는 순간, 그동안 밀어둔 변경이 있으면 한 번만 맞춘다.
  useEffect(
    () =>
      onLocalWritesSettled(() => {
        if (!missedRef.current) return
        missedRef.current = false
        void qc.invalidateQueries({ queryKey: itemsKey })
        void qc.invalidateQueries({ queryKey: paymentsKey })
      }),
    [qc],
  )

  useEffect(() => {
    channelSeq += 1
    const channel = supabase
      .channel(`budget-${channelSeq}`)
      .on<BudgetItem>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_items' },
        (payload) => {
          if (hasLocalWrites()) {
            missedRef.current = true
            return
          }
          applyChange<BudgetRow, BudgetItem>(qc, itemsKey, payload, toBudgetRow)
        },
      )
      .on<Payment>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          if (hasLocalWrites()) {
            missedRef.current = true
            return
          }
          applyChange<Payment, Payment>(qc, paymentsKey, payload, (wire) => wire)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState('live')
          if (subscribedOnceRef.current) {
            // 재연결 — 끊긴 동안의 변경은 이벤트로 오지 않으므로 전체를 맞춘다.
            if (hasLocalWrites()) {
              missedRef.current = true
            } else {
              void qc.invalidateQueries({ queryKey: itemsKey })
              void qc.invalidateQueries({ queryKey: paymentsKey })
            }
          }
          subscribedOnceRef.current = true
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState('offline')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [qc])

  return state
}
