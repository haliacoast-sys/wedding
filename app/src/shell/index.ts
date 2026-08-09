/* ============================================================
   shell/index.ts — 셸 모듈의 공개 표면

   바깥(App.tsx)에서는 이 파일만 import 하세요.

     import { AppShell, HomeScreen } from './shell'
     import type { TabKey } from './shell'

   이 모듈은 checklist / budget / dayof 폴더를 알지 못합니다.
   어떤 탭에 무엇을 그릴지는 App.tsx 가 정하고 AppShell 의 children 으로 넘깁니다.
   ============================================================ */

export { AppShell } from './AppShell'
export type { TabKey } from './AppShell'

export { HomeScreen } from './HomeScreen'

/* 다른 화면에서도 쓸 만한 것만 골라 함께 내보냅니다.
   (D-day 계산과 금액 표기는 홈 밖에서도 같은 규칙이어야 합니다.) */
export {
  CEREMONY,
  CEREMONY_KEY,
  ceremonyLabel,
  daysFromToday,
  daysToCeremony,
  formatDday,
  formatDue,
  shortDate,
  todayKey,
  useTodayKey,
} from './dday'
export { formatWon, formatWonSigned, percent } from './format'
