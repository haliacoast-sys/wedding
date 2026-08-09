/**
 * useBudgetRealtime.ts — budget_items 테이블 구독.
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
 * 언마운트 시 removeChannel 은 필수다. 안 하면 StrictMode 이중 마운트나 탭 전환마다
 * 채널이 쌓이고, 같은 이벤트를 채널 수만큼 중복 처리하게 된다.
 */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { itemsKey } from './budgetApi'
import { hasLocalWrites, onLocalWritesSettled } from './writeGuard'
import type { BudgetItem } from './types'

export type RealtimeState = 'connecting' | 'live' | 'offline'

/** 채널 이름은 마운트마다 달라야 한다. StrictMode 에서 이전 채널이 정리되기 전에 새 채널이 생긴다. */
let channelSeq = 0

const applyChange = (
  qc: QueryClient,
  payload: RealtimePostgresChangesPayload<BudgetItem>,
): void => {
  qc.setQueryData<BudgetItem[]>(itemsKey, (previous) => {
    // 아직 첫 조회조차 끝나지 않았다면 캐시를 만들지 않는다.
    // 여기서 만들면 그 행 하나만 있는 목록이 완성본인 척하게 되고 합계가 틀린다.
    if (!previous) return previous

    if (payload.eventType === 'DELETE') {
      const removedId = (payload.old as Partial<BudgetItem> | null)?.id
      return removedId ? previous.filter((i) => i.id !== removedId) : previous
    }

    const row = payload.new as BudgetItem | null
    if (!row?.id) return previous
    const index = previous.findIndex((i) => i.id === row.id)
    if (index === -1) return [...previous, row]
    const next = previous.slice()
    next[index] = row
    return next
  })
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
      }),
    [qc],
  )

  useEffect(() => {
    channelSeq += 1
    const channel = supabase
      .channel(`budget-items-${channelSeq}`)
      .on<BudgetItem>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_items' },
        (payload) => {
          if (hasLocalWrites()) {
            missedRef.current = true
            return
          }
          applyChange(qc, payload)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState('live')
          if (subscribedOnceRef.current) {
            // 재연결 — 끊긴 동안의 변경은 이벤트로 오지 않으므로 전체를 맞춘다.
            if (hasLocalWrites()) missedRef.current = true
            else void qc.invalidateQueries({ queryKey: itemsKey })
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
