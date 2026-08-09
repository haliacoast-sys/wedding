/**
 * ItemEditor.tsx — 줄을 탭하면 그 자리에서 열리는 편집기.
 *
 * 저장 버튼이 없다. 필드마다 값이 바뀐 채로 포커스가 빠지면(날짜·업체는 고르는 즉시)
 * 그 필드 하나만 patch 로 보낸다. 이유가 둘이다.
 *   - 폰에서 '수정 → 저장' 두 동작은 한 번에 하나씩 고치는 가계부 사용에 비해 번거롭다.
 *   - 필드 단위로 보내면 상대가 동시에 다른 필드를 고쳐도 서로 덮어쓰지 않는다.
 *     (행 전체를 보내면 내가 열어둔 순간의 낡은 값이 상대의 최신 값을 지운다.)
 *
 * 삭제는 여기서 확인 없이 실행하고, 목록 쪽에서 실행취소 스낵바를 띄운다.
 */
import { useEffect, useRef, useState } from 'react'
import { MoneyInput } from './MoneyInput'
import { VendorPicker } from './VendorPicker'
import { todayISO } from './dates'
import { formatWon } from './money'
import { useUpdateItem } from './useBudget'
import { CATEGORY_SUGGESTIONS, draftOf } from './types'
import type { BudgetItem, BudgetItemUpdate, ItemDraft, Vendor } from './types'

export type ItemEditorProps = {
  item: BudgetItem
  vendors: Vendor[]
  categories: string[]
  onClose: () => void
  onDelete: (item: BudgetItem) => void
}

const CATEGORY_LIST_ID = 'bd-category-options'

export const ItemEditor = ({ item, vendors, categories, onClose, onDelete }: ItemEditorProps) => {
  const [draft, setDraft] = useState<ItemDraft>(() => draftOf(item))
  const prevItem = useRef(item)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const update = useUpdateItem()

  // 목록 아래쪽 줄을 탭하면 편집기가 화면 밖에서 열린다. 'nearest' 라서 이미 보이는
  // 경우에는 아무 일도 하지 않는다(괜히 스크롤이 튀지 않는다).
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  /**
   * 편집 중에 상대가 같은 항목을 고치면 서버 값이 캐시로 들어온다.
   * 내가 손대지 않은 필드만 조용히 따라가게 한다. 통째로 다시 채우면
   * 내가 방금 친 글자가 사라진다.
   */
  useEffect(() => {
    const prev = prevItem.current
    if (prev === item) return
    prevItem.current = item
    setDraft((d) => ({
      label: d.label === prev.label ? item.label : d.label,
      category: d.category === (prev.category ?? '') ? item.category ?? '' : d.category,
      estimate: d.estimate === prev.estimate ? item.estimate : d.estimate,
      actual: d.actual === prev.actual ? item.actual : d.actual,
      paid_at: d.paid_at === prev.paid_at ? item.paid_at : d.paid_at,
      vendor_id: d.vendor_id === prev.vendor_id ? item.vendor_id : d.vendor_id,
      memo: d.memo === (prev.memo ?? '') ? item.memo ?? '' : d.memo,
    }))
  }, [item])

  /** 값이 실제로 달라졌을 때만 보낸다. 포커스만 스쳐도 매번 쓰면 Realtime 이 계속 튄다. */
  const commit = (patch: BudgetItemUpdate): void => {
    const changed = Object.entries(patch).some(([key, next]) => item[key as keyof BudgetItem] !== next)
    if (!changed) return
    update.mutate({ id: item.id, patch })
  }

  const commitLabel = (): void => {
    const trimmed = draft.label.trim()
    if (!trimmed) {
      // 이름 없는 항목은 만들 수 없다. 빈 칸으로 두면 원래 이름으로 되돌린다.
      setDraft((d) => ({ ...d, label: item.label }))
      return
    }
    commit({ label: trimmed })
  }

  const setCategory = (value: string): void => {
    setDraft((d) => ({ ...d, category: value }))
  }

  const commitCategory = (value?: string): void => {
    const next = (value ?? draft.category).trim()
    commit({ category: next || null })
  }

  const setPaidAt = (value: string | null): void => {
    setDraft((d) => ({ ...d, paid_at: value }))
    commit({ paid_at: value })
  }

  return (
    <div className="bd-editor" ref={rootRef}>
      <datalist id={CATEGORY_LIST_ID}>
        {[...new Set([...categories, ...CATEGORY_SUGGESTIONS])].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <label className="bd-field">
        <span className="bd-field__label">항목명</span>
        <input
          className="bd-input"
          type="text"
          value={draft.label}
          autoComplete="off"
          // 값을 먼저 꺼낸다. 갱신 함수 안에서 e.currentTarget 을 읽으면 그 함수가 실행되는
          // 시점(렌더 단계)에는 React 가 이미 currentTarget 을 null 로 되돌린 뒤다.
          onChange={(e) => {
            const next = e.currentTarget.value
            setDraft((d) => ({ ...d, label: next }))
          }}
          onBlur={commitLabel}
        />
      </label>

      <div className="bd-field">
        <span className="bd-field__label">카테고리</span>
        <input
          className="bd-input"
          type="text"
          list={CATEGORY_LIST_ID}
          value={draft.category}
          placeholder="미분류"
          autoComplete="off"
          onChange={(e) => setCategory(e.currentTarget.value)}
          onBlur={() => commitCategory()}
        />
        <div className="bd-chiprow bd-chiprow--tight">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className="bd-chip bd-chip--sm"
              aria-pressed={draft.category.trim() === c}
              onClick={() => {
                setCategory(c)
                commitCategory(c)
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="bd-grid2">
        <div className="bd-field">
          <span className="bd-field__label">견적</span>
          <MoneyInput
            aria-label="견적 금액"
            value={draft.estimate}
            onChange={(won) => setDraft((d) => ({ ...d, estimate: won }))}
            onCommit={() => commit({ estimate: draft.estimate })}
          />
        </div>
        <div className="bd-field">
          <span className="bd-field__label">실제 지출</span>
          <MoneyInput
            aria-label="실제 지출 금액"
            value={draft.actual}
            onChange={(won) => setDraft((d) => ({ ...d, actual: won }))}
            onCommit={() => commit({ actual: draft.actual })}
          />
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-field__label">결제일</span>
        <div className="bd-daterow">
          <input
            className="bd-input bd-input--date"
            type="date"
            value={draft.paid_at ?? ''}
            onChange={(e) => setPaidAt(e.currentTarget.value || null)}
          />
          <button
            type="button"
            className="bd-btn bd-btn--ghost bd-btn--sm"
            onClick={() => setPaidAt(todayISO())}
          >
            오늘
          </button>
          <button
            type="button"
            className="bd-btn bd-btn--ghost bd-btn--sm"
            onClick={() => setPaidAt(null)}
            disabled={!draft.paid_at}
          >
            결제 취소
          </button>
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-field__label">업체</span>
        <VendorPicker
          vendors={vendors}
          value={draft.vendor_id}
          categoryHint={draft.category}
          onChange={(vendorId) => {
            setDraft((d) => ({ ...d, vendor_id: vendorId }))
            commit({ vendor_id: vendorId })
          }}
        />
      </div>

      <label className="bd-field">
        <span className="bd-field__label">메모</span>
        <textarea
          className="bd-input bd-textarea"
          rows={2}
          value={draft.memo}
          placeholder="계약 조건, 잔금일 같은 것"
          onChange={(e) => {
            const next = e.currentTarget.value
            setDraft((d) => ({ ...d, memo: next }))
          }}
          onBlur={() => commit({ memo: draft.memo.trim() || null })}
        />
      </label>

      {/* 시세 근거는 사용자가 입력한 값이 아니라 외부 조사 결과다.
          편집 대상이 아니므로 읽기 전용으로 두고, 길어서 기본은 접어 둔다.
          숫자만 보고 협상하다 낭패를 보지 않도록 출처·조사 시점·지역 기준을 그대로 보여준다. */}
      {item.market_note && (
        <details className="bd-market">
          <summary className="bd-market__summary">
            시세 근거
            {item.market_avg != null && <b> · {formatWon(item.market_avg)}</b>}
          </summary>
          <p className="bd-market__body">{item.market_note}</p>
        </details>
      )}

      <div className="bd-editor__foot">
        <button type="button" className="bd-btn bd-btn--danger" onClick={() => onDelete(item)}>
          삭제
        </button>
        <span className="bd-editor__hint">
          {update.isError ? '저장 실패 — 연결을 확인해 주세요' : '입력하면 바로 저장됩니다'}
        </span>
        <button type="button" className="bd-btn bd-btn--primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
