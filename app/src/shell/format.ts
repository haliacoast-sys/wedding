/**
 * format.ts — 숫자 표기. 금액은 반드시 천단위 쉼표를 넣는다.
 *
 * Intl.NumberFormat 인스턴스는 만들 때마다 로케일 데이터를 물어보므로
 * 모듈 최상단에서 한 번만 만들고 재사용한다(목록에서 수십 번 호출된다).
 */

const WON = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 12345678 → "12,345,678원" */
export const formatWon = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${WON.format(Math.round(value))}원`
}

/** 부호를 살린 금액. 예산 차액처럼 방향이 의미를 갖는 곳에서 쓴다. */
export const formatWonSigned = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value)
  if (rounded === 0) return '0원'
  return `${rounded > 0 ? '+' : '−'}${WON.format(Math.abs(rounded))}원`
}

/** 0으로 나누기를 방지한 백분율(정수). */
export const percent = (done: number, total: number): number =>
  total > 0 ? Math.round((done / total) * 100) : 0
