/**
 * MoneyInput.tsx — 금액 입력창.
 *
 * 이 화면에서 제일 많이 만지는 부품이라 세 가지를 특별히 신경 썼다.
 *
 * 1) 커서가 튀지 않는다.
 *    입력할 때마다 쉼표를 다시 찍으므로 문자열 길이가 계속 변한다. 커서를 문자
 *    인덱스로 기억하면 "1,234" 의 중간을 고칠 때 커서가 끝으로 날아간다.
 *    그래서 money.formatWithCaret 이 '커서 앞의 숫자 개수'를 기준으로 위치를 다시 계산한다.
 *    계산한 위치는 onChange 안에서 DOM 에 즉시 적용하고(리렌더가 생략되는 경우 대비),
 *    useLayoutEffect 에서 한 번 더 확정한다(리렌더가 일어난 경우 대비). 화면이 그려지기
 *    전에 끝나므로 커서가 깜빡이며 움직이는 게 보이지 않는다.
 *
 * 2) 쉼표에서 백스페이스를 누르면 쉼표가 아니라 앞의 숫자가 지워진다.
 *    브라우저 기본 동작대로 쉼표만 지우면 다시 포맷하면서 쉼표가 되살아나
 *    "아무리 눌러도 안 지워지는" 입력창이 된다.
 *
 * 3) 모바일에서 숫자 키패드가 뜨고(inputMode="numeric"), 글자 크기가 16px 이상이라
 *    iOS Safari 가 포커스 때 화면을 확대하지 않는다(크기는 budget.css 에서).
 *    type="number" 를 쓰지 않는 이유는 쉼표를 넣을 수 없기 때문이다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { MAX_WON_DIGITS, QUICK_ADDS, formatManwon, formatWithCaret, groupDigits, parseWon } from './money'

const MAX_WON = Number('9'.repeat(MAX_WON_DIGITS))

export type MoneyInputProps = {
  id?: string
  value: number | null
  onChange: (won: number | null) => void
  /** 포커스가 빠질 때(= 입력이 끝났다고 볼 만할 때) 호출된다. 서버 반영은 보통 여기서 한다. */
  onCommit?: () => void
  placeholder?: string
  'aria-label'?: string
  /** 빠른 입력 버튼 줄. 좁은 자리에서는 끌 수 있다. */
  quick?: boolean
}

export const MoneyInput = ({
  id,
  value,
  onChange,
  onCommit,
  placeholder = '0',
  quick = true,
  ...rest
}: MoneyInputProps) => {
  const ref = useRef<HTMLInputElement | null>(null)
  /** 마지막으로 부모에게 알린 값. 밖에서 온 변경과 내가 만든 변경을 구분한다. */
  const emitted = useRef<number | null>(value)
  const pendingCaret = useRef<number | null>(null)
  const [text, setText] = useState(() => (value == null ? '' : groupDigits(String(value))))

  // 밖에서 값이 바뀐 경우(빠른 입력 버튼, 상대방의 수정, 편집 취소)만 표시 문자열을 다시 만든다.
  // 내가 방금 친 값까지 여기서 다시 만들면 입력 중에 커서가 초기화된다.
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    pendingCaret.current = null
    setText(value == null ? '' : groupDigits(String(value)))
  }, [value])

  // 리렌더 후 커서 확정. 브라우저가 화면을 그리기 전에 실행된다.
  useLayoutEffect(() => {
    const el = ref.current
    const caret = pendingCaret.current
    if (!el || caret == null) return
    pendingCaret.current = null
    if (document.activeElement !== el) return
    el.setSelectionRange(caret, caret)
  })

  const apply = (el: HTMLInputElement, raw: string, caret: number): void => {
    const next = formatWithCaret(raw, caret)
    // DOM 을 먼저 맞춘다. 포맷 결과가 직전과 같으면 React 가 리렌더를 생략하는데,
    // 그때 입력창에는 사용자가 친 원본(쉼표 낀 값)이 남아 화면과 상태가 어긋난다.
    el.value = next.text
    el.setSelectionRange(next.caret, next.caret)
    pendingCaret.current = next.caret
    setText(next.text)

    const won = parseWon(next.text)
    if (won !== emitted.current) {
      emitted.current = won
      onChange(won)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const el = e.currentTarget
    apply(el, el.value, el.selectionStart ?? el.value.length)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    const el = e.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start == null || end == null || start !== end) return // 범위 선택은 기본 동작으로 충분하다

    if (e.key === 'Backspace' && start >= 2 && el.value[start - 1] === ',') {
      // 쉼표 바로 뒤에서 지우기 — 쉼표와 그 앞 숫자를 함께 지운다.
      e.preventDefault()
      apply(el, el.value.slice(0, start - 2) + el.value.slice(start), start - 2)
      return
    }
    if (e.key === 'Delete' && el.value[start] === ',') {
      // 쉼표 바로 앞에서 지우기 — 쉼표와 그 뒤 숫자를 함께 지운다.
      e.preventDefault()
      apply(el, el.value.slice(0, start) + el.value.slice(start + 2), start)
    }
  }

  const bump = (won: number): void => {
    const next = Math.min((value ?? 0) + won, MAX_WON)
    onChange(next) // emitted 를 건드리지 않는다 → 위 useEffect 가 표시 문자열을 다시 만든다
  }

  const clear = (): void => {
    onChange(null)
  }

  return (
    <div className="bd-money">
      <div className="bd-money__box">
        <input
          {...rest}
          ref={ref}
          id={id}
          className="bd-input bd-input--money"
          type="text"
          inputMode="numeric"
          pattern="[0-9,]*"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onCommit}
        />
        <span className="bd-money__unit" aria-hidden="true">
          원
        </span>
      </div>

      {quick && (
        <div className="bd-money__quick">
          {QUICK_ADDS.map((q) => (
            <button key={q.label} type="button" className="bd-quickbtn" onClick={() => bump(q.won)}>
              {q.label}
            </button>
          ))}
          <button
            type="button"
            className="bd-quickbtn bd-quickbtn--clear"
            onClick={clear}
            disabled={value == null}
          >
            지우기
          </button>
        </div>
      )}

      {value != null && value >= 10_000 && (
        <div className="bd-money__hint">{formatManwon(value)}</div>
      )}
    </div>
  )
}
