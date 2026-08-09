/**
 * EventEditor.tsx — 진행표 항목 추가·수정·삭제 시트.
 *
 * ★ 시각이 아니라 '예식 기준 상대 분'을 입력받는다.
 *   절대 시각을 입력받으면 예식 시간이 바뀔 때 모든 항목을 손으로 고쳐야 하고,
 *   반드시 몇 개를 빠뜨린다. 이 화면의 존재 이유가 그걸 막는 것이다.
 *
 * 부호(음수) 처리에 대해:
 *   offset 은 음수가 될 수 있는데(예식 전), iOS 숫자 키패드에는 마이너스가 없다.
 *   그래서 [예식 전 | 예식 후] 토글 + 시/분 두 칸으로 나눠 받는다.
 *   입력 중에도 결과를 "예식 4시간 전 (offset −240분)" 으로 되짚어 보여준다.
 *
 * 저장은 day_of_events 테이블로 나간다. day_of_schedule 은 뷰라 쓸 수 없다.
 */
import { useState } from 'react'
import { offsetClock, offsetLabel } from './format'
import { PHASES, TASK_STATUSES, STATUS_LABEL } from './types'
import type { DayOfPhase, EventDraft, EventUpdate, Role, ScheduleRow, TaskStatus } from './types'
import { Chip, Confirm, Field, Sheet } from './ui'

export type EventEditorTarget =
  | { mode: 'create'; presetPhase: DayOfPhase | null }
  | { mode: 'edit'; row: ScheduleRow }

const digits = (value: string): string => value.replace(/[^\d]/g, '')

const splitOffset = (offsetMin: number) => ({
  before: offsetMin < 0,
  hours: String(Math.floor(Math.abs(offsetMin) / 60)),
  minutes: String(Math.abs(offsetMin) % 60),
})

const joinOffset = (before: boolean, hours: string, minutes: string): number => {
  const h = Number(hours || '0')
  const m = Number(minutes || '0')
  const total = h * 60 + m
  return before ? -total : total
}

export const EventEditor = ({
  target,
  roles,
  busy,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: {
  target: EventEditorTarget
  roles: Role[]
  busy: boolean
  onClose: () => void
  onCreate: (draft: EventDraft) => void
  onSave: (id: string, patch: EventUpdate) => void
  onDelete: (id: string) => void
}) => {
  const editing = target.mode === 'edit' ? target.row : null
  const initialOffset = splitOffset(editing?.offset_min ?? 0)

  const [title, setTitle] = useState(editing?.title ?? '')
  const [phase, setPhase] = useState<DayOfPhase>(
    editing?.phase ?? (target.mode === 'create' ? (target.presetPhase ?? '예식') : '예식'),
  )
  const [before, setBefore] = useState(initialOffset.before)
  const [hours, setHours] = useState(initialOffset.hours)
  const [minutes, setMinutes] = useState(initialOffset.minutes)
  const [duration, setDuration] = useState(
    editing?.duration_min === null || editing?.duration_min === undefined
      ? ''
      : String(editing.duration_min),
  )
  const [location, setLocation] = useState(editing?.location ?? '')
  const [roleId, setRoleId] = useState<string | null>(editing?.role_id ?? null)
  const [status, setStatus] = useState<TaskStatus>(editing?.status ?? 'todo')
  const [note, setNote] = useState(editing?.note ?? '')
  const [confirming, setConfirming] = useState(false)

  const offsetMin = joinOffset(before, hours, minutes)
  const durationMin = duration.trim() === '' ? null : Number(duration)
  const canSave = title.trim().length > 0 && !busy

  const draft = (): EventDraft => ({
    title: title.trim(),
    phase,
    offset_min: offsetMin,
    duration_min: durationMin !== null && Number.isFinite(durationMin) ? durationMin : null,
    location: location.trim() ? location.trim() : null,
    role_id: roleId,
    note: note.trim() ? note.trim() : null,
    status,
  })

  /** 바뀐 필드만 담는다. 안 바꾼 컬럼까지 보내면 상대의 동시 편집을 덮어쓴다. */
  const patch = (): EventUpdate => {
    if (!editing) return {}
    const next = draft()
    const out: EventUpdate = {}
    if (next.title !== editing.title) out.title = next.title
    if (next.phase !== editing.phase) out.phase = next.phase
    if (next.offset_min !== editing.offset_min) out.offset_min = next.offset_min
    if (next.duration_min !== editing.duration_min) out.duration_min = next.duration_min
    if (next.location !== editing.location) out.location = next.location
    if (next.role_id !== editing.role_id) out.role_id = next.role_id
    if (next.note !== editing.note) out.note = next.note
    if (next.status !== editing.status) out.status = next.status
    return out
  }

  const submit = () => {
    if (!canSave) return
    if (editing) onSave(editing.id, patch())
    else onCreate(draft())
  }

  return (
    <Sheet
      title={editing ? '항목 수정' : '진행표 항목 추가'}
      onClose={onClose}
      footer={
        <>
          {editing && (
            <button
              type="button"
              className="dof-btn dof-btn--danger"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              삭제
            </button>
          )}
          <button
            type="button"
            className="dof-btn dof-btn--primary"
            onClick={submit}
            disabled={!canSave}
          >
            저장
          </button>
        </>
      }
    >
      <Field label="제목" htmlFor="dof-ev-title">
        <input
          id="dof-ev-title"
          className="dof-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 원판 촬영 — 양가 가족"
          autoFocus={!editing}
        />
      </Field>

      <Field label="단계">
        <div className="dof-segment" role="group" aria-label="단계">
          {PHASES.map((p) => (
            <Chip key={p} active={phase === p} onClick={() => setPhase(p)}>
              {p}
            </Chip>
          ))}
        </div>
      </Field>

      <Field
        label="시점 (예식 시작 기준)"
        hint="절대 시각이 아니라 예식 시작으로부터의 거리로 저장합니다. 예식 시간이 바뀌어도 이 값은 그대로 두면 됩니다."
      >
        <div className="dof-segment" role="group" aria-label="예식 전후">
          <Chip active={before} onClick={() => setBefore(true)}>
            예식 전
          </Chip>
          <Chip active={!before} onClick={() => setBefore(false)}>
            예식 후
          </Chip>
        </div>
        <div className="dof-row2">
          <label className="dof-row2__cell">
            <span>시간</span>
            <input
              className="dof-input"
              type="text"
              inputMode="numeric"
              value={hours}
              onChange={(e) => setHours(digits(e.target.value))}
              placeholder="0"
            />
          </label>
          <label className="dof-row2__cell">
            <span>분</span>
            <input
              className="dof-input"
              type="text"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(digits(e.target.value))}
              placeholder="0"
            />
          </label>
        </div>
        <p className="dof-echo">
          {offsetLabel(offsetMin)} · <code>offset {offsetClock(offsetMin)}</code> (
          {offsetMin}분)
        </p>
      </Field>

      <Field label="소요 시간 (분)" htmlFor="dof-ev-duration">
        <input
          id="dof-ev-duration"
          className="dof-input"
          type="text"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(digits(e.target.value))}
          placeholder="비워두면 표시하지 않습니다"
        />
      </Field>

      <Field label="장소" htmlFor="dof-ev-location">
        <input
          id="dof-ev-location"
          className="dof-input"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="예: 2F 루체홀"
        />
      </Field>

      <Field
        label="담당 역할"
        htmlFor="dof-ev-role"
        hint="역할 분담 탭의 목록에서 고릅니다. 이름이 정해지면 진행표에도 함께 나타납니다."
      >
        <select
          id="dof-ev-role"
          className="dof-select"
          value={roleId ?? ''}
          onChange={(e) => setRoleId(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">지정 안 함</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.role}
              {role.person_name ? ` — ${role.person_name}` : ' (미정)'}
            </option>
          ))}
        </select>
      </Field>

      <Field label="상태">
        <div className="dof-segment" role="group" aria-label="상태">
          {TASK_STATUSES.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="메모" htmlFor="dof-ev-note">
        <textarea
          id="dof-ev-note"
          className="dof-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {confirming && editing && (
        <Confirm
          message={`'${editing.title}' 항목을 삭제합니다.`}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => onDelete(editing.id)}
        />
      )}
    </Sheet>
  )
}
