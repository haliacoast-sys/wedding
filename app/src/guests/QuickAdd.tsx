/**
 * QuickAdd.tsx — 이름 한 칸으로 한 명을 만드는 줄.
 *
 * 이 화면에서 제일 중요한 입력기다. 하객을 넣을 때 실제로 아는 건 이름뿐인 경우가
 * 대부분이고, 측·관계·연락처·축의금은 나중에 알게 된다. 그래서
 *   · 필수는 이름 하나
 *   · 측·관계는 한 번 고르면 그대로 남는다 (친구 30명을 연달아 넣을 때 매번 안 고른다)
 *   · Enter 로 추가되고 입력칸은 비워지되 포커스와 키보드는 그대로 남는다
 * 폰에서 "이름 → 엔터 → 이름 → 엔터" 리듬이 끊기지 않는 게 전부다.
 *
 * 방금 넣은 이름을 한 줄로 되짚어 주는 이유: 키보드가 목록을 가려서 방금 추가한 행이
 * 화면 밖에 있다. 되짚어 주지 않으면 들어갔는지 몰라 같은 사람을 두 번 넣는다.
 */
import { useRef, useState } from 'react'
import { RELATIONS, SIDES } from './types'
import type { WeddingSide } from './types'
import { Chip } from './ui'

export const QuickAdd = ({
  side,
  relation,
  onSideChange,
  onRelationChange,
  onAdd,
  onBulk,
  busy,
  /** 이미 명단에 있는 이름(공백 제거). 같은 이름을 또 넣으려 하면 알려 준다. */
  existingNames,
  /** 빈 상태 카드 안에서는 끈다 — 그 카드가 이미 같은 버튼을 크게 갖고 있다. */
  showBulkLink = true,
}: {
  side: WeddingSide
  relation: string | null
  onSideChange: (next: WeddingSide) => void
  onRelationChange: (next: string | null) => void
  onAdd: (name: string) => void
  onBulk: () => void
  busy: boolean
  existingNames: Set<string>
  showBulkLink?: boolean
}) => {
  const [name, setName] = useState('')
  const [added, setAdded] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const trimmed = name.trim()
  const isDuplicate = trimmed !== '' && existingNames.has(trimmed.replace(/\s+/g, ''))

  const submit = () => {
    if (trimmed === '') return
    onAdd(trimmed)
    // 최근 3명만 남긴다. 더 쌓이면 이 줄이 목록을 밀어낸다.
    setAdded((prev) => [trimmed, ...prev].slice(0, 3))
    setName('')
    // 포커스를 유지해 모바일 키보드가 내려가지 않게 한다.
    inputRef.current?.focus()
  }

  return (
    <div className="gs-quickadd">
      <form
        className="gs-quickadd__row"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          ref={inputRef}
          className="gs-input gs-quickadd__input"
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="이름을 적고 엔터"
          aria-label="추가할 하객 이름"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" className="gs-addbtn" disabled={trimmed === '' || busy}>
          추가
        </button>
      </form>

      {isDuplicate && (
        <p className="gs-quickadd__dup">
          <b>{trimmed}</b> 은(는) 이미 명단에 있습니다. 동명이인이면 그대로 추가해도 됩니다.
        </p>
      )}

      <div className="gs-quickadd__opts">
        <div className="gs-chiprow" role="group" aria-label="새로 추가할 하객의 측">
          {SIDES.map((s: WeddingSide) => (
            <Chip key={s} active={side === s} onClick={() => onSideChange(s)}>
              {s}
            </Chip>
          ))}
          <span className="gs-chiprow__sep" aria-hidden="true" />
          {RELATIONS.map((r) => (
            <Chip
              key={r}
              active={relation === r}
              onClick={() => onRelationChange(relation === r ? null : r)}
            >
              {r}
            </Chip>
          ))}
        </div>
      </div>

      {(showBulkLink || added.length > 0) && (
        <div className="gs-quickadd__foot">
          {showBulkLink ? (
            <button type="button" className="gs-linkbtn" onClick={onBulk}>
              여러 명 한 번에 추가
            </button>
          ) : (
            <span />
          )}
          {added.length > 0 && (
            <span className="gs-quickadd__added">추가됨 · {added.join(', ')}</span>
          )}
        </div>
      )}
    </div>
  )
}
