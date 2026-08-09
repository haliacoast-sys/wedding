/**
 * ChecklistScreen.tsx — 체크리스트 탭의 본문.
 *
 * 데이터는 한 번만 받아 오고(쿼리 키 하나) 필터·정렬·그룹핑은 전부 여기서 계산한다.
 * 필터를 쿼리 키에 넣지 않는 이유는 selectors.ts 위쪽 주석에 적어 두었다.
 */
import { useState } from 'react'
import { todayIso } from './dates'
import {
  allCategories,
  groupByCategory,
  overdueCount,
  progressOf,
  scopeTasks,
  visibleTasks,
} from './selectors'
import { describeError } from './tasksApi'
import { TaskEditor } from './TaskEditor'
import type { EditorTarget } from './TaskEditor'
import { TaskRow } from './TaskRow'
import {
  ErrorState,
  FilteredEmptyState,
  LoadingList,
  ZeroRowState,
} from './StateViews'
import type { ProbeState } from './StateViews'
import { ASSIGNEES, DEFAULT_FILTERS, resolveAssignee } from './types'
import type { AssigneeFilter, Filters, Task, TaskDraft, TaskUpdate } from './types'
import {
  buildTaskInsert,
  useCreateTask,
  useDeleteTask,
  useMembershipProbe,
  useTasksQuery,
  useToggleStatus,
  useUpdateTask,
} from './useTasks'
import { useTasksRealtime } from './useTasksRealtime'
import { Chip, Meter } from './ui'

const ASSIGNEE_FILTERS: { value: AssigneeFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...ASSIGNEES.map((a) => ({ value: a as AssigneeFilter, label: a })),
  { value: 'none', label: '미지정' },
]

const REALTIME_LABEL = {
  connecting: '연결 중',
  live: '실시간',
  offline: '연결 끊김',
} as const

export const ChecklistScreen = ({ displayName }: { displayName: string }) => {
  const today = todayIso()
  const myAssignee = resolveAssignee(displayName)

  const tasksQuery = useTasksQuery()
  const realtime = useTasksRealtime()

  const toggle = useToggleStatus()
  const create = useCreateTask()
  const update = useUpdateTask()
  const remove = useDeleteTask()

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [editor, setEditor] = useState<EditorTarget | null>(null)

  const tasks = tasksQuery.data ?? []

  // 0행이면서 에러가 없을 때만 권한을 캐묻는다.
  const zeroRows = tasksQuery.isSuccess && tasks.length === 0
  const membership = useMembershipProbe(zeroRows)

  const categories = allCategories(tasks)
  const scoped = scopeTasks(tasks, filters)
  const overall = progressOf(scoped)
  const overdue = overdueCount(scoped, today)
  const groups = groupByCategory(scoped, filters, today)
  const shownCount = visibleTasks(scoped, filters).length

  const writeError = toggle.error ?? create.error ?? update.error ?? remove.error
  const dismissWriteError = () => {
    toggle.reset()
    create.reset()
    update.reset()
    remove.reset()
  }

  const busy = create.isPending || update.isPending || remove.isPending

  const handleToggle = (task: Task) =>
    toggle.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' })

  const handleCreate = (draft: TaskDraft) => {
    create.mutate(buildTaskInsert(tasks, draft))
    setEditor(null)
  }

  const handleSave = (id: string, patch: TaskUpdate) => {
    if (Object.keys(patch).length > 0) update.mutate({ id, patch })
    setEditor(null)
  }

  const handleDelete = (id: string) => {
    remove.mutate({ id })
    setEditor(null)
  }

  const openCreate = () =>
    setEditor({
      mode: 'create',
      presetCategory: filters.category === 'all' ? null : filters.category,
    })

  const probeState: ProbeState = membership.isPending
    ? 'checking'
    : membership.isError
      ? 'unknown'
      : membership.data === true
        ? 'member'
        : membership.data === false
          ? 'not-member'
          : 'checking'

  return (
    <>
      {/* 카테고리 줄만 고정한다. 스크롤 중에도 지금 무엇을 보고 있는지 잃지 않게. */}
      <div className="ck-sticky">
        <div className="ck-chiprow" role="group" aria-label="카테고리 필터">
          <Chip
            active={filters.category === 'all'}
            onClick={() => setFilters((f) => ({ ...f, category: 'all' }))}
            count={tasks.length}
          >
            전체
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c}
              active={filters.category === c}
              onClick={() =>
                setFilters((f) => ({ ...f, category: f.category === c ? 'all' : c }))
              }
              count={tasks.reduce((n, t) => (t.category === c ? n + 1 : n), 0)}
            >
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <section className="ck-card" aria-label="진행률">
        <div className="ck-card__head">
          <span className="ck-card__title">
            {filters.category === 'all' ? '전체 진행률' : `${filters.category} 진행률`}
            {filters.assignee !== 'all' && (
              <span className="ck-card__sub">
                {' '}
                ·{' '}
                {filters.assignee === 'none' ? '담당자 미지정' : filters.assignee}
              </span>
            )}
          </span>
          <span className="ck-live" data-state={realtime} title="Supabase Realtime 구독 상태">
            <span className="ck-live__dot" />
            {REALTIME_LABEL[realtime]}
          </span>
        </div>

        <Meter progress={overall} label="완료" />

        {overdue > 0 && (
          <div className="ck-callout ck-callout--crit">
            마감이 지났는데 아직 안 끝난 항목이 <b>{overdue}건</b> 있습니다. 목록에서 붉은
            띠로 표시했습니다.
          </div>
        )}
      </section>

      <div className="ck-controls">
        <div className="ck-chiprow" role="group" aria-label="담당자 필터">
          {ASSIGNEE_FILTERS.map((f) => (
            <Chip
              key={f.value}
              active={filters.assignee === f.value}
              onClick={() => setFilters((prev) => ({ ...prev, assignee: f.value }))}
            >
              {f.label}
              {myAssignee !== null && f.value === myAssignee ? ' (나)' : ''}
            </Chip>
          ))}
          <Chip
            active={filters.hideDone}
            onClick={() => setFilters((prev) => ({ ...prev, hideDone: !prev.hideDone }))}
          >
            완료 숨기기
          </Chip>
        </div>
      </div>

      <div className="ck-controls">
        <span className="ck-card__sub">
          {shownCount}개 표시
          {filters.hideDone && overall.done > 0 ? ` · 완료 ${overall.done}개 숨김` : ''}
        </span>
        <span className="ck-controls__spacer" />
        <button type="button" className="ck-addbtn" onClick={openCreate} disabled={busy}>
          + 항목 추가
        </button>
      </div>

      {tasksQuery.isPending && <LoadingList />}

      {tasksQuery.isError && (
        <ErrorState error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} />
      )}

      {zeroRows && (
        <ZeroRowState
          probe={probeState}
          probeError={membership.error}
          onRetry={() => {
            void membership.refetch()
            void tasksQuery.refetch()
          }}
          onAdd={openCreate}
        />
      )}

      {tasksQuery.isSuccess && tasks.length > 0 && shownCount === 0 && (
        <FilteredEmptyState onReset={() => setFilters(DEFAULT_FILTERS)} />
      )}

      {groups.map((group) =>
        group.tasks.length === 0 ? null : (
          <section key={group.category} style={{ marginBottom: 18 }}>
            <div className="ck-grouphead">
              <h3>
                {group.category}
                {group.overdue > 0 && (
                  <span className="ck-badge" data-tone="overdue">
                    지연 {group.overdue}
                  </span>
                )}
              </h3>
              <span className="ck-grouphead__count">
                {group.progress.done}/{group.progress.total}
              </span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Meter progress={group.progress} mini />
            </div>
            <ul className="ck-list">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  onToggle={handleToggle}
                  onOpen={(t) => setEditor({ mode: 'edit', task: t })}
                />
              ))}
            </ul>
          </section>
        ),
      )}

      {editor && (
        <TaskEditor
          key={editor.mode === 'edit' ? editor.task.id : 'new'}
          target={editor}
          categories={categories}
          defaultAssignee={myAssignee}
          busy={busy}
          onClose={() => setEditor(null)}
          onCreate={handleCreate}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {writeError && (
        <div className="ck-toast" role="alert">
          <span>저장하지 못했습니다 — {describeError(writeError).message}</span>
          <button type="button" onClick={dismissWriteError}>
            닫기
          </button>
        </div>
      )}
    </>
  )
}
