/**
 * contact.ts — vendor_contact 문자열에서 전화번호를 뽑아낸다.
 *
 * 이 칸은 엑셀에서 그대로 옮겨 온 자유 문자열이다. 실제로 이런 값이 들어온다.
 *   "010-9019-9920 이도경이사"
 *   "1588-1234 고객센터 / 강남구 …"
 *   "이도경 이사"                 ← 번호가 없을 수도 있다
 *
 * 번호가 있으면 tel: 링크를 만들어 폰에서 바로 걸 수 있게 하고, 없으면 그냥 글자로 둔다.
 * 전화 앱은 하이픈이 있어도 받지만 tel: 뒤에는 숫자만 넣는다 — 자유 입력 문자열이
 * href 로 들어가는 자리라, 통과시키는 문자를 숫자로 못 박아 두는 편이 안전하다.
 */

/** 휴대폰·지역번호(0으로 시작) → 010-1234-5678 / 02-123-4567 */
const LOCAL = /(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})/
/** 대표번호 → 1588-1234 */
const TOLL = /\b(1[5-9]\d{2})[-.\s]?(\d{4})\b/

export type Contact = {
  /** tel: 뒤에 붙일 숫자열. 번호를 못 찾으면 null. */
  tel: string | null
  /** 사람이 읽는 번호. '010-9019-9920' */
  number: string | null
  /** 번호를 뺀 나머지(담당자 이름·주소 등). 없으면 빈 문자열. */
  rest: string
}

/** 찾아낸 번호를 원문에서 들어내고 남은 부스러기(구분기호·공백)를 정리한다. */
const strip = (text: string, matched: string): string =>
  text.replace(matched, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s/,·|-]+|[\s/,·|-]+$/g, '').trim()

export const parseContact = (raw: string | null | undefined): Contact | null => {
  const text = raw?.trim()
  if (!text) return null

  const local = LOCAL.exec(text)
  if (local) {
    const number = `${local[1]}-${local[2]}-${local[3]}`
    return {
      tel: `${local[1]}${local[2]}${local[3]}`,
      number,
      rest: strip(text, local[0]),
    }
  }

  const toll = TOLL.exec(text)
  if (toll) {
    return {
      tel: `${toll[1]}${toll[2]}`,
      number: `${toll[1]}-${toll[2]}`,
      rest: strip(text, toll[0]),
    }
  }

  return { tel: null, number: null, rest: text }
}

/** 목록 한 줄에 들어갈 짧은 이름. 번호 뒤에 붙은 담당자 이름이 있으면 그쪽을 쓴다. */
export const contactLabel = (contact: Contact): string => contact.rest || contact.number || ''
