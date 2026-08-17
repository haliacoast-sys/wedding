/**
 * bulk.ts — 붙여넣은 텍스트를 하객 행으로 바꾸는 순수 함수.
 *
 * 폰에서 200명을 한 명씩 폼으로 넣는 건 현실적으로 불가능하다. 그런데 원본은
 * 이미 엑셀·카톡·메모장에 이름 목록으로 존재한다. 그걸 그대로 붙여넣게 하는 것이
 * 이 화면에서 가장 큰 시간 절약이다.
 *
 * ★ 추측하지 않는다.
 *   "홍길동, 친구" 가 두 사람인지 한 사람+관계인지는 텍스트만 봐서 알 수 없다.
 *   그래서 모드를 사용자가 고르게 하고, 고른 모드 안에서는 규칙을 단순하게 유지한다.
 *   그리고 만든 결과를 저장 전에 그대로 미리 보여 준다 — 규칙을 설명하는 것보다
 *   결과를 보여 주는 편이 언제나 빠르다.
 *
 *   'line'  : 한 줄에 한 명. 줄 안의 쉼표/탭은 추가 정보(관계·연락처·인원).
 *   'comma' : 쉼표·줄바꿈으로 나눈 토큰이 전부 이름. 이름만 죽 나열한 목록용.
 */
import { MAX_PEOPLE_PER_ROW } from './types'
import { onlyDigits } from './format'

export type BulkMode = 'line' | 'comma'

export type ParsedGuest = {
  name: string
  relation: string | null
  contact: string | null
  /** 한 줄에 여러 명이 딸린 경우(가족 4명). head 와 meal 의 초기값이 된다. */
  headCount: number
  /** 원본 몇 번째 줄에서 왔는지. 미리보기에서 문제를 짚어 주려고 남긴다. */
  line: number
}

export type BulkParse = {
  rows: ParsedGuest[]
  /** 이름을 못 찾아 버린 줄 수(빈 줄 포함). */
  skipped: number
}

/** 전화번호로 볼 수 있는가. 숫자 7자리 이상이고 숫자·기호로만 이뤄져 있어야 한다. */
const looksLikePhone = (token: string): boolean => {
  if (!/^[\d+\-.()\s]+$/.test(token)) return false
  return onlyDigits(token).length >= 7
}

/** 인원수로 볼 수 있는가. 1~99 의 순수 숫자만. */
const asPeople = (token: string): number | null => {
  if (!/^\d{1,2}$/.test(token)) return null
  const n = Number(token)
  return n >= 1 && n <= MAX_PEOPLE_PER_ROW ? n : null
}

const splitCells = (line: string): string[] =>
  line
    .split(/[,\t;]/)
    .map((s) => s.trim())
    .filter((s) => s !== '')

/**
 * 한 줄을 한 명으로 읽는다.
 *   "홍길동"                        → 이름만
 *   "홍길동, 친구"                  → 이름 + 관계
 *   "홍길동, 친구, 010-1234-5678"   → 이름 + 관계 + 연락처
 *   "홍길동, 4"                     → 이름 + 4명(가족 단위)
 * 두 번째 칸부터는 순서를 따지지 않는다. 생김새로 판별하므로
 * "홍길동, 010-..., 친구" 도 같은 결과가 된다.
 */
const parseLine = (line: string, lineNo: number): ParsedGuest | null => {
  const cells = splitCells(line)
  const name = cells[0]
  if (!name) return null

  let relation: string | null = null
  let contact: string | null = null
  let headCount = 1

  for (const cell of cells.slice(1)) {
    const n = asPeople(cell)
    if (n !== null) {
      headCount = n
      continue
    }
    if (contact === null && looksLikePhone(cell)) {
      contact = cell
      continue
    }
    if (relation === null) relation = cell
  }

  return { name, relation, contact, headCount, line: lineNo }
}

export const parseBulk = (text: string, mode: BulkMode): BulkParse => {
  const lines = text.split(/\r?\n/)
  const rows: ParsedGuest[] = []
  let skipped = 0

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (line === '') {
      // 빈 줄은 사고가 아니라 문단 구분이다. skipped 로 세지 않는다.
      return
    }
    if (mode === 'comma') {
      const cells = splitCells(line)
      if (cells.length === 0) {
        skipped += 1
        return
      }
      for (const name of cells) {
        rows.push({ name, relation: null, contact: null, headCount: 1, line: i + 1 })
      }
      return
    }
    const parsed = parseLine(line, i + 1)
    if (parsed) rows.push(parsed)
    else skipped += 1
  })

  return { rows, skipped }
}

/** 같은 배치 안에서 이름이 겹치는 경우. 엑셀을 두 번 붙여넣은 사고를 잡는다. */
export const duplicatesWithin = (rows: ParsedGuest[]): string[] => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const r of rows) {
    const key = r.name.replace(/\s+/g, '')
    if (seen.has(key)) dupes.add(r.name)
    else seen.add(key)
  }
  return [...dupes]
}

/** 이미 명단에 있는 이름. 동명이인일 수 있으므로 막지 않고 알리기만 한다. */
export const duplicatesAgainst = (rows: ParsedGuest[], existing: Set<string>): string[] => {
  const hits = new Set<string>()
  for (const r of rows) {
    if (existing.has(r.name.replace(/\s+/g, ''))) hits.add(r.name)
  }
  return [...hits]
}
