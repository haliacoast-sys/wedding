/**
 * PaymentComposer.tsx — 결제 한 줄을 원장에 적는다.
 *
 * 계약금·중도금·잔금이 여러 번 나뉘어 나가므로, 이 폼은 한 번 열어 두고 여러 줄을
 * 연달아 적는 상황을 전제로 만든다. 그래서 저장 후에도 닫지 않고 금액·내용만 비운다.
 * 지급일·결제수단·결제자는 남긴다 — 같은 날 같은 카드로 두세 건을 적는 일이 흔하다.
 *
 * 금액에 '잔금 전액' 버튼을 둔 이유: 마지막 결제는 거의 항상 남은 잔금 그대로다.
 * 열두 자리 숫자를 손으로 다시 치게 하면 오타가 나고, 그 오타는 합계로 조용히 퍼진다.
 */
import { useState } from 'react'
import { MoneyInput } from './MoneyInput'
import { todayISO } from './dates'
import { formatWon } from './money'
import { buildPaymentRow, useCreatePayment } from './useBudget'
import { PAYERS, PAYMENT_KINDS, PAYMENT_METHODS, emptyPaymentDraft } from './types'
import type { BudgetRow, PaymentDraft } from './types'

export type PaymentComposerProps = {
  item: BudgetRow
  /** 남은 잔금. '잔금 전액' 버튼에 쓴다. 계약금액이 없으면 null. */
  remaining: number | null
  onClose: () => void
}

type ChipsProps = {
  options: readonly string[]
  value: string
  onPick: (value: string) => void
}

/** 고른 값을 다시 누르면 해제된다. 자유 입력이 가능하므로 목록에 없는 값도 그대로 남는다. */
const Chips = ({ options, value, onPick }: ChipsProps) => (
  <div className="bd-chiprow bd-chiprow--tight">
    {options.map((o) => (
      <button
        key={o}
        type="button"
        className="bd-chip bd-chip--sm"
        aria-pressed={value === o}
        onClick={() => onPick(value === o ? '' : o)}
      >
        {o}
      </button>
    ))}
  </div>
)

export const PaymentComposer = ({ item, remaining, onClose }: PaymentComposerProps) => {
  const [draft, setDraft] = useState<PaymentDraft>(() => emptyPaymentDraft(todayISO()))
  const [added, setAdded] = useState(0)
  const create = useCreatePayment()

  const patch = (part: Partial<PaymentDraft>): void => setDraft((d) => ({ ...d, ...part }))

  const canSubmit = draft.amount != null && draft.amount > 0 && draft.paid_on.length === 10

  const submit = (): void => {
    if (!canSubmit) return
    create.mutate(buildPaymentRow(draft, item))
    setAdded((n) => n + 1)
    // 다음 줄을 위해 금액·내용·메모만 비운다.
    setDraft((d) => ({ ...d, amount: null, description: '', memo: '' }))
  }

  return (
    <div className="bd-compose bd-compose--pay">
      <div className="bd-compose__head">
        <b>결제 추가</b>
        <button type="button" className="bd-btn bd-btn--ghost bd-btn--sm" onClick={onClose}>
          닫기
        </button>
      </div>

      <div className="bd-grid2">
        <label className="bd-field">
          <span className="bd-field__label">지급일</span>
          <input
            className="bd-input bd-input--date"
            type="date"
            value={draft.paid_on}
            onChange={(e) => patch({ paid_on: e.currentTarget.value })}
          />
        </label>

        <div className="bd-field">
          <span className="bd-field__label">금액</span>
          <MoneyInput
            aria-label="결제 금액"
            value={draft.amount}
            onChange={(won) => patch({ amount: won })}
          />
          {remaining != null && remaining > 0 && (
            <button
              type="button"
              className="bd-btn bd-btn--ghost bd-btn--sm bd-fill"
              onClick={() => patch({ amount: remaining })}
            >
              잔금 전액 {formatWon(remaining)}원
            </button>
          )}
        </div>
      </div>

      <div className="bd-field">
        <span className="bd-field__label">내용</span>
        <input
          className="bd-input"
          type="text"
          value={draft.description}
          placeholder="계약금 · 중도금 · 잔금"
          autoComplete="off"
          onChange={(e) => {
            const next = e.currentTarget.value
            setDraft((d) => ({ ...d, description: next }))
          }}
        />
        <Chips
          options={PAYMENT_KINDS}
          value={draft.description}
          onPick={(v) => patch({ description: v })}
        />
      </div>

      <div className="bd-grid2">
        <div className="bd-field">
          <span className="bd-field__label">결제수단</span>
          <input
            className="bd-input"
            type="text"
            value={draft.method}
            placeholder="카드 · 계좌이체"
            autoComplete="off"
            onChange={(e) => {
              const next = e.currentTarget.value
              setDraft((d) => ({ ...d, method: next }))
            }}
          />
          <Chips
            options={PAYMENT_METHODS}
            value={draft.method}
            onPick={(v) => patch({ method: v })}
          />
        </div>

        <div className="bd-field">
          <span className="bd-field__label">결제자</span>
          <input
            className="bd-input"
            type="text"
            value={draft.payer}
            placeholder="누가 냈는지"
            autoComplete="off"
            onChange={(e) => {
              const next = e.currentTarget.value
              setDraft((d) => ({ ...d, payer: next }))
            }}
          />
          <Chips options={PAYERS} value={draft.payer} onPick={(v) => patch({ payer: v })} />
        </div>
      </div>

      <label className="bd-check">
        <input
          type="checkbox"
          checked={draft.has_receipt}
          onChange={(e) => patch({ has_receipt: e.currentTarget.checked })}
        />
        <span>영수증·증빙 있음</span>
      </label>

      <label className="bd-field">
        <span className="bd-field__label">메모</span>
        <input
          className="bd-input"
          type="text"
          value={draft.memo}
          placeholder="담당자, 계좌, 조건 같은 것"
          autoComplete="off"
          onChange={(e) => {
            const next = e.currentTarget.value
            setDraft((d) => ({ ...d, memo: next }))
          }}
        />
      </label>

      <div className="bd-compose__foot">
        <span className="bd-compose__hint">
          {create.isError
            ? '저장 실패 — 연결을 확인해 주세요'
            : added > 0
              ? `${added}건 기록됨 · 이어서 적을 수 있습니다`
              : '지급일과 금액만 있으면 됩니다'}
        </span>
        <button
          type="button"
          className="bd-btn bd-btn--primary"
          onClick={submit}
          disabled={!canSubmit}
        >
          기록
        </button>
      </div>
    </div>
  )
}
