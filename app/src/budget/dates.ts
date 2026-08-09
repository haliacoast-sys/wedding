/**
 * dates.ts — paid_at(date 컬럼) 다루기.
 *
 * date 컬럼은 시간대가 없는 'YYYY-MM-DD' 다.
 * toISOString() 을 쓰면 UTC 로 바뀌면서 한국 시간 오전 9시 이전에는 하루 전 날짜가 나온다.
 * 그래서 로컬 연·월·일을 직접 조립한다.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** 오늘 날짜를 date 컬럼 형식으로. `<input type="date">` 의 value 로 바로 쓴다. */
export const todayISO = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** '2026-08-09' → '8/9'. 목록에서 자리를 아끼려고 짧게 쓴다. */
export const shortDate = (iso: string | null): string => {
  if (!iso) return ''
  const [, month, day] = iso.split('-')
  if (!month || !day) return iso
  return `${Number(month)}/${Number(day)}`
}
