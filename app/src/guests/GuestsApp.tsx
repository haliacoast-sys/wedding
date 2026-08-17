/**
 * GuestsApp.tsx — 하객 명단 화면의 유일한 진입점.
 *
 * 통합 담당은 이렇게만 부른다:
 *   <GuestsApp />
 *
 * props 가 없다. 인증은 상위 AuthGate 가, QueryClientProvider 도 상위가 맡는다는 전제다.
 * 이 컴포넌트는 세션을 스스로 조회하지 않는다.
 *
 * ── 데이터 흐름 ─────────────────────────────────────────────
 *   조회는 여기서 두 번(하객 목록, 기준값 한 행). Realtime 구독도 여기 한 곳에서만 건다.
 *   각 조각(Summary/FilterBar/GuestRow)은 받은 배열로 자기 계산만 한다.
 *
 * ── 화면 순서 ───────────────────────────────────────────────
 *   빠른 추가 → 검색·필터 → 집계 → 명단
 *
 *   집계를 맨 위에 두지 않은 이유: 지금 이 앱에서 가장 자주 하는 일은 '명단을 채우는 것'
 *   이고, 집계는 채워진 뒤에야 의미가 생긴다. 대시보드가 첫 화면을 먹으면 정작 할 일이
 *   스크롤 아래로 밀린다. 0건일 때는 집계를 아예 그리지 않는다 — 0원 · 0명뿐인 카드 넉 장은
 *   아무것도 알려주지 않으면서 "무엇을 하면 되는지"만 가린다.
 *
 * ── 하단 여백 ───────────────────────────────────────────────
 *   앱 셸이 하단 고정 네비게이션(약 58px + safe-area)을 깐다. 이 화면은 그만큼 여백을 두고
 *   스스로는 하단 고정 요소를 만들지 않는다(쓰기 실패 토스트도 상단에 띄운다).
 */
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import './guests.css'
import { BulkAdd } from './BulkAdd'
import { FilterBar } from './Filters'
import type { QuickMode } from './Filters'
import { GuestEditor } from './GuestEditor'
import { GuestRow } from './GuestRow'
import { QuickAdd } from './QuickAdd'
import { Summary } from './Summary'
import { ErrorState, LoadingList, NoMatchState, WriteToast, ZeroRowState } from './StateViews'
import type { ProbeState } from './StateViews'
import { describeError, guestsKey } from './guestsApi'
import { applyFilters, groupByRelation, nameSet, totalsOf } from './selectors'
import { EMPTY_FILTERS, isFiltering } from './types'
import type { Filters, Guest, GuestDraft, WeddingSide } from './types'
import { won } from './format'
import {
  buildInserts,
  nextAttendance,
  nextInvitation,
  quickDraft,
  useConfigQuery,
  useCreateGuests,
  useDeleteGuest,
  useGuestsQuery,
  useMembershipProbe,
  useUpdateGuest,
} from './useGuests'
import { useGuestsRealtime } from './useGuestsRealtime'
import { LiveDot } from './ui'

export const GuestsApp = () => {
  const qc = useQueryClient()
  const guestsQuery = useGuestsQuery()
  const configQuery = useConfigQuery()
  const realtime = useGuestsRealtime()

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [quickMode, setQuickMode] = useState<QuickMode>('attending')
  const [addSide, setAddSide] = useState<WeddingSide>('신랑')
  const [addRelation, setAddRelation] = useState<string | null>(null)
  /** 편집 대상은 객체가 아니라 id 로 들고 있는다. 상대가 그 사람을 지우면 시트가 스스로 닫힌다. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const create = useCreateGuests()
  const update = useUpdateGuest()
  const remove = useDeleteGuest()

  const rows = useMemo(() => guestsQuery.data ?? [], [guestsQuery.data])
  const config = configQuery.data ?? null

  const zeroRows = guestsQuery.isSuccess && rows.length === 0
  const membership = useMembershipProbe(zeroRows)
  const probe: ProbeState = membership.isPending
    ? 'checking'
    : membership.isError
      ? 'unknown'
      : membership.data === true
        ? 'member'
        : membership.data === false
          ? 'not-member'
          : 'checking'

  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters])
  const groups = useMemo(() => groupByRelation(visible), [visible])
  const names = useMemo(() => nameSet(rows), [rows])
  const allTotals = useMemo(() => totalsOf(rows), [rows])
  const visibleTotals = useMemo(() => totalsOf(visible), [visible])

  const fail = useCallback((error: unknown) => setToast(describeError(error).message), [])

  /** 캐시에서 직접 읽는다. 엔터를 연달아 치면 rows(렌더 시점 값)는 한 박자 늦다. */
  const latest = useCallback(
    (): Guest[] => qc.getQueryData<Guest[]>(guestsKey) ?? [],
    [qc],
  )

  const addDrafts = useCallback(
    (drafts: GuestDraft[]) => {
      if (drafts.length === 0) return
      create.mutate(buildInserts(latest(), drafts), { onError: fail })
    },
    [create, fail, latest],
  )

  const onQuickAdd = useCallback(
    (name: string) => addDrafts([quickDraft(name, addSide, addRelation)]),
    [addDrafts, addSide, addRelation],
  )

  /**
   * 행 왼쪽 버튼. '빠른 전환'이 참석이면 참석 여부를, 청첩장이면 청첩장 상태를 한 칸 돌린다.
   * 낙관적 반영이라 손가락을 떼는 즉시 바뀌고, 실패하면 되돌아오면서 토스트가 뜬다.
   */
  const onCycle = useCallback(
    (guest: Guest) => {
      const patch =
        quickMode === 'attending'
          ? { attending: nextAttendance(guest.attending) }
          : { invitation: nextInvitation(guest.invitation) }
      update.mutate({ id: guest.id, patch }, { onError: fail })
    },
    [quickMode, update, fail],
  )

  const onOpen = useCallback((guest: Guest) => setEditingId(guest.id), [])

  /**
   * 상대가 편집 중인 사람을 지웠다면 여기서 null 이 되고 시트는 그려지지 않는다.
   * 렌더 중에 setState 로 닫지 않는다 — 그 편이 React 규칙에도 맞고, editingId 가
   * 남아 있어도 해가 없다(다음에 다른 행을 열면 덮어써진다).
   */
  const editing = editingId ? (rows.find((g) => g.id === editingId) ?? null) : null

  const busy = create.isPending || update.isPending || remove.isPending
  const filtering = isFiltering(filters)

  /**
   * 빈 상태 카드 안에도 같은 입력줄을 넣는다. 다만 그 카드는 '여러 명 한 번에'를
   * 이미 큰 버튼으로 갖고 있어서 안쪽 링크는 끈다(같은 문구가 두 번 나오면 안 된다).
   */
  const renderQuickAdd = (showBulkLink: boolean) => (
    <QuickAdd
      side={addSide}
      relation={addRelation}
      onSideChange={setAddSide}
      onRelationChange={setAddRelation}
      onAdd={onQuickAdd}
      onBulk={() => setBulkOpen(true)}
      busy={create.isPending}
      existingNames={names}
      showBulkLink={showBulkLink}
    />
  )

  return (
    <div className="gs-app">
      {toast && <WriteToast message={toast} onDismiss={() => setToast(null)} />}

      <header className="gs-hero">
        <div className="gs-hero__left">
          <b>하객 {rows.length}건</b>
          {rows.length > 0 && (
            <span>
              참석 {allTotals.headCount}명 · 식사 {allTotals.mealCount}명
            </span>
          )}
        </div>
        <LiveDot state={realtime} />
      </header>

      {/* 로딩 중에도 빠른 추가는 그리지 않는다. 목록을 모르면 sort_order 를 정할 수 없다. */}
      {guestsQuery.isPending && <LoadingList />}

      {guestsQuery.isError && (
        <ErrorState
          error={guestsQuery.error}
          what="하객 명단"
          onRetry={() => void guestsQuery.refetch()}
        />
      )}

      {guestsQuery.isSuccess && rows.length === 0 && (
        <ZeroRowState
          probe={probe}
          probeError={membership.error}
          onRetry={() => {
            void membership.refetch()
            void guestsQuery.refetch()
          }}
          onBulk={() => setBulkOpen(true)}
          quickAdd={probe === 'not-member' ? undefined : renderQuickAdd(false)}
        />
      )}

      {guestsQuery.isSuccess && rows.length > 0 && (
        <>
          {renderQuickAdd(true)}

          <FilterBar
            rows={rows}
            value={filters}
            onChange={setFilters}
            quickMode={quickMode}
            onQuickModeChange={setQuickMode}
          />

          <Summary
            rows={rows}
            config={config}
            onFilterUninvited={() =>
              setFilters({ ...EMPTY_FILTERS, invitation: '미전달' })
            }
            onFilterUndecided={() => setFilters({ ...EMPTY_FILTERS, attending: '미정' })}
          />

          {/* 필터가 걸렸으면 '지금 보이는 것'의 부분합을 따로 알린다.
              위의 집계 카드는 언제나 전체 기준이라 둘을 헷갈리면 안 된다. */}
          {filtering && visible.length > 0 && (
            <p className="gs-subtotal">
              지금 보이는 {visible.length}건 — 참석 {visibleTotals.headCount}명 · 식사{' '}
              {visibleTotals.mealCount}명 · 축의금 {won(visibleTotals.gift)}
            </p>
          )}

          {visible.length === 0 ? (
            <NoMatchState total={rows.length} onClear={() => setFilters(EMPTY_FILTERS)} />
          ) : (
            groups.map((group) => (
              <section className="gs-group" key={group.relation}>
                <div className="gs-grouphead">
                  <h3>{group.relation}</h3>
                  <span className="gs-grouphead__count">
                    {group.totals.count}건 · 참석 {group.totals.headCount}명
                    {group.totals.gift > 0 && ` · ${won(group.totals.gift)}`}
                  </span>
                </div>
                <ul className="gs-list">
                  {group.rows.map((guest) => (
                    <GuestRow
                      key={guest.id}
                      guest={guest}
                      quickMode={quickMode}
                      onCycle={onCycle}
                      onOpen={onOpen}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      {editing && (
        <GuestEditor
          key={editing.id}
          guest={editing}
          busy={busy}
          onClose={() => setEditingId(null)}
          onSave={(patch) =>
            update.mutate(
              { id: editing.id, patch },
              { onError: fail, onSuccess: () => setEditingId(null) },
            )
          }
          onDelete={() =>
            remove.mutate(
              { id: editing.id },
              { onError: fail, onSuccess: () => setEditingId(null) },
            )
          }
        />
      )}

      {bulkOpen && (
        <BulkAdd
          defaultSide={addSide}
          defaultRelation={addRelation}
          existingNames={names}
          busy={create.isPending}
          onClose={() => setBulkOpen(false)}
          onSubmit={(drafts) => {
            addDrafts(drafts)
            setBulkOpen(false)
          }}
        />
      )}

      <footer className="gs-footnote">
        <b>참석 인원</b>과 <b>식사 인원</b>은 다른 값입니다. 아이가 함께 오면 참석 인원에는
        세지만 식대는 안 나갈 수 있고, 식장에 통보하는 <b>보증인원</b>에 세는 건 식사 인원
        쪽입니다. 축의금은 참석 여부와 무관하게 전부 합산합니다. 명단은 두 사람의 화면에
        실시간으로 공유됩니다.
      </footer>
    </div>
  )
}

export default GuestsApp
