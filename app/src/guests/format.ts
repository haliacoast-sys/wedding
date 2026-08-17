/**
 * format.ts — 표시용 포맷터. 계산은 selectors.ts 가 한다.
 *
 * 금액은 전부 원 단위 정수(bigint 컬럼)다. 이 파일에 소수 연산은 없다.
 * 만원 표기도 `won / 10000` 이 아니라 나머지를 먼저 뗀 뒤 나눈다 —
 * 그래야 나눗셈이 정수로 딱 떨어진다.
 */

export const onlyDigits = (text: string): string => text.replace(/\D+/g, '')

/** "17250000" → "17,250,000" */
export const groupDigits = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** 천단위 쉼표 + '원'. null 이면 대시. */
export const won = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  const n = Math.round(value)
  const sign = n < 0 ? '−' : ''
  return `${sign}${groupDigits(String(Math.abs(n)))}원`
}

/** 단위 없이 숫자만. 표 안에서 '원'을 반복하면 폭만 먹는다. */
export const wonPlain = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  const n = Math.round(value)
  const sign = n < 0 ? '−' : ''
  return `${sign}${groupDigits(String(Math.abs(n)))}`
}

/**
 * 큰 금액은 자릿수를 세는 것보다 만 단위가 훨씬 빨리 읽힌다.
 *   17250000 → "1,725만원"
 *    1234567 → "123만 4,567원"
 *       8000 → "8,000원"
 */
export const manwon = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  const n = Math.round(value)
  const sign = n < 0 ? '−' : ''
  const abs = Math.abs(n)
  if (abs < 10_000) return `${sign}${groupDigits(String(abs))}원`
  const rest = abs % 10_000
  const man = (abs - rest) / 10_000 // 나머지를 뗀 뒤라 정확히 나누어떨어진다
  return rest === 0
    ? `${sign}${groupDigits(String(man))}만원`
    : `${sign}${groupDigits(String(man))}만 ${groupDigits(String(rest))}원`
}

/** 부호를 명시한다. 수지(축의금 − 식대)처럼 음수가 의미를 갖는 값에 쓴다. */
export const signedWon = (value: number): string =>
  value > 0 ? `+${won(value)}` : won(value)

/** 입력 문자열 → 원 단위 정수. 숫자가 하나도 없으면 null(= 미입력). */
export const parseWon = (text: string): number | null => {
  const digits = onlyDigits(text).slice(0, 12) // 12자리 = 9,999억. 축의금에서 그 이상은 오타다.
  if (!digits) return null
  return Number(digits)
}

export const people = (n: number): string => `${groupDigits(String(Math.round(n)))}명`

/**
 * 연락처를 tel: 링크로 만든다. 하이픈·공백·괄호는 다이얼러가 싫어한다.
 * 숫자가 3자리도 안 되면 전화번호로 보지 않는다(메모를 연락처 칸에 적은 경우).
 */
export const telHref = (contact: string | null | undefined): string | null => {
  if (!contact) return null
  const cleaned = contact.replace(/[^\d+]/g, '')
  return cleaned.length >= 3 ? `tel:${cleaned}` : null
}

/** "010-1234-5678" 처럼 보기 좋게. 형식이 안 맞으면 원문 그대로 둔다. */
export const prettyPhone = (contact: string | null | undefined): string => {
  if (!contact) return ''
  const d = onlyDigits(contact)
  if (d.length === 11 && d.startsWith('01')) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10 && d.startsWith('01')) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return contact
}

// ── 날짜 ─────────────────────────────────────────────────────

/** 예식은 충남 아산. 보는 기기의 시간대와 무관하게 현지(KST) 날짜로 고정한다. */
export const WEDDING_TZ = 'Asia/Seoul'

const partValue = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string =>
  parts.find((p) => p.type === type)?.value ?? ''

const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "2027년 7월 24일" */
export const dateLabel = (iso: string | null | undefined): string | null => {
  const d = parse(iso)
  if (!d) return null
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: WEDDING_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).formatToParts(d)
  return `${partValue(parts, 'year')}년 ${partValue(parts, 'month')} ${partValue(parts, 'day')}일`
}

/**
 * 오늘부터 대상 시각까지 남은 '날짜 수'. 시각이 아니라 KST 날짜 경계로 센다.
 * (예식 6주 전이 오늘인지 내일인지는 시:분이 아니라 날짜로 판단해야 한다.)
 */
export const daysUntil = (iso: string | null | undefined, from: Date = new Date()): number | null => {
  const target = parse(iso)
  if (!target) return null
  const ymd = (d: Date): number => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: WEDDING_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    return Date.UTC(
      Number(partValue(parts, 'year')),
      Number(partValue(parts, 'month')) - 1,
      Number(partValue(parts, 'day')),
    )
  }
  return Math.round((ymd(target) - ymd(from)) / 86_400_000)
}

/** ISO 시각에서 n일 전의 ISO 시각. 청첩장 발송 권장일(예식 6주 전) 계산에 쓴다. */
export const shiftDays = (iso: string | null | undefined, days: number): string | null => {
  const d = parse(iso)
  if (!d) return null
  return new Date(d.getTime() + days * 86_400_000).toISOString()
}
