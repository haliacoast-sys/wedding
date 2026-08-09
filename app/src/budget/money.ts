/**
 * money.ts — 금액의 표시·입력 변환만 담당한다.
 *
 * 규칙 하나: 이 파일에는 소수 연산이 없다.
 *   금액은 전부 원 단위 정수(bigint 컬럼)다. 만원 표기가 필요할 때도
 *   `won / 10000` 처럼 나누지 않고 `(won - won % 10000) / 10000` 으로 구한다.
 *   나머지를 먼저 떼면 남는 값이 10000 의 정확한 배수라 나눗셈 결과가 정수로 딱 떨어진다.
 *   (합계 자체는 정수 덧셈뿐이라 오차가 생길 자리가 없다.)
 *
 * 커서 점프 문제:
 *   입력 중에 쉼표를 넣으면 문자열 길이가 바뀌므로, 문자 위치를 그대로 두면
 *   커서가 엉뚱한 곳으로 간다. 그래서 커서를 '문자 위치'가 아니라
 *   '앞에 있는 숫자의 개수'로 기억했다가 다시 그 숫자 뒤로 돌려놓는다.
 *   formatWithCaret 이 그 계산을 전부 한다.
 */

/** 원 단위 12자리 = 9,999억. 결혼 예산에서 이 이상은 오타다. */
export const MAX_WON_DIGITS = 12

export const onlyDigits = (text: string): string => text.replace(/\D+/g, '')

/** "17250000" → "17,250,000" */
export const groupDigits = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** 숫자 → 천단위 쉼표. null 이면 대시. 음수도 안전하다('-' 뒤는 \B 가 아니라 쉼표가 안 붙는다). */
export const formatWon = (won: number | null | undefined): string =>
  won == null ? '—' : groupDigits(String(won))

/** 부호를 붙여서 보여준다. 차액 표시용. */
export const formatSignedWon = (won: number): string =>
  won > 0 ? `+${formatWon(won)}` : formatWon(won)

/**
 * 보조 표기. 큰 금액은 자릿수를 세는 것보다 만 단위가 훨씬 빨리 읽힌다.
 *   17250000 → "1,725만원"
 *    1234567 → "123만 4,567원"
 *       8000 → "8,000원"
 */
export const formatManwon = (won: number | null | undefined): string => {
  if (won == null) return '—'
  const sign = won < 0 ? '-' : ''
  const abs = Math.abs(won)
  if (abs < 10_000) return `${sign}${groupDigits(String(abs))}원`
  const rest = abs % 10_000
  const man = (abs - rest) / 10_000 // 나머지를 뗀 뒤라 정확히 나누어떨어진다
  return rest === 0
    ? `${sign}${groupDigits(String(man))}만원`
    : `${sign}${groupDigits(String(man))}만 ${groupDigits(String(rest))}원`
}

/** 입력 문자열 → 원 단위 정수. 숫자가 하나도 없으면 null(= 미입력). */
export const parseWon = (text: string): number | null => {
  const digits = onlyDigits(text).slice(0, MAX_WON_DIGITS)
  if (!digits) return null
  return Number(digits)
}

/** 앞에서부터 숫자 n 개를 지난 직후의 문자 인덱스. */
const caretAfterDigits = (text: string, n: number): number => {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    if (c >= 48 && c <= 57) {
      seen += 1
      if (seen === n) return i + 1
    }
  }
  return text.length
}

export type FormattedInput = { text: string; caret: number }

/**
 * 사용자가 방금 만든 raw 문자열과 그때의 커서 위치를 받아
 * 쉼표가 들어간 표시 문자열과 '같은 자리'를 가리키는 커서 위치를 돌려준다.
 *
 * 커서 앞의 숫자 개수를 기준으로 삼기 때문에, 쉼표가 몇 개 늘거나 줄어도
 * 사용자가 보기에 커서는 방금 친 숫자 바로 뒤에 그대로 있다.
 */
export const formatWithCaret = (raw: string, caret: number): FormattedInput => {
  const digitsBefore = onlyDigits(raw.slice(0, Math.max(0, caret))).length
  const capped = onlyDigits(raw).slice(0, MAX_WON_DIGITS)
  // "007" 같은 앞자리 0 은 지운다. 지운 만큼 커서 기준도 앞으로 당겨야 한다.
  const trimmed = capped.replace(/^0+(?=\d)/, '')
  const dropped = capped.length - trimmed.length
  const target = Math.min(Math.max(digitsBefore - dropped, 0), trimmed.length)
  const text = groupDigits(trimmed)
  return { text, caret: caretAfterDigits(text, target) }
}

/** 빠른 입력 버튼. 만원 단위로 더한다. */
export const QUICK_ADDS = [
  { label: '+1만', won: 10_000 },
  { label: '+10만', won: 100_000 },
  { label: '+100만', won: 1_000_000 },
] as const
