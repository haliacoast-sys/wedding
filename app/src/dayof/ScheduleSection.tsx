/**
 * ScheduleSection.tsx — 진행표.
 *
 * 화면의 주인공은 왼쪽에 큰 글씨로 붙는 실제 시각이다. 당일에는 이 화면을 시계처럼 본다.
 * 그 값은 전부 day_of_schedule 뷰가 계산해 준 starts_at 이고, 여기서는 포맷만 한다.
 *
 * 쓰기(상태 토글·추가·수정·삭제)는 day_of_events 테이블로 나간다.
 * 뷰는 읽기 전용이라 그럴 수밖에 없고, 그래서 훅 이름도 Event* 로 갈라 놓았다.
 */
import { Fragment, useState } from 'react'
import { CeremonyTimeCard } from './CeremonyTimeCard'
import { describeError } from './dayofApi'
import { EventEditor } from './EventEditor'
import type { EventEditorTarget } from './EventEditor'
import { durationLabel, hhmm, offsetClock, offsetLabel } from './format'
import { baselineRowId, groupByPhase, progressOfSchedule } from './selectors'
import { ErrorState, LoadingList, WriteToast, ZeroRowState } from './StateViews'
import type { ProbeState } from './StateViews'
import { STATUS_LABEL } from './types'
import type {
  DayOfConfig,
  DayOfConfigUpdate,
  EventDraft,
  EventUpdate,
  Role,
  ScheduleRow,
} from './types'
import {
  buildEventInsert,
  useCreateEvent,
  useDeleteEvent,
  useToggleEventStatus,
  useUpdateEvent,
  useUpdateConfig,
} from './useDayOf'
import { CheckIcon, Meter } from './ui'

const ScheduleItem = ({
  row,
  onToggle,
  onOpen,
}: {
  row: ScheduleRow
  onToggle: (row: ScheduleRow) => void
  onOpen: (row: ScheduleRow) => void
}) => {
  const done = row.status === 'done'
  const start = hhmm(row.starts_at)
  const end = hhmm(row.ends_at)
  const dur = durationLabel(row.duration_min)
  const isCeremonyStart = row.offset_min === 0

  return (
    <li
      className="dof-item dof-item--schedule"
      data-tone={done ? 'done' : isCeremonyStart ? 'anchor' : undefined}
    >
      <button
        type="button"
        className="dof-check"
        role="checkbox"
        aria-checked={done}
        aria-label={`${row.title} ${done ? '완료 해제' : '완료 표시'}`}
        onClick={() => onToggle(row)}
      >
        <span className="dof-check__box">
          <CheckIcon />
        </span>
      </button>

      <button type="button" className="dof-item__body" onClick={() => onOpen(row)}>
        <span className="dof-item__time">
          {/* starts_at 이 null 인 경우는 방금 만든 행뿐이다. 뷰가 계산해 줄 때까지 자리만 잡아 둔다. */}
          <b>{start ?? '··:··'}</b>
          {end && start && end !== start && <i>~{end}</i>}
        </span>

        <span className="dof-item__main">
          <span className="dof-item__title">{row.title}</span>
          <span className="dof-item__meta">
            <span className="dof-badge dof-badge--offset">{offsetClock(row.offset_min)}</span>
            {dur && <span className="dof-badge">{dur}</span>}
            {row.location && <span className="dof-badge">{row.location}</span>}
            {row.role_name && (
              <span className="dof-badge dof-badge--role">
                {row.role_name}
                {row.role_person ? ` · ${row.role_person}` : ' · 미정'}
              </span>
            )}
            {row.status !== 'todo' && row.status !== 'done' && (
              <span className="dof-badge">{STATUS_LABEL[row.status]}</span>
            )}
            {!start && <span className="dof-badge dof-badge--pending">시각 계산 중</span>}
          </span>
          {row.note && <span className="dof-item__note">{row.note}</span>}
        </span>
      </button>
    </li>
  )
}

export const ScheduleSection = ({
  config,
  configPending,
  rows,
  roles,
  isPending,
  isError,
  error,
  onRetry,
  probe,
  probeError,
  onProbeRetry,
}: {
  config: DayOfConfig | null
  configPending: boolean
  rows: ScheduleRow[]
  roles: Role[]
  isPending: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  probe: ProbeState
  probeError: unknown
  onProbeRetry: () => void
}) => {
  const toggle = useToggleEventStatus()
  const create = useCreateEvent()
  const update = useUpdateEvent()
  const remove = useDeleteEvent()
  const saveConfig = useUpdateConfig()

  const [editor, setEditor] = useState<EventEditorTarget | null>(null)

  const busy = create.isPending || update.isPending || remove.isPending || saveConfig.isPending
  const writeError = toggle.error ?? create.error ?? update.error ?? remove.error ?? saveConfig.error
  const dismiss = () => {
    toggle.reset()
    create.reset()
    update.reset()
    remove.reset()
    saveConfig.reset()
  }

  const groups = groupByPhase(rows)
  const overall = progressOfSchedule(rows)
  const anchorId = baselineRowId(rows)
  const zeroRows = !isPending && !isError && rows.length === 0

  const handleToggle = (row: ScheduleRow) =>
    toggle.mutate({ id: row.id, status: row.status === 'done' ? 'todo' : 'done' })

  const handleCreate = (draft: EventDraft) => {
    create.mutate(buildEventInsert(rows, draft))
    setEditor(null)
  }

  const handleSave = (id: string, patch: EventUpdate) => {
    if (Object.keys(patch).length > 0) update.mutate({ id, patch })
    setEditor(null)
  }

  const handleDelete = (id: string) => {
    remove.mutate({ id })
    setEditor(null)
  }

  const handleConfigSave = (patch: DayOfConfigUpdate) =>
    saveConfig.mutate({ patch, missing: config === null })

  return (
    <>
      <CeremonyTimeCard
        config={config}
        busy={busy || configPending}
        onSave={handleConfigSave}
        pendingMove={saveConfig.isPending}
      />

      <section className="dof-card" aria-label="진행 상황">
        <Meter progress={overall} label="당일 진행 체크" />
        <p className="dof-hint">
          체크는 두 사람의 화면에 실시간으로 공유됩니다. 시각은 서버가 예식 기준 시각 +
          상대 분으로 계산한 값입니다.
        </p>
      </section>

      <div className="dof-controls">
        <span className="dof-controls__label">{rows.length}개 항목</span>
        <span className="dof-controls__spacer" />
        <button
          type="button"
          className="dof-addbtn"
          onClick={() => setEditor({ mode: 'create', presetPhase: null })}
          disabled={busy}
        >
          + 항목 추가
        </button>
      </div>

      {isPending && <LoadingList rows={6} />}

      {isError && <ErrorState error={error} onRetry={onRetry} what="진행표" />}

      {zeroRows && (
        <ZeroRowState
          what="진행표 항목"
          probe={probe}
          probeError={probeError}
          onRetry={onProbeRetry}
          onAdd={() => setEditor({ mode: 'create', presetPhase: null })}
          addLabel="첫 항목 추가"
          extra={
            config === null ? (
              <div className="dof-callout dof-callout--crit">
                <b>기준 시각 행이 없는 것이 원인일 가능성이 큽니다.</b>{' '}
                <code>day_of_schedule</code> 뷰는 <code>day_of_config</code> 와 cross join 하기
                때문에, <code>id=1</code> 행이 없으면 <code>day_of_events</code> 에 항목이 30개
                있어도 결과가 0행이 됩니다. 위 <b>시각 변경</b>에서 예식 시각을 먼저 넣어
                보세요.
              </div>
            ) : (
              <p>
                기준 시각 행은 정상입니다(<code>{hhmm(config.ceremony_at) ?? '--:--'}</code>). 즉{' '}
                <code>day_of_events</code> 테이블이 실제로 비어 있습니다. 시드가 아직 안 들어갔거나
                전부 삭제된 상태입니다.
              </p>
            )
          }
        />
      )}

      {groups.map((group) => (
        <section className="dof-group" key={group.phase}>
          <div className="dof-grouphead">
            <h3>
              {group.phase}
              <span className="dof-grouphead__range">{offsetLabel(group.firstOffset)}부터</span>
            </h3>
            <span className="dof-grouphead__count">
              {group.progress.done}/{group.progress.total}
            </span>
          </div>
          <ul className="dof-list">
            {group.rows.map((row) => (
              <Fragment key={row.id}>
                {/* 예식 시작(offset 0)이 이 화면의 원점이다. 목록에서 눈으로 바로 찾을 수 있게
                    기준선을 긋는다. offset 0 인 항목이 없어도 선은 제자리에 남는다. */}
                {row.id === anchorId && (
                  <li className="dof-anchor" aria-hidden="true">
                    <span>예식 시작 · {hhmm(config?.ceremony_at) ?? '--:--'}</span>
                  </li>
                )}
                <ScheduleItem
                  row={row}
                  onToggle={handleToggle}
                  onOpen={(r) => setEditor({ mode: 'edit', row: r })}
                />
              </Fragment>
            ))}
          </ul>
        </section>
      ))}

      {editor && (
        <EventEditor
          key={editor.mode === 'edit' ? editor.row.id : 'new'}
          target={editor}
          roles={roles}
          busy={busy}
          onClose={() => setEditor(null)}
          onCreate={handleCreate}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {writeError && <WriteToast message={describeError(writeError).message} onDismiss={dismiss} />}
    </>
  )
}
