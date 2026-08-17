/**
 * dates.ts — date 컬럼(paid_on · due_on · paid_at) 다루기.
 *
 * date 컬럼은 시간대가 없는 'YYYY-MM-DD' 다.
 * toISOString() 을 쓰면 UTC 로 바뀌면서 한국 시간 오전 9시 이전에는 하루 전 날짜가 나온다.
 * 그래서 로컬 연·월·일을 직접 조립하고, 날짜 사이의 간격도 Date.UTC 로 계산한다
 * (로컬 Date 로 빼면 서머타임이 있는 지역에서 하루가 23시간이 되어 어긋난다).
 */

/** 예식일. 2027-09-04(토) 11:00 확정. 잔금 납부일 입력을 돕는 데 쓴다. */
export const CEREMONY_DATE = '2027-09-04'

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 오늘 날짜를 date 컬럼 형식으로. `<input type="date">` 의 value 로 바로 쓴다. */
export const todayISO = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** 'YYYY-MM-DD' → UTC 자정의 밀리초. 형식이 아니면 null. */
const toUTC = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const value = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(value) ? null : value
}

const DAY_MS = 86_400_000

/** from 에서 to 까지 남은 일수. 오늘이 to 면 0, 이미 지났으면 음수. */
export const daysBetween = (from: string, to: string): number | null => {
  const a = toUTC(from)
  const b = toUTC(to)
  if (a == null || b == null) return null
  return Math.round((b - a) / DAY_MS)
}

/** 남은 일수 → 'D-18' · 'D-DAY' · 'D+3'(지남). */
export const ddayLabel = (days: number): string =>
  days === 0 ? 'D-DAY' : days > 0 ? `D-${days}` : `D+${-days}`

/** '2026-08-09' → '8/9'. 목록에서 자리를 아끼려고 짧게 쓴다. */
export const shortDate = (iso: string | null): string => {
  if (!iso) return ''
  const [, month, day] = iso.split('-')
  if (!month || !day) return iso
  return `${Number(month)}/${Number(day)}`
}

/** '2026-08-09' → '2026. 8. 9.' 읽어 주는 자리(안내문·aria-label)에서 쓴다. */
export const longDate = (iso: string | null): string => {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${year}. ${Number(month)}. ${Number(day)}.`
}

/**
 * '2026-08-09' → '2026.8.9'
 * 결제 원장은 연도가 섞이므로 연도를 버릴 수 없는데, 폰에서 날짜 칸에 줄 수 있는 폭은
 * 80px 안팎이다. 공백을 뺀 이 표기가 그 안에 들어가는 유일한 형태다.
 */
export const dotDate = (iso: string | null): string => {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${year}.${Number(month)}.${Number(day)}`
}
