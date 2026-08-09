/**
 * useDayOfRealtime.ts — 당일 화면의 실시간 동기화.
 *
 * 이 화면이 이 앱에서 실시간이 가장 중요한 곳이다. 예식 당일 두 사람이 각자 폰으로
 * 같은 진행표와 같은 준비물 목록을 체크한다. 한쪽에서 누른 체크가 다른 쪽에 안 보이면
 * 같은 일을 두 번 하거나 아무도 안 한 일이 생긴다.
 *
 * 낙관적 업데이트와 부딪히지 않게 하는 규칙이 셋 있다.
 *
 * 1) 쓰기가 진행 중이면 캐시를 건드리지 않는다.
 *    writeGuard.hasLocalWrites() 가 true 인 동안 들어온 이벤트는 '밀린 쿼리'로만 적어 두고
 *    버린다. 쓰기가 전부 끝나면 그 쿼리들만 한 번 무효화한다. 이게 없으면 내 변경의
 *    메아리가 돌아와 내 낙관적 상태를 이전 값으로 되돌린다 — 체크가 눈앞에서 풀린다.
 *
 * 2) 가능한 한 refetch 대신 캐시를 직접 고친다.
 *    replica identity full 이라 payload.new 에 행 전체가 들어 있다. 전체 refetch 는
 *    그 순간 캐시를 통째로 갈아끼우므로 부작용 범위가 넓다.
 *
 * 3) ★ 진행표만은 예외가 있다 — 캐시에 든 건 뷰 행이고 이벤트로 오는 건 테이블 행이다.
 *    day_of_events 의 payload 에는 starts_at/ends_at 이 없다. 클라이언트가 offset 으로
 *    그 값을 지어내는 건 금지돼 있다(계산은 뷰의 일이다). 그래서
 *      · 시각을 움직이지 않는 변경(status, 제목, 장소 …) → 캐시 직접 수정
 *      · 시각이 움직이는 변경(offset_min/duration_min) · INSERT · 캐시에 없는 행
 *        → 뷰를 다시 읽어야 하므로 무효화
 *    당일 현장에서 압도적으로 많이 오는 건 status 토글이고, 그건 1번 경로라 왕복이 없다.
 *
 * 언마운트 시 removeChannel 은 필수다. 안 하면 StrictMode 이중 마운트나 탭 전환마다
 * 채널이 쌓이고 같은 이벤트를 채널 수만큼 중복 처리하게 된다.
 */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { configKey, itemsKey, rolesKey, scheduleKey } from './dayofApi'
import { hasLocalWrites, onLocalWritesSettled } from './writeGuard'
import type { EventRow, Item, Role, ScheduleRow } from './types'

export type RealtimeState = 'connecting' | 'live' | 'offline'

/** 채널 이름은 마운트마다 달라야 한다. StrictMode 에서 이전 채널이 정리되기 전에 새 채널이 생긴다. */
let channelSeq = 0

/** 처리 결과. false 면 "캐시만으로는 못 맞춘다 → 서버에서 다시 받아라". */
type Handled = boolean

/**
 * day_of_events 이벤트를 진행표(뷰) 캐시에 반영한다.
 * 뷰만 아는 컬럼(starts_at/ends_at)을 지어내지 않는 것이 이 함수의 전부다.
 */
const applyEventChange = (
  qc: QueryClient,
  payload: RealtimePostgresChangesPayload<EventRow>,
): Handled => {
  const cached = qc.getQueryData<ScheduleRow[]>(scheduleKey)
  // 아직 첫 조회조차 끝나지 않았다면 캐시를 만들지 않는다.
  // 여기서 만들면 그 행 하나만 있는 목록이 완성본인 척하게 된다.
  if (!cached) return true

  if (payload.eventType === 'DELETE') {
    const removedId = (payload.old as Partial<EventRow> | null)?.id
    if (!removedId) return false
    qc.setQueryData<ScheduleRow[]>(scheduleKey, cached.filter((r) => r.id !== removedId))
    return true
  }

  const row = payload.new as EventRow | null
  if (!row?.id) return false

  const index = cached.findIndex((r) => r.id === row.id)
  // 새로 생긴 행. 실제 시각을 모르므로 뷰에서 받아야 한다.
  if (index === -1) return false

  const current = cached[index]
  // 시각이 움직였다. starts_at/ends_at 을 여기서 계산할 수 없다.
  if (row.offset_min !== current.offset_min) return false
  if ((row.duration_min ?? null) !== current.duration_min) return false

  // 담당 역할이 바뀌었으면 이름을 roles 캐시에서 조인해 채운다.
  // (단순 조인이라 클라이언트가 해도 뷰와 결과가 갈릴 여지가 없다. 시각 계산과 다르다.)
  let roleName = current.role_name
  let rolePerson = current.role_person
  const nextRoleId = row.role_id ?? null
  if (nextRoleId !== current.role_id) {
    const roles = qc.getQueryData<Role[]>(rolesKey)
    if (nextRoleId && !roles) return false
    const role = nextRoleId ? roles?.find((r) => r.id === nextRoleId) : undefined
    if (nextRoleId && !role) return false
    roleName = role?.role ?? null
    rolePerson = role?.person_name ?? null
  }

  const next = cached.slice()
  next[index] = {
    ...current,
    phase: row.phase,
    title: row.title,
    location: row.location ?? null,
    note: row.note ?? null,
    status: row.status,
    sort_order: row.sort_order,
    role_id: nextRoleId,
    role_name: roleName,
    role_person: rolePerson,
    // starts_at / ends_at 은 current 의 값을 그대로 유지한다.
    // offset/duration 이 그대로라는 걸 위에서 확인했으므로 여전히 유효하다.
  }
  qc.setQueryData<ScheduleRow[]>(scheduleKey, next)
  return true
}

/** 테이블 캐시를 그대로 갈아끼우는 일반형. roles/items 처럼 뷰가 끼지 않는 경우에 쓴다. */
const applyRowChange = <T extends { id: string }>(
  qc: QueryClient,
  key: readonly unknown[],
  payload: RealtimePostgresChangesPayload<T>,
): Handled => {
  const cached = qc.getQueryData<T[]>(key)
  if (!cached) return true

  if (payload.eventType === 'DELETE') {
    const removedId = (payload.old as Partial<T> | null)?.id
    if (!removedId) return false
    qc.setQueryData<T[]>(key, cached.filter((r) => r.id !== removedId))
    return true
  }

  const row = payload.new as T | null
  if (!row?.id) return false
  const index = cached.findIndex((r) => r.id === row.id)
  if (index === -1) {
    qc.setQueryData<T[]>(key, [...cached, row])
    return true
  }
  const next = cached.slice()
  next[index] = row
  qc.setQueryData<T[]>(key, next)
  return true
}

export const useDayOfRealtime = (): RealtimeState => {
  const qc = useQueryClient()
  const [state, setState] = useState<RealtimeState>('connecting')
  /** 쓰기 중이라 미뤄 둔 쿼리들. 키는 모듈 상수라 참조 비교가 통한다. */
  const missedRef = useRef<Set<readonly unknown[]>>(new Set())
  const subscribedOnceRef = useRef(false)

  // 쓰기가 끝나는 순간, 그동안 밀어둔 쿼리만 한 번씩 맞춘다.
  useEffect(
    () =>
      onLocalWritesSettled(() => {
        if (missedRef.current.size === 0) return
        const keys = [...missedRef.current]
        missedRef.current.clear()
        for (const key of keys) void qc.invalidateQueries({ queryKey: key })
      }),
    [qc],
  )

  useEffect(() => {
    const missed = missedRef.current

    /**
     * 이벤트 하나를 처리하는 공통 경로.
     * keys 의 첫 번째가 이 이벤트의 주 캐시, 나머지는 함께 맞춰야 하는 파생 캐시다.
     */
    const route = (keys: readonly (readonly unknown[])[], apply: () => Handled) => {
      if (hasLocalWrites()) {
        for (const key of keys) missed.add(key)
        return
      }
      const handled = apply()
      const toInvalidate = handled ? keys.slice(1) : keys
      for (const key of toInvalidate) void qc.invalidateQueries({ queryKey: key })
    }

    channelSeq += 1
    const channel = supabase
      .channel(`dayof-${channelSeq}`)
      .on<EventRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_of_events' },
        (payload) => route([scheduleKey], () => applyEventChange(qc, payload)),
      )
      .on<Role>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_of_roles' },
        (payload) =>
          // 역할 이름·담당자는 진행표 뷰에도 조인돼 나온다. 진행표도 함께 맞춘다.
          route([rolesKey, scheduleKey], () => applyRowChange<Role>(qc, rolesKey, payload)),
      )
      .on<Item>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_of_items' },
        (payload) => route([itemsKey], () => applyRowChange<Item>(qc, itemsKey, payload)),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_of_config' },
        () =>
          // 기준 시각이 바뀌면 진행표 전체가 움직인다. 캐시로 흉내 낼 수 없으니 둘 다 다시 받는다.
          //
          // 주의: 마이그레이션 8절은 events/items/roles 만 publication 에 넣었고
          // day_of_config 는 빠져 있다. 그래서 지금은 이 콜백이 호출되지 않는다.
          // 상대가 예식 시각을 바꾼 사실은 useConfigQuery 의 staleTime(10초) + 포커스
          // 복귀 refetch 로 따라잡는다. 나중에 publication 에 config 가 추가되면
          // 이 리스너가 그대로 살아나 즉시 반영된다.
          route([configKey, scheduleKey], () => false),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setState('live')
          if (subscribedOnceRef.current) {
            // 재연결 — 끊긴 동안의 변경은 이벤트로 오지 않으므로 전부 다시 맞춘다.
            const all = [configKey, scheduleKey, rolesKey, itemsKey]
            if (hasLocalWrites()) for (const key of all) missed.add(key)
            else for (const key of all) void qc.invalidateQueries({ queryKey: key })
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
