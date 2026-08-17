/**
 * BudgetApp.tsx — 예산 모듈의 유일한 진입점.
 *
 * 통합 담당은 이렇게만 부른다:
 *   <BudgetApp />
 *
 * props 가 없다. 인증 상태를 스스로 조회하지 않고(상위 AuthGate 가 이미 걸러 준다),
 * QueryClientProvider 도 상위에서 감싸는 것을 전제로 한다.
 *
 * 화면 구성(위에서 아래로)
 *   TotalsStrip  — 붙어 있는 한 줄. 앞으로 낼 돈 / 우리 돈 / 축의금 정산. 탭하면 상세.
 *   DueBanner    — 결제일이 지났거나 코앞일 때만. 탭하면 그것만 걸러 본다.
 *   툴바         — 카테고리 필터 · 잔금/임박 · 정렬 · 항목 추가
 *   목록         — 줄을 탭하면 그 자리에서 결제 원장이 열린다
 *   Snackbar     — 항목·결제 삭제 실행취소
 *
 * 요약을 접어 두는 이유는 하나다. 폰 첫 화면에 실제 항목이 보여야 가계부로 쓸 수 있다.
 * 계약 총액·실지출·카테고리 비중은 '확인하러 가는 숫자'지 '보고 있어야 하는 숫자'가 아니다.
 *
 * ── 데이터 흐름 ─────────────────────────────────────────────
 *   budget_rollup 뷰  →  useItemsQuery      (항목 + 서버가 계산한 집계)
 *   payments 테이블   →  usePaymentsQuery   (결제 원장 전체)
 *   두 개를 selectors.viewsOf 에서 합쳐 RowView 를 만든다. 실지출·잔금은 원장 쪽에서
 *   다시 세므로, 결제를 한 줄 넣으면 서버 왕복 없이 잔금 숫자가 바로 움직인다.
 */
import { useCallback, useMemo, useState } from 'react'
import './budget.css'
import { AddComposer } from './AddComposer'
import { ItemPanel } from './ItemPanel'
import { ItemRow } from './ItemRow'
import { Snackbar } from './Snackbar'
import { EmptyView, ErrorView, LoadingView } from './StateViews'
import { DueBanner, TotalsPanel, TotalsStrip } from './Summary'
import { todayISO } from './dates'
import { formatWon } from './money'
import {
  SORT_LABEL,
  byCategory,
  emptyLedger,
  filterViews,
  indexPayments,
  nextSort,
  orphanPayments,
  paymentsOf,
  sortViews,
  totalsOf,
  viewsOf,
} from './selectors'
import type { SortMode } from './selectors'
import {
  buildRestorePayment,
  buildRestoreRow,
  useDeleteItem,
  useDeletePayment,
  useItemsQuery,
  useMembershipProbe,
  usePaymentsQuery,
  useRestoreItem,
  useRestorePayment,
  useVendorsQuery,
} from './useBudget'
import { useBudgetRealtime } from './useBudgetRealtime'
import type { BudgetRow, Payment } from './types'

/** 실행취소 대상. 항목과 결제 둘 다 같은 스낵바를 쓴다. */
type Undo = { kind: 'item'; item: BudgetRow } | { kind: 'payment'; payment: Payment }

export const BudgetApp = () => {
  const items = useItemsQuery()
  const payments = usePaymentsQuery()
  const vendors = useVendorsQuery()
  const live = useBudgetRealtime()
  const removeItem = useDeleteItem()
  const restoreItem = useRestoreItem()
  const removePayment = useDeletePayment()
  const restorePayment = useRestorePayment()

  const [category, setCategory] = useState<string | null>(null)
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [dueOnly, setDueOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('unpaid')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [pendingUndo, setPendingUndo] = useState<Undo | null>(null)

  const rows = useMemo(() => items.data ?? [], [items.data])
  const ledgerRows = useMemo(() => payments.data ?? [], [payments.data])

  // 0행인데 에러가 없을 때만 RLS 를 의심한다. 항상 물어보면 정상일 때도 rpc 가 한 번 더 나간다.
  const membership = useMembershipProbe(items.isSuccess && rows.length === 0)

  // 날짜 비교의 기준. 렌더마다 새로 만들어도 문자열이라 참조가 흔들리지 않는다.
  const today = todayISO()

  const ledger = useMemo(
    () => (payments.isSuccess ? indexPayments(ledgerRows) : emptyLedger),
    [ledgerRows, payments.isSuccess],
  )

  const views = useMemo(() => viewsOf(rows, ledger, today), [rows, ledger, today])

  const totals = useMemo(() => totalsOf(views), [views])
  const categories = useMemo(() => byCategory(views), [views])
  const orphans = useMemo(() => orphanPayments(ledgerRows), [ledgerRows])
  const orphanAmount = useMemo(() => orphans.reduce((sum, p) => sum + p.amount, 0), [orphans])

  const vendorNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vendors.data ?? []) map.set(v.id, v.name)
    return map
  }, [vendors.data])

  const visible = useMemo(
    () => sortViews(filterViews(views, { category, unpaidOnly, dueOnly }), sort),
    [views, category, unpaidOnly, dueOnly, sort],
  )

  const visibleUnpaid = useMemo(
    () =>
      category || unpaidOnly || dueOnly
        ? visible.reduce((sum, v) => sum + (v.cancelled ? 0 : (v.unpaid ?? 0)), 0)
        : null,
    [visible, category, unpaidOnly, dueOnly],
  )

  const handleDeleteItem = (item: BudgetRow): void => {
    setExpandedId(null)
    // 진짜로 지운다. 되돌리기는 같은 id 로 다시 넣는 방식이라 상대 화면에서도 복구된다.
    removeItem.mutate(item.id)
    setPendingUndo({ kind: 'item', item })
  }

  const handleDeletePayment = (payment: Payment): void => {
    removePayment.mutate(payment.id)
    setPendingUndo({ kind: 'payment', payment })
  }

  const undo = (): void => {
    if (pendingUndo?.kind === 'item') restoreItem.mutate(buildRestoreRow(pendingUndo.item))
    if (pendingUndo?.kind === 'payment') {
      restorePayment.mutate(buildRestorePayment(pendingUndo.payment))
    }
    setPendingUndo(null)
  }

  const dismissUndo = useCallback(() => setPendingUndo(null), [])

  const categoryNames = categories.map((c) => c.category)

  const body = () => {
    if (items.isPending) return <LoadingView />
    if (items.isError) return <ErrorView error={items.error} onRetry={() => void items.refetch()} />

    if (rows.length === 0) {
      return (
        <>
          <AddComposer categories={[]} variant="block" />
          <EmptyView isMember={membership.data} />
        </>
      )
    }

    return (
      <>
        {summaryOpen && (
          <TotalsPanel
            totals={totals}
            categories={categories}
            orphanCount={orphans.length}
            orphanAmount={orphanAmount}
          />
        )}

        <DueBanner
          totals={totals}
          active={dueOnly}
          onToggle={() => setDueOnly((v) => !v)}
        />

        <div className="bd-toolbar">
          <div className="bd-chiprow" role="group" aria-label="카테고리 필터">
            <button
              type="button"
              className="bd-chip"
              aria-pressed={category == null}
              onClick={() => setCategory(null)}
            >
              전체 {rows.length}
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                type="button"
                className="bd-chip"
                aria-pressed={category === c.category}
                onClick={() => setCategory(category === c.category ? null : c.category)}
              >
                {c.category} {c.count}
              </button>
            ))}
          </div>

          <div className="bd-toolbar__row">
            <button
              type="button"
              className="bd-chip"
              aria-pressed={unpaidOnly}
              onClick={() => setUnpaidOnly((v) => !v)}
            >
              잔금 남음
            </button>
            <button
              type="button"
              className="bd-chip"
              onClick={() => setSort(nextSort(sort))}
              aria-label={`정렬: ${SORT_LABEL[sort]}. 눌러서 바꾸기`}
            >
              {SORT_LABEL[sort]}
            </button>
            <AddComposer categories={categoryNames} defaultCategory={category} />
            {visibleUnpaid != null && (
              <span className="bd-toolbar__sum">
                {visible.length}건 · 잔금 {formatWon(visibleUnpaid)}원
              </span>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="bd-nores">조건에 맞는 항목이 없습니다.</p>
        ) : (
          <ul className="bd-list">
            {visible.map((view) => {
              const expanded = expandedId === view.id
              return (
                <li key={view.id} className={expanded ? 'bd-li bd-li--open' : 'bd-li'}>
                  <ItemRow
                    view={view}
                    vendorName={
                      view.row.vendor_id ? vendorNames.get(view.row.vendor_id) : undefined
                    }
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : view.id)}
                  />
                  {expanded && (
                    <ItemPanel
                      key={view.id}
                      view={view}
                      payments={paymentsOf(ledgerRows, view.id)}
                      vendors={vendors.data ?? []}
                      categories={categoryNames}
                      onClose={() => setExpandedId(null)}
                      onDeleteItem={handleDeleteItem}
                      onDeletePayment={handleDeletePayment}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </>
    )
  }

  return (
    <div className="bd-app">
      {/* 제목과 설명문을 두지 않는다. 하단 네비가 이미 "가계부"라고 말하고 있고,
          사용법 설명은 처음 한 번만 필요한데 화면 상단을 영구히 차지한다.
          폰에서는 첫 화면에 실제 항목이 보이는 것이 훨씬 중요하다. */}
      {rows.length > 0 && (
        <TotalsStrip
          totals={totals}
          live={live}
          open={summaryOpen}
          onToggle={() => setSummaryOpen((v) => !v)}
        />
      )}

      {body()}

      {pendingUndo && (
        <Snackbar
          key={pendingUndo.kind === 'item' ? pendingUndo.item.id : pendingUndo.payment.id}
          message={
            pendingUndo.kind === 'item'
              ? `'${pendingUndo.item.label}' 삭제됨`
              : `결제 ${formatWon(pendingUndo.payment.amount)}원 삭제됨`
          }
          actionLabel="실행취소"
          onAction={undo}
          onDismiss={dismissUndo}
        />
      )}
    </div>
  )
}

export default BudgetApp
