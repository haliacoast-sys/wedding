/**
 * useGuestsRealtime.ts — 하객 명단의 실시간 동기화.
 *
 * 두 사람이 각자 자기 쪽 하객을 동시에 입력한다. 신랑이 친구 30명을 넣는 동안
 * 신부가 직장 동료를 넣고 있어도, 집계(축의금·식사 인원·보증인원 대비)는
 * 두 사람의 입력을 합친 값이어야 의미가 있다. 그래서 목록을 실시간으로 맞춘다.
 *
 * 낙관적 업데이트와 부딪히지 않게 하는 규칙이 셋 있다.
 *
 * 1) 쓰기가 진행 중이면 캐시를 건드리지 않는다.
 *    writeGuard.hasLocalWrites() 가 true 인 동안 들어온 이벤트는 '밀린 쿼리'로만 적어 두고
 *    버린다. 쓰기가 전부 끝나면 그 쿼리만 한 번 무효화한다. 이게 없으면 내 변경의
 *    메아리가 돌아와 내 낙관적 상태를 이전 값으로 되돌린다.
 *
 *    ★ 여러 명 한 번에 넣을 때 특히 중요하다. 30행 insert 는 INSERT 이벤트 30개로
 *      돌아온다. 막지 않으면 목록이 30번 갈아끼워지고, 그중 하나라도 낙관적 행보다
 *      먼저 처리되면 같은 사람이 두 줄로 남는다.
 *
 * 2) 가능한 한 refetch 대신 캐시를 직접 고친다.
 *    guests 는 replica identity full 이라 payload.new / payload.old 에 행 전체가 들어 있다.
 *    이 화면은 뷰를 거치지 않으므로 payload 행을 그대로 캐시에 넣어도 서버 상태와 같다.
 *    (진행표는 뷰가 계산하는 컬럼 때문에 이게 불가능했다. 여기는 그 제약이 없다.)
 *
 * 3) 아직 첫 조회가 끝나지 않았으면 캐시를 만들지 않는다.
 *    거기서 만들면 그 행 하나만 있는 목록이 완성본인 척하고, 집계가 1명 기준으로 나온다.
 *
 * 언마운트 시 removeChannel 은 필수다. 안 하면 StrictMode 이중 마운트나 탭 전환마다
 * 채널이 쌓이고 같은 이벤트를 채널 수만큼 중복 처리하게 된다.
 */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { guestsKey } from './guestsApi'
import { hasLocalWrites, onLocalWritesSettled } from './writeGuard'
import type { Guest } from './types'

export type RealtimeState = 'connecting' | 'live' | 'offline'

/** 채널 이름은 마운트마다 달라야 한다. StrictMode 에서 이전 채널이 정리되기 전에 새 채널이 생긴다. */
let channelSeq = 0

/** 처리 결과. false 면 "캐시만으로는 못 맞춘다 → 서버에서 다시 받아라". */
type Handled = boolean

const applyChange = (
  qc: QueryClient,
  payload: RealtimePostgresChangesPayload<Guest>,
): Handled => {
  const cached = qc.getQueryData<Guest[]>(guestsKey)
  if (!cached) return true // 첫 조회 전. 곧 도착할 응답이 정답이다.

  if (payload.eventType === 'DELETE') {
    const removedId = (payload.old as Partial<Guest> | null)?.id
    if (!removedId) return false
    qc.setQueryData<Guest[]>(
      guestsKey,
      cached.filter((g) => g.id !== removedId),
    )
    return true
  }

  const row = payload.new as Guest | null
  if (!row?.id) return false

  const index = cached.findIndex((g) => g.id === row.id)
  if (index === -1) {
    qc.setQueryData<Guest[]>(guestsKey, [...cached, row])
    return true
  }
  const next = cached.slice()
  next[index] = row
  qc.setQueryData<Guest[]>(guestsKey, next)
  return true
}

export const useGuestsRealtime = (): RealtimeState => {
  const qc = useQueryClient()
  const [state, setState] = useState<RealtimeState>('connecting')
  /** 쓰기 중이라 미뤄 둔 사실. 이 화면은 캐시가 하나라 boolean 이면 충분하다. */
  const missedRef = useRef(false)
  const subscribedOnceRef = useRef(false)

  // 쓰기가 끝나는 순간, 그동안 밀어둔 변경이 있었다면 한 번만 맞춘다.
  useEffect(
    () =>
      onLocalWritesSettled(() => {
        if (!missedRef.current) return
        missedRef.current = false
        void qc.invalidateQueries({ queryKey: guestsKey })
      }),
    [qc],
  )

  useEffect(() => {
    channelSeq += 1
    const channel = supabase
      .channel(`guests-${channelSeq}`)
      .on<Guest>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guests' },
        (payload) => {
          if (hasLocalWrites()) {
            missedRef.current = true
            return
          }
          if (!applyChange(qc, payload)) void qc.invalidateQueries({ queryKey: guestsKey })
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState('live')
          if (subscribedOnceRef.current) {
            // 재연결 — 끊긴 동안의 변경은 이벤트로 오지 않으므로 통째로 다시 맞춘다.
            if (hasLocalWrites()) missedRef.current = true
            else void qc.invalidateQueries({ queryKey: guestsKey })
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
