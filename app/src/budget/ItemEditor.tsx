/**
 * ItemEditor.tsx — 항목의 계약 정보를 고친다.
 *
 * 저장 버튼이 없다. 필드마다 값이 바뀐 채로 포커스가 빠지면(날짜·칩은 고르는 즉시)
 * 그 필드 하나만 patch 로 보낸다. 이유가 둘이다.
 *   - 폰에서 '수정 → 저장' 두 동작은 한 번에 하나씩 고치는 가계부 사용에 비해 번거롭다.
 *   - 필드 단위로 보내면 상대가 동시에 다른 필드를 고쳐도 서로 덮어쓰지 않는다.
 *     (행 전체를 보내면 내가 열어둔 순간의 낡은 값이 상대의 최신 값을 지운다.)
 *
 * 실제 지출은 여기서 고치지 않는다. 실지출은 payments 원장의 합계이고, 이 편집기는
 * 원장 위에 있는 <계약> 정보만 다룬다. 기존 데이터에 남아 있는 actual 값은
 * PaymentLedger 가 '원장에 옮기기'로 안내한다.
 *
 * 삭제는 여기서 확인 없이 실행하고, 목록 쪽에서 실행취소 스낵바를 띄운다.
 */
import { useEffect, useRef, useState } from 'react'
import { MoneyInput } from './MoneyInput'
import { VendorPicker } from './VendorPicker'
import { parseContact } from './contact'
import { CEREMONY_DATE, todayISO } from './dates'
import { formatWon } from './money'
import { useUpdateItem } from './useBudget'
import { CATEGORY_SUGGESTIONS, DEAL_STATUSES, FUNDINGS, OWNERS, draftOf } from './types'
import type { BudgetItemUpdate, BudgetRow, Funding, ItemDraft, Owner, Vendor } from './types'

export type ItemEditorProps = {
  item: BudgetRow
  vendors: Vendor[]
  categories: string[]
  onClose: () => void
  onDelete: (item: BudgetRow) => void
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
      category: d.category === (prev.category ?? '') ? (item.category ?? '') : d.category,
      estimate: d.estimate === prev.estimate ? item.estimate : d.estimate,
      contracted: d.contracted === prev.contracted ? item.contracted : d.contracted,
      due_on: d.due_on === prev.due_on ? item.due_on : d.due_on,
      deal_status:
        d.deal_status === (prev.deal_status ?? '') ? (item.deal_status ?? '') : d.deal_status,
      vendor_name:
        d.vendor_name === (prev.vendor_name ?? '') ? (item.vendor_name ?? '') : d.vendor_name,
      vendor_contact:
        d.vendor_contact === (prev.vendor_contact ?? '')
          ? (item.vendor_contact ?? '')
          : d.vendor_contact,
      vendor_id: d.vendor_id === prev.vendor_id ? item.vendor_id : d.vendor_id,
      owner: d.owner === prev.owner ? item.owner : d.owner,
      funding: d.funding === prev.funding ? item.funding : d.funding,
      memo: d.memo === (prev.memo ?? '') ? (item.memo ?? '') : d.memo,
    }))
  }, [item])

  /** 값이 실제로 달라졌을 때만 보낸다. 포커스만 스쳐도 매번 쓰면 Realtime 이 계속 튄다. */
  const commit = (patch: BudgetItemUpdate): void => {
    const changed = Object.entries(patch).some(
      ([key, next]) => item[key as keyof BudgetRow] !== next,
    )
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

  const setStatus = (value: string): void => {
    setDraft((d) => ({ ...d, deal_status: value }))
    commit({ deal_status: value || null })
  }

  const setDue = (value: string | null): void => {
    setDraft((d) => ({ ...d, due_on: value }))
    commit({ due_on: value })
  }

  const setFunding = (value: Funding): void => {
    setDraft((d) => ({ ...d, funding: value }))
    commit({ funding: value })
  }

  const setOwner = (value: Owner): void => {
    setDraft((d) => ({ ...d, owner: value }))
    commit({ owner: value })
  }

  const commitCategory = (value?: string): void => {
    const next = (value ?? draft.category).trim()
    commit({ category: next || null })
  }

  // 목록에 없는 상태값(엑셀에서 옮겨온 표기 등)도 지우지 않고 칩으로 같이 보여 준다.
  const statusOptions =
    draft.deal_status && !DEAL_STATUSES.includes(draft.deal_status as (typeof DEAL_STATUSES)[number])
      ? [draft.deal_status, ...DEAL_STATUSES]
      : [...DEAL_STATUSES]

  const contact = parseContact(draft.vendor_contact)

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
        <span className="bd-field__label">진행 상태</span>
        <div className="bd-chiprow bd-chiprow--tight">
          {statusOptions.map((s) => (
            <button
              key={s}
              type="button"
              className="bd-chip bd-chip--sm"
              aria-pressed={draft.deal_status === s}
              onClick={() => setStatus(draft.deal_status === s ? '' : s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bd-grid2">
        <div className="bd-field">
          <span className="bd-field__label">계약금액</span>
          <MoneyInput
            aria-label="계약금액"
            value={draft.contracted}
            onChange={(won) => setDraft((d) => ({ ...d, contracted: won }))}
            onCommit={() => commit({ contracted: draft.contracted })}
          />
        </div>
        <div className="bd-field">
          <span className="bd-field__label">예산</span>
          <MoneyInput
            aria-label="예산 금액"
            value={draft.estimate}
            onChange={(won) => setDraft((d) => ({ ...d, estimate: won }))}
            onCommit={() => commit({ estimate: draft.estimate })}
          />
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-field__label">결제 예정일</span>
        <div className="bd-daterow">
          <input
            className="bd-input bd-input--date"
            type="date"
            value={draft.due_on ?? ''}
            onChange={(e) => setDue(e.currentTarget.value || null)}
          />
          <button
            type="button"
            className="bd-btn bd-btn--ghost bd-btn--sm"
            onClick={() => setDue(todayISO())}
          >
            오늘
          </button>
          {/* 잔금은 대개 예식일에 맞춰 나간다. 2027-09-04 로 확정돼 있으니 한 번에 찍는다. */}
          <button
            type="button"
            className="bd-btn bd-btn--ghost bd-btn--sm"
            onClick={() => setDue(CEREMONY_DATE)}
          >
            예식일
          </button>
          <button
            type="button"
            className="bd-btn bd-btn--ghost bd-btn--sm"
            onClick={() => setDue(null)}
            disabled={!draft.due_on}
          >
            지우기
          </button>
        </div>
      </div>

      <div className="bd-grid2">
        <label className="bd-field">
          <span className="bd-field__label">업체명</span>
          <input
            className="bd-input"
            type="text"
            value={draft.vendor_name}
            placeholder="예: CA웨딩컨벤션"
            autoComplete="off"
            onChange={(e) => {
              const next = e.currentTarget.value
              setDraft((d) => ({ ...d, vendor_name: next }))
            }}
            onBlur={() => commit({ vendor_name: draft.vendor_name.trim() || null })}
          />
        </label>
        <label className="bd-field">
          <span className="bd-field__label">연락처</span>
          <input
            className="bd-input"
            type="text"
            inputMode="tel"
            value={draft.vendor_contact}
            placeholder="예: 010-0000-0000 담당자"
            autoComplete="off"
            onChange={(e) => {
              const next = e.currentTarget.value
              setDraft((d) => ({ ...d, vendor_contact: next }))
            }}
            onBlur={() => commit({ vendor_contact: draft.vendor_contact.trim() || null })}
          />
          {contact?.tel && (
            <a className="bd-tel" href={`tel:${contact.tel}`}>
              {contact.number} 전화 걸기
            </a>
          )}
        </label>
      </div>

      <div className="bd-grid2">
        <div className="bd-field">
          <span className="bd-field__label">자금 출처</span>
          <div className="bd-chiprow bd-chiprow--tight">
            {FUNDINGS.map((f) => (
              <button
                key={f}
                type="button"
                className="bd-chip bd-chip--sm"
                aria-pressed={draft.funding === f}
                onClick={() => setFunding(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="bd-field">
          <span className="bd-field__label">담당</span>
          <div className="bd-chiprow bd-chiprow--tight">
            {OWNERS.map((o) => (
              <button
                key={o}
                type="button"
                className="bd-chip bd-chip--sm"
                aria-pressed={draft.owner === o}
                onClick={() => setOwner(draft.owner === o ? null : o)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-field__label">카테고리</span>
        <input
          className="bd-input"
          type="text"
          list={CATEGORY_LIST_ID}
          value={draft.category}
          placeholder="미분류"
          autoComplete="off"
          onChange={(e) => {
            const next = e.currentTarget.value
            setDraft((d) => ({ ...d, category: next }))
          }}
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
                setDraft((d) => ({ ...d, category: c }))
                commitCategory(c)
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-field__label">업체 목록 연결</span>
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
          placeholder="계약 조건, 잔금 조건 같은 것"
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
