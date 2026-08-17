/**
 * ItemPanel.tsx — 줄을 탭했을 때 그 자리에서 열리는 영역.
 *
 * 순서가 곧 우선순위다.
 *   ① 결제 이력 — 이 항목에 지금까지 얼마가 나갔나. 앞으로 제일 자주 하는 일이
 *      "오늘 얼마 냈다"를 적는 것이라 원장을 맨 위에 둔다.
 *   ② 결제 추가 — ①에서 바로 열린다.
 *   ③ 항목 정보 수정 — 계약금액·업체·예정일. 한 번 정하면 잘 안 바꾸므로 접어 둔다.
 *      단, 계약금액이 아직 없으면 잔금 계산 자체가 안 되므로 그때는 펴 둔 채로 연다.
 */
import { useState } from 'react'
import { ItemEditor } from './ItemEditor'
import { PaymentComposer } from './PaymentComposer'
import { PaymentLedger } from './PaymentLedger'
import type { BudgetRow, Payment, Vendor } from './types'
import type { RowView } from './selectors'

export type ItemPanelProps = {
  view: RowView
  /** 이 항목에 달린 결제. 지급일 내림차순. */
  payments: Payment[]
  vendors: Vendor[]
  categories: string[]
  onClose: () => void
  onDeleteItem: (item: BudgetRow) => void
  onDeletePayment: (payment: Payment) => void
}

export const ItemPanel = ({
  view,
  payments,
  vendors,
  categories,
  onClose,
  onDeleteItem,
  onDeletePayment,
}: ItemPanelProps) => {
  const [adding, setAdding] = useState(false)
  // 계약금액이 없으면 잔금을 셀 수 없다. 그 항목은 열자마자 고칠 수 있게 펴 둔다.
  const [editing, setEditing] = useState(() => view.contracted == null)

  return (
    <div className="bd-panel">
      <PaymentLedger
        item={view.row}
        view={view}
        payments={payments}
        adding={adding}
        onAdd={() => setAdding(true)}
        onDelete={onDeletePayment}
      />

      {adding && (
        <PaymentComposer
          item={view.row}
          remaining={view.unpaid}
          onClose={() => setAdding(false)}
        />
      )}

      {editing ? (
        <ItemEditor
          item={view.row}
          vendors={vendors}
          categories={categories}
          onClose={onClose}
          onDelete={onDeleteItem}
        />
      ) : (
        <div className="bd-panel__foot">
          <button
            type="button"
            className="bd-btn bd-btn--ghost"
            onClick={() => setEditing(true)}
            aria-expanded={false}
          >
            항목 정보 수정
          </button>
          <button type="button" className="bd-btn bd-btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      )}
    </div>
  )
}
