/**
 * AddComposer.tsx — 목록 자리에서 바로 항목을 추가한다.
 *
 * 페이지를 옮기지 않는다. 한 번 옮겼다 돌아오면 방금 넣은 항목이 목록 어디에
 * 들어갔는지 다시 찾아야 한다.
 *
 * 여는 버튼은 두 모양이다.
 *   block — 목록이 비었을 때. 이때는 이게 화면에서 할 수 있는 유일한 일이라 크게 둔다.
 *   chip  — 목록이 있을 때. 툴바 끝에 칩 하나로 붙는다. 항목 추가는 이제 가끔 하는
 *           일이고(대부분의 항목은 이미 있다), 화면 위쪽은 실제 목록이 차지해야 한다.
 *
 * 추가 후에도 입력창을 닫지 않고 카테고리만 남긴다. 예산은 보통 같은 카테고리를
 * 연달아 적기 때문이다(스드메 3~4줄을 한 번에 적는 식).
 * 나머지(업체·예정일·상태·결제)는 줄을 탭해서 채운다.
 */
import { useRef, useState } from 'react'
import { MoneyInput } from './MoneyInput'
import { buildInsertRow, useCreateItem } from './useBudget'
import { CATEGORY_SUGGESTIONS, emptyDraft } from './types'
import type { ItemDraft } from './types'

export type AddComposerProps = {
  /** 목록에 이미 쓰이고 있는 카테고리. 기본 후보보다 앞에 보여 준다. */
  categories: string[]
  /** 필터로 카테고리를 좁혀 둔 상태라면 그 카테고리를 기본값으로 쓴다. */
  defaultCategory?: string | null
  variant?: 'chip' | 'block'
}

export const AddComposer = ({
  categories,
  defaultCategory,
  variant = 'chip',
}: AddComposerProps) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft(defaultCategory ?? ''))
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const labelRef = useRef<HTMLInputElement | null>(null)
  const create = useCreateItem()

  const chips = [...new Set([...categories, ...CATEGORY_SUGGESTIONS])].slice(0, 10)
  const canSubmit = draft.label.trim().length > 0

  const openComposer = (): void => {
    setOpen(true)
    setDraft((d) => ({ ...d, category: d.category || defaultCategory || '' }))
    requestAnimationFrame(() => labelRef.current?.focus())
  }

  const submit = (): void => {
    if (!canSubmit) return
    const row = buildInsertRow(draft)
    create.mutate(row)
    setJustAdded(row.label)
    // 카테고리는 남기고 나머지만 비운다.
    setDraft((d) => emptyDraft(d.category))
    labelRef.current?.focus()
  }

  if (!open) {
    return (
      <button
        type="button"
        className={variant === 'block' ? 'bd-addopen' : 'bd-chip bd-chip--add'}
        onClick={openComposer}
      >
        <span className="bd-addopen__plus" aria-hidden="true">
          +
        </span>
        항목 추가
      </button>
    )
  }

  return (
    <div className="bd-compose">
      <div className="bd-compose__head">
        <b>새 항목</b>
        <button
          type="button"
          className="bd-btn bd-btn--ghost bd-btn--sm"
          onClick={() => {
            setOpen(false)
            setJustAdded(null)
          }}
        >
          닫기
        </button>
      </div>

      <label className="bd-field">
        <span className="bd-field__label">항목명</span>
        <input
          ref={labelRef}
          className="bd-input"
          type="text"
          value={draft.label}
          placeholder="예: 홀 대관료"
          autoComplete="off"
          enterKeyHint="done"
          // 값을 먼저 꺼내 놓는다. setDraft 의 갱신 함수 안에서 e.currentTarget 을 읽으면
          // 그 함수가 실행되는 시점(렌더 단계)에는 React 가 이미 currentTarget 을 null 로
          // 되돌린 뒤라 트리 전체가 죽는다.
          onChange={(e) => {
            const next = e.currentTarget.value
            setDraft((d) => ({ ...d, label: next }))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </label>

      <div className="bd-grid2">
        <div className="bd-field">
          <span className="bd-field__label">예산</span>
          <MoneyInput
            aria-label="예산 금액"
            value={draft.estimate}
            onChange={(won) => setDraft((d) => ({ ...d, estimate: won }))}
          />
        </div>
        <div className="bd-field">
          <span className="bd-field__label">계약금액</span>
          <MoneyInput
            aria-label="계약금액"
            value={draft.contracted}
            onChange={(won) => setDraft((d) => ({ ...d, contracted: won }))}
          />
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-field__label">카테고리</span>
        <div className="bd-chiprow bd-chiprow--tight">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              className="bd-chip bd-chip--sm"
              aria-pressed={draft.category === c}
              onClick={() => setDraft((d) => ({ ...d, category: d.category === c ? '' : c }))}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="bd-compose__foot">
        <span className="bd-compose__hint">
          {create.isError
            ? '저장 실패 — 연결을 확인해 주세요'
            : justAdded
              ? `'${justAdded}' 추가됨 · 이어서 입력하세요`
              : '금액은 나중에 채워도 됩니다'}
        </span>
        <button
          type="button"
          className="bd-btn bd-btn--primary"
          onClick={submit}
          disabled={!canSubmit}
        >
          추가
        </button>
      </div>
    </div>
  )
}
