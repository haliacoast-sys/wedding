/**
 * dates.ts — 날짜 계산.
 *
 * tasks.due_date 는 postgres `date` 라 항상 'YYYY-MM-DD' 문자열로 온다.
 * new Date('2027-09-04') 는 이 형태를 UTC 자정으로 파싱하므로 KST(+9)에서
 * 하루가 밀린다. 그래서 문자열을 직접 쪼개 '일 번호'(1970-01-01 = 0)로 바꿔
 * 정수 뺄셈만으로 D-day 를 구한다. 시간대·서머타임·윤년이 개입할 여지가 없다.
 */

/** 예식일. 이 값 하나만 바꾸면 화면 전체의 D-day 가 따라간다. */
export const WEDDING_DATE = '2027-09-04'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' → 1970-01-01 로부터의 일수. 잘못된 값이면 NaN. */
export const toDayNumber = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return Number.NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000
}

/** 사용자의 로컬 기준 오늘. 'YYYY-MM-DD'. */
export const todayIso = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** from 기준으로 iso 까지 남은 일수. 음수면 이미 지났다. */
export const daysBetween = (from: string, to: string): number =>
  toDayNumber(to) - toDayNumber(from)

/** 'YYYY-MM-DD' 의 요일 한 글자. 1970-01-01 이 목요일이라 +4 보정. */
export const weekdayOf = (iso: string): string => {
  const d = toDayNumber(iso)
  if (Number.isNaN(d)) return ''
  return WEEKDAYS[(((d + 4) % 7) + 7) % 7]
}

/** D-391 / D-DAY / D+3 */
export const ddayLabel = (target: string, from: string = todayIso()): string => {
  const diff = daysBetween(from, target)
  if (Number.isNaN(diff)) return ''
  if (diff === 0) return 'D-DAY'
  return diff > 0 ? `D-${diff}` : `D+${-diff}`
}

/** 2027년 9월 4일 (토) */
export const longDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일 (${weekdayOf(iso)})`
}

/** 27.09.04 (토) — 목록 안에서 쓰는 짧은 형태. */
export const shortDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[1].slice(2)}.${m[2]}.${m[3]} (${weekdayOf(iso)})`
}

/**
 * 마감 상태. 화면의 색·강조는 전부 이 값 하나로 결정된다.
 * 'done'   완료된 항목 — 마감을 따지지 않는다
 * 'overdue' 마감이 지났는데 아직 안 끝남 (가장 눈에 띄어야 함)
 * 'today'  오늘 마감
 * 'soon'   7일 이내
 * 'near'   30일 이내
 * 'later'  그 이후
 * 'none'   마감일 없음
 */
export type DueTone = 'done' | 'overdue' | 'today' | 'soon' | 'near' | 'later' | 'none'

export const dueToneOf = (
  dueDate: string | null,
  isDone: boolean,
  today: string = todayIso(),
): DueTone => {
  if (isDone) return 'done'
  if (!dueDate) return 'none'
  const diff = daysBetween(today, dueDate)
  if (Number.isNaN(diff)) return 'none'
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'soon'
  if (diff <= 30) return 'near'
  return 'later'
}

/** 목록에 붙는 마감 뱃지 문구. */
export const dueBadgeLabel = (
  dueDate: string | null,
  tone: DueTone,
  today: string = todayIso(),
): string => {
  if (!dueDate) return '마감일 없음'
  const diff = daysBetween(today, dueDate)
  switch (tone) {
    case 'overdue':
      return `${-diff}일 지남 · ${shortDate(dueDate)}`
    case 'today':
      return `오늘 마감`
    case 'soon':
      return `D-${diff} · ${shortDate(dueDate)}`
    default:
      return shortDate(dueDate)
  }
}
