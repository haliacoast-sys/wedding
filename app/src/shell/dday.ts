/**
 * dday.ts — 예식일 상수와 "며칠 남았나" 계산.
 *
 * 루트 index.html 의 D-day 스크립트를 승계하되 한 가지를 고쳤다.
 *
 *   원본:  var ms = ceremony - now;  var d = Math.ceil(ms / 86400000)
 *
 * 예식 시각이 자정이 아니라서 남은 밀리초에는 항상 하루 미만의 우수리가 섞여 있다.
 * 그래서 같은 날인데도 보는 시각에 따라 ceil 결과가 하루 어긋난다
 * (오전에 보면 392, 밤에 보면 391 이 나오는 식이다).
 *
 * 여기서는 시각을 아예 버리고 '달력일'끼리만 뺀다.
 * 로컬 연·월·일을 Date.UTC 로 옮겨 계산하므로 서머타임이 있는 지역에서도
 * 하루가 23시간/25시간이 되는 문제를 타지 않는다.
 * (2026-08-09 기준 D-391 이 하루 종일 D-391 로 유지된다.)
 */
import { useEffect, useState } from 'react'

/**
 * 예식: 2027년 9월 4일(토) 11:00 — 루트 index.html · wedding.html 과 동일.
 * 계약서 원본 시간이며 2026-08-09 에 이 시간으로 확정했다.
 */
export const CEREMONY = {
  year: 2027,
  month: 9,
  day: 4,
  hour: 11,
  minute: 0,
  place: 'CA웨딩컨벤션 2F 루체홀',
} as const

const KO_WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 로컬 달력일 → 에폭 기준 일련번호. 시·분과 시간대 오프셋이 모두 제거된다. */
const dayNumber = (year: number, month: number, day: number): number =>
  Date.UTC(year, month - 1, day) / 86_400_000

/** 'YYYY-MM-DD' (Postgres date 컬럼과 같은 형식) → 일련번호. 잘못된 값이면 null. */
const dayNumberOfIso = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  // new Date('2026-08-09') 는 UTC 자정으로 파싱되어 한국에서는 전날로 보인다.
  // 문자열을 직접 쪼개면 그 함정을 피할 수 있다.
  return dayNumber(Number(m[1]), Number(m[2]), Number(m[3]))
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 오늘의 로컬 날짜 키. tasks.due_date 와 같은 형식이라 문자열 비교가 그대로 성립한다. */
export const todayKey = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`

/** 오늘 대비 남은 날. 양수면 미래, 0이면 오늘, 음수면 지난 날짜. */
export const daysFromToday = (iso: string, today: string): number | null => {
  const target = dayNumberOfIso(iso)
  const base = dayNumberOfIso(today)
  if (target === null || base === null) return null
  return target - base
}

/** 예식일의 날짜 키. 'YYYY-MM-DD'. */
export const CEREMONY_KEY = `${CEREMONY.year}-${pad2(CEREMONY.month)}-${pad2(CEREMONY.day)}`

/** 예식까지 남은 날. 2026-08-09 기준 391. */
export const daysToCeremony = (today: string): number =>
  daysFromToday(CEREMONY_KEY, today) ?? 0

/** D-391 / D-DAY / D+3 */
export const formatDday = (days: number): string => {
  if (days === 0) return 'D-DAY'
  return days > 0 ? `D-${days.toLocaleString('ko-KR')}` : `D+${(-days).toLocaleString('ko-KR')}`
}

/** 마감 배지 문구. 오늘·내일은 숫자보다 말이 빠르게 읽힌다. */
export const formatDue = (days: number): string => {
  if (days === 0) return '오늘'
  if (days === 1) return '내일'
  return days > 0 ? `D-${days}` : `${-days}일 지남`
}

/** 2027년 9월 4일 토요일 11:00 */
export const ceremonyLabel = (): string => {
  const { year, month, day, hour, minute } = CEREMONY
  const weekday = KO_WEEKDAY[new Date(year, month - 1, day).getDay()]
  return `${year}년 ${month}월 ${day}일 ${weekday}요일 ${hour}:${pad2(minute)}`
}

/** 9월 4일(토) — 목록에서 쓰는 짧은 형식 */
export const shortDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const month = Number(m[2])
  const day = Number(m[3])
  const weekday = KO_WEEKDAY[new Date(Number(m[1]), month - 1, day).getDay()]
  return `${month}월 ${day}일(${weekday})`
}

/**
 * 오늘 날짜 키를 돌려주고, 자정이 지나면 스스로 갱신한다.
 * 앱을 켜둔 채 날이 바뀌어도 D-day 와 '지연' 판정이 하루 밀린 채로 남지 않는다.
 * 1분 폴링 대신 다음 자정에 딱 한 번 타이머를 건다(모바일 배터리).
 */
export const useTodayKey = (): string => {
  const [key, setKey] = useState<string>(() => todayKey())

  useEffect(() => {
    let timer = 0
    const schedule = () => {
      const now = new Date()
      // 자정 +2초. 정확히 00:00:00 에 깨면 반올림 오차로 아직 전날일 수 있다.
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2)
      timer = window.setTimeout(() => {
        setKey(todayKey())
        schedule()
      }, Math.max(1_000, nextMidnight.getTime() - now.getTime()))
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [])

  return key
}
