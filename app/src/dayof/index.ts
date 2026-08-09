/**
 * index.ts — 본식 당일 모듈의 공개 표면.
 *
 * 통합할 때는 이것만 알면 된다:
 *   import { DayOfApp } from './dayof'
 *   <DayOfApp />          // props 없음
 *
 * 나머지 export 는 셸이 필요할 때만 쓰는 것들이다(예: 하단 네비 뱃지에 진행률 표시).
 * 이 배럴에 없는 파일은 모듈 내부 구현이므로 직접 import 하지 않는 편이 좋다.
 */
export { DayOfApp, default } from './DayOfApp'

export type {
  Assignee,
  DayOfConfig,
  DayOfPhase,
  Item,
  Role,
  ScheduleRow,
  SectionId,
  TaskStatus,
  WeddingSide,
} from './types'

export { PHASES, SIDES, STATUS_LABEL } from './types'

export {
  useConfigQuery,
  useItemsQuery,
  useRolesQuery,
  useScheduleQuery,
} from './useDayOf'

export { useDayOfRealtime } from './useDayOfRealtime'
export type { RealtimeState } from './useDayOfRealtime'

/** 셸에서 당일 화면 캐시를 통째로 무효화해야 할 때 dayofRoot 를 쓴다. */
export { configKey, dayofRoot, itemsKey, rolesKey, scheduleKey } from './dayofApi'

export { feeTotals, groupByPhase, groupItems, progressOfItems, progressOfSchedule } from './selectors'
export type { Progress } from './selectors'

export { dateLabel, durationLabel, hhmm, offsetLabel, won } from './format'
