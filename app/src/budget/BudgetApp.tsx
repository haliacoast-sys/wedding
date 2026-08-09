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
 *   TotalsStrip  — 위에 붙는 집계 한 줄
 *   TotalsCard   — 예상 최종 · 결제 진행 · 카테고리별 비중
 *   AddComposer  — 이 자리에서 바로 추가
 *   툴바         — 카테고리 필터 · 미결제만 · 정렬
 *   목록         — 줄을 탭하면 그 자리에서 편집기가 열린다
 *   Snackbar     — 삭제 실행취소
 */
import { useCallback, useMemo, useState } from 'react'
import './budget.css'
import { AddComposer } from './AddComposer'
import { ItemEditor } from './ItemEditor'
import { ItemRow } from './ItemRow'
import { Snackbar } from './Snackbar'
import { EmptyView, ErrorView, LoadingView } from './StateViews'
import { TotalsCard, TotalsStrip } from './Summary'
import { formatWon } from './money'
import { byCategory, filterItems, sortItems, totalsOf } from './selectors'
import type { SortMode } from './selectors'
import {
  buildRestoreRow,
  useDeleteItem,
  useItemsQuery,
  useMembershipProbe,
  useRestoreItem,
  useVendorsQuery,
} from './useBudget'
import { useBudgetRealtime } from './useBudgetRealtime'
import type { BudgetItem } from './types'

export const BudgetApp = () => {
  const items = useItemsQuery()
  const vendors = useVendorsQuery()
  const live = useBudgetRealtime()
  const removeItem = useDeleteItem()
  const restoreItem = useRestoreItem()

  const [category, setCategory] = useState<string | null>(null)
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [sort, setSort] = useState<SortMode>('amount')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingUndo, setPendingUndo] = useState<BudgetItem | null>(null)

  const rows = useMemo(() => items.data ?? [], [items.data])

  // 0행인데 에러가 없을 때만 RLS 를 의심한다. 항상 물어보면 정상일 때도 rpc 가 한 번 더 나간다.
  const membership = useMembershipProbe(items.isSuccess && rows.length === 0)

  const totals = useMemo(() => totalsOf(rows), [rows])
  const categories = useMemo(() => byCategory(rows), [rows])
  const vendorNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vendors.data ?? []) map.set(v.id, v.name)
    return map
  }, [vendors.data])

  const visible = useMemo(
    () => sortItems(filterItems(rows, { category, unpaidOnly }), sort),
    [rows, category, unpaidOnly, sort],
  )
  const visibleTotal = useMemo(
    () => (category || unpaidOnly ? totalsOf(visible) : null),
    [visible, category, unpaidOnly],
  )

  const handleDelete = (item: BudgetItem): void => {
    setExpandedId(null)
    // 진짜로 지운다. 되돌리기는 같은 id 로 다시 넣는 방식이라 상대 화면에서도 복구된다.
    removeItem.mutate(item.id)
    setPendingUndo(item)
  }

  const undoDelete = (): void => {
    if (pendingUndo) restoreItem.mutate(buildRestoreRow(pendingUndo))
    setPendingUndo(null)
  }

  const dismissUndo = useCallback(() => setPendingUndo(null), [])

  const body = () => {
    if (items.isPending) return <LoadingView />
    if (items.isError) return <ErrorView error={items.error} onRetry={() => void items.refetch()} />

    return (
      <>
        {rows.length > 0 && <TotalsCard totals={totals} categories={categories} />}

        <AddComposer categories={categories.map((c) => c.category)} defaultCategory={category} />

        {rows.length === 0 ? (
          <EmptyView isMember={membership.data} />
        ) : (
          <>
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
                  미결제만
                </button>
                <button
                  type="button"
                  className="bd-chip"
                  onClick={() => setSort((s) => (s === 'amount' ? 'recent' : 'amount'))}
                >
                  {sort === 'amount' ? '금액 큰 순' : '최근 추가 순'}
                </button>
                {visibleTotal && (
                  <span className="bd-toolbar__sum">
                    {visible.length}건 · {formatWon(visibleTotal.projected)}원
                  </span>
                )}
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="bd-nores">조건에 맞는 항목이 없습니다.</p>
            ) : (
              <ul className="bd-list">
                {visible.map((item) => {
                  const expanded = expandedId === item.id
                  return (
                    <li key={item.id} className={expanded ? 'bd-li bd-li--open' : 'bd-li'}>
                      <ItemRow
                        item={item}
                        vendorName={item.vendor_id ? vendorNames.get(item.vendor_id) : undefined}
                        expanded={expanded}
                        onToggle={() => setExpandedId(expanded ? null : item.id)}
                      />
                      {expanded && (
                        <ItemEditor
                          key={item.id}
                          item={item}
                          vendors={vendors.data ?? []}
                          categories={categories.map((c) => c.category)}
                          onClose={() => setExpandedId(null)}
                          onDelete={handleDelete}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <div className="bd-app">
      <header className="bd-head">
        <h1 className="bd-head__title">예산</h1>
        <p className="bd-head__sub">
          견적을 먼저 적고, 결제하면 실제 금액과 결제일을 채웁니다. 두 사람 화면에 실시간으로
          공유됩니다.
        </p>
      </header>

      {/* 제목 다음에 둔다. 제목이 스크롤로 밀려 올라가면 이 줄이 화면 맨 위에 붙는다. */}
      {rows.length > 0 && <TotalsStrip totals={totals} live={live} />}

      {body()}

      {pendingUndo && (
        <Snackbar
          key={pendingUndo.id}
          message={`'${pendingUndo.label}' 삭제됨`}
          actionLabel="실행취소"
          onAction={undoDelete}
          onDismiss={dismissUndo}
        />
      )}
    </div>
  )
}

export default BudgetApp
