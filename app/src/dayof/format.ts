/**
 * format.ts — 표시용 포맷터.
 *
 * ★ 여기에 "offset → 실제 시각" 환산은 없다. 그건 day_of_schedule 뷰의 일이다.
 *   이 파일은 뷰가 준 ISO 문자열을 사람이 읽는 모양으로 바꾸기만 한다.
 *   환산을 클라이언트에도 두면 계산이 두 곳에 생기고, 기준 시각이 바뀌었을 때
 *   한쪽만 고쳐져 조용히 어긋난다.
 *
 * 반대로 offsetLabel/offsetClock 은 '상대 분'을 상대 표현으로만 옮긴다.
 * (-240 → "4시간 전"). 절대 시각을 만들지 않으므로 뷰와 충돌하지 않는다.
 */

/**
 * 예식은 충남 아산에서 열린다. 보는 기기의 시간대가 무엇이든 현지(KST) 시각으로 고정한다.
 * 신혼여행지에서 폰을 열어도 진행표가 엉뚱한 시각으로 보이면 안 된다.
 */
export const WEDDING_TZ = 'Asia/Seoul'

/** KST 는 서머타임이 없는 고정 +09:00 이다. 그래서 오프셋 문자열을 붙이는 변환이 안전하다. */
const KST_SUFFIX = '+09:00'

const partValue = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string =>
  parts.find((p) => p.type === type)?.value ?? ''

const parse = (iso: string | null | undefined): Date | null => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 진행표에서 시계처럼 읽는 값. "13:40" */
export const hhmm = (iso: string | null | undefined): string | null => {
  const d = parse(iso)
  if (!d) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WEDDING_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  return `${partValue(parts, 'hour')}:${partValue(parts, 'minute')}`
}

/** "2027년 9월 4일 (토)" */
export const dateLabel = (iso: string | null | undefined): string | null => {
  const d = parse(iso)
  if (!d) return null
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: WEDDING_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(d)
  const y = partValue(parts, 'year')
  const m = partValue(parts, 'month')
  const day = partValue(parts, 'day')
  const w = partValue(parts, 'weekday')
  return `${y}년 ${m} ${day}일 (${w})`
}

/**
 * timestamptz → <input type="datetime-local"> 값.
 * 브라우저의 datetime-local 은 기기 시간대로 해석되므로, KST 로 직접 조립한다.
 */
export const toLocalInput = (iso: string | null | undefined): string => {
  const d = parse(iso)
  if (!d) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WEDDING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const date = `${partValue(parts, 'year')}-${partValue(parts, 'month')}-${partValue(parts, 'day')}`
  return `${date}T${partValue(parts, 'hour')}:${partValue(parts, 'minute')}`
}

/**
 * <input type="datetime-local"> 값 → timestamptz 로 보낼 ISO 문자열.
 * 입력값은 항상 예식장 현지 시각이라고 본다. 그래서 +09:00 을 붙인다.
 * (기기 시간대로 해석하면 해외에서 접속했을 때 예식 시각이 통째로 밀린다.)
 */
export const fromLocalInput = (local: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const iso = `${local}:00${KST_SUFFIX}`
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

// ── 상대 분(offset) 표현 ─────────────────────────────────────

/** -240 → "예식 4시간 전", 0 → "예식 시작", 70 → "예식 1시간 10분 후" */
export const offsetLabel = (min: number): string => {
  if (min === 0) return '예식 시작'
  const suffix = min < 0 ? '전' : '후'
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `예식 ${m}분 ${suffix}`
  if (m === 0) return `예식 ${h}시간 ${suffix}`
  return `예식 ${h}시간 ${m}분 ${suffix}`
}

/** 진행표 뱃지용 짧은 표기. -240 → "−4:00", 0 → "0:00", 70 → "+1:10" */
export const offsetClock = (min: number): string => {
  const sign = min < 0 ? '−' : min > 0 ? '+' : ''
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

/** 50 → "50분", 70 → "1시간 10분" */
export const durationLabel = (min: number | null | undefined): string | null => {
  if (min === null || min === undefined || min <= 0) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

// ── 돈 ───────────────────────────────────────────────────────

/** 천단위 쉼표. 당일 봉투에 넣을 현금이라 자릿수를 잘못 읽으면 큰일 난다. */
export const won = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

export const wonPlain = (value: number): string => Math.round(value).toLocaleString('ko-KR')
