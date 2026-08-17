/**
 * index.ts — 하객 모듈의 공개 표면.
 *
 * 통합할 때는 이것만 알면 된다:
 *   import { GuestsApp } from './guests'
 *   <GuestsApp />          // props 없음
 *
 * 나머지 export 는 셸이 필요할 때만 쓰는 것들이다.
 * 예) 하단 네비 '하객' 탭에 미전달 건수를 뱃지로 달거나,
 *     홈 화면에 축의금 − 식대 한 줄을 얹는 경우.
 *
 * 이 배럴에 없는 파일은 모듈 내부 구현이므로 직접 import 하지 않는 편이 좋다.
 */
export { GuestsApp, default } from './GuestsApp'

export type {
  Attendance,
  DayOfConfig,
  Filters,
  Guest,
  GuestDraft,
  InviteState,
  WeddingSide,
} from './types'

export {
  ATTENDANCES,
  FALLBACK_GUARANTEE,
  FALLBACK_MEAL_UNIT_PRICE,
  INVITE_STATES,
  RELATIONS,
  SIDES,
} from './types'

/** 셸에서 요약 한 줄을 만들 때 쓰는 조회 훅. 캐시는 GuestsApp 과 공유된다. */
export { useConfigQuery, useGuestsQuery } from './useGuests'
export { useGuestsRealtime } from './useGuestsRealtime'
export type { RealtimeState } from './useGuestsRealtime'

/** 셸에서 하객 캐시를 통째로 무효화해야 할 때 guestsRoot 를 쓴다. */
export { configKey, guestsKey, guestsRoot } from './guestsApi'

export {
  INVITE_LEAD_DAYS,
  inviteCounts,
  mealMath,
  totalsBySide,
  totalsOf,
} from './selectors'
export type { InviteCounts, MealMath, SideBreakdown, Totals } from './selectors'

export { manwon, people, won } from './format'
