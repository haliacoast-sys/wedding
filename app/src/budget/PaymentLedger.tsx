/**
 * PaymentLedger.tsx — 항목 하나의 결제 이력.
 *
 * 줄을 탭하면 제일 먼저 보이는 것이 이 원장이다. 예산 항목을 만드는 일은 한 번이지만
 * 결제는 계약금·중도금·잔금으로 계속 쌓이기 때문이다.
 *
 * 결제 줄은 고치지 않고 지웠다 다시 넣는다. 원장은 '사실의 기록'이라 값을 슬쩍 고치는
 * 것보다 잘못 적은 줄을 지우고 새로 적는 편이 나중에 봐도 말이 된다. 지우기는 목록 쪽
 * 실행취소 스낵바로 되돌릴 수 있다(삭제 → 같은 id 로 재삽입).
 */
import { dotDate, longDate, todayISO } from './dates'
import { formatWon } from './money'
import { buildPaymentRow, useCreatePayment } from './useBudget'
import { emptyPaymentDraft } from './types'
import type { BudgetRow, Payment } from './types'
import type { RowView } from './selectors'

export type PaymentLedgerProps = {
  item: BudgetRow
  view: RowView
  /** 이 항목에 달린 결제. 지급일 내림차순으로 이미 정렬돼 있다. */
  payments: Payment[]
  /** 입력 폼이 이미 열려 있으면 '결제 추가' 버튼을 숨긴다(같은 일을 하는 버튼이 둘이 되지 않게). */
  adding: boolean
  onAdd: () => void
  onDelete: (payment: Payment) => void
}

const metaOf = (p: Payment): string =>
  [p.method, p.payer].filter((s) => s && s.trim()).join(' · ')

export const PaymentLedger = ({
  item,
  view,
  payments,
  adding,
  onAdd,
  onDelete,
}: PaymentLedgerProps) => {
  const create = useCreatePayment()

  // 결제 원장이 생기기 전에 budget_items.actual 로 적어 둔 값이 남아 있을 수 있다.
  // 그 값은 어떤 합계에도 들어가지 않으므로(실지출은 원장 합계다) 그냥 두면 조용히 사라진다.
  // 지우지 말고 한 번의 탭으로 원장에 옮길 수 있게 한다.
  const strayActual = view.paymentCount === 0 && item.actual != null && item.actual > 0

  const carryOver = (): void => {
    if (item.actual == null) return
    create.mutate(
      buildPaymentRow(
        {
          ...emptyPaymentDraft(item.paid_at ?? todayISO()),
          amount: item.actual,
          description: '기존 실지출 이관',
        },
        item,
      ),
    )
  }

  return (
    <div className="bd-ledger">
      <div className="bd-ledger__head">
        <span className="bd-k">결제 이력</span>
        <span className="bd-ledger__sum">
          실지출 <b>{formatWon(view.paid)}</b>원 · {view.paymentCount}건
        </span>
      </div>

      {view.unpaid != null && (
        <div className={view.unpaid > 0 ? 'bd-remain' : 'bd-remain bd-remain--done'}>
          <span>{view.unpaid > 0 ? '남은 잔금' : '완납'}</span>
          <b>{formatWon(view.unpaid)}원</b>
          <i>계약 {formatWon(view.contracted)}원</i>
        </div>
      )}
      {view.contracted == null && (
        <p className="bd-ledger__note">
          계약금액이 아직 없어 잔금을 계산할 수 없습니다. 아래 <b>항목 정보 수정</b> 에서
          계약금액을 넣어 주세요.
        </p>
      )}
      {view.overpaid > 0 && (
        <p className="bd-ledger__note bd-ledger__note--warn">
          계약금액보다 {formatWon(view.overpaid)}원 더 냈습니다.
        </p>
      )}

      {payments.length === 0 ? (
        <p className="bd-ledger__empty">아직 나간 돈이 없습니다.</p>
      ) : (
        <ul className="bd-paylist">
          {payments.map((p) => (
            <li key={p.id} className="bd-pay">
              <span className="bd-pay__date">{dotDate(p.paid_on)}</span>
              <span className="bd-pay__body">
                <b className="bd-pay__desc">{p.description?.trim() || '결제'}</b>
                {metaOf(p) && <span className="bd-pay__meta">{metaOf(p)}</span>}
                {p.has_receipt && <span className="bd-pay__rcpt">영수증</span>}
                {p.memo?.trim() && <span className="bd-pay__memo">{p.memo.trim()}</span>}
              </span>
              <span className="bd-pay__amt">{formatWon(p.amount)}</span>
              <button
                type="button"
                className="bd-pay__del"
                onClick={() => onDelete(p)}
                aria-label={`${longDate(p.paid_on)} ${formatWon(p.amount)}원 결제 삭제`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {strayActual && (
        <div className="bd-carry">
          <p>
            원장 없이 적어 둔 실지출 <b>{formatWon(item.actual)}원</b>
            {item.paid_at && ` (${longDate(item.paid_at)})`} 이 있습니다. 지금 합계에는 들어가지
            않습니다.
          </p>
          <button
            type="button"
            className="bd-btn bd-btn--ghost bd-btn--sm"
            onClick={carryOver}
            disabled={create.isPending}
          >
            원장에 옮기기
          </button>
        </div>
      )}

      {!adding && (
        <button type="button" className="bd-addpay" onClick={onAdd}>
          <span className="bd-addpay__plus" aria-hidden="true">
            +
          </span>
          결제 추가
        </button>
      )}
    </div>
  )
}
