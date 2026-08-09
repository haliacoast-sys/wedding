/**
 * TaskEditor.tsx — 추가/편집 하단 시트.
 *
 * 편집일 때는 바뀐 필드만 patch 로 만든다. 통째로 보내면 상대가 그 사이 고친
 * 다른 필드를 내 화면의 옛 값으로 덮어쓴다(마지막 저장이 이기는 문제).
 *
 * 삭제는 두 단계다. 첫 클릭은 확인 문구를 펼치기만 하고, 실제 삭제는 그 안의
 * 버튼을 한 번 더 눌러야 일어난다. window.confirm 을 쓰지 않은 건 모바일에서
 * 시트 위에 브라우저 대화상자가 겹치면 어느 항목을 지우는지 안 보이기 때문이다.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { ASSIGNEES, STATUS_LABEL, TASK_STATUSES } from './types'
import type { Assignee, Task, TaskDraft, TaskUpdate } from './types'

export type EditorTarget =
  | { mode: 'create'; presetCategory: string | null }
  | { mode: 'edit'; task: Task }

const draftFromTask = (task: Task): TaskDraft => ({
  title: task.title,
  category: task.category,
  due_date: task.due_date,
  assignee: task.assignee,
  status: task.status,
  note: task.note,
})

const emptyDraft = (category: string | null, assignee: Assignee | null): TaskDraft => ({
  title: '',
  category: category ?? '',
  due_date: null,
  assignee,
  status: 'todo',
  note: null,
})

/** 바뀐 필드만 골라낸다. 아무것도 안 바뀌었으면 빈 객체. */
const diff = (before: Task, after: TaskDraft): TaskUpdate => {
  const patch: TaskUpdate = {}
  const title = after.title.trim()
  const category = after.category.trim()
  const note = after.note?.trim() ? after.note.trim() : null

  if (title !== before.title) patch.title = title
  if (category !== before.category) patch.category = category
  if (after.due_date !== before.due_date) patch.due_date = after.due_date
  if (after.assignee !== before.assignee) patch.assignee = after.assignee
  if (after.status !== before.status) patch.status = after.status
  if (note !== before.note) patch.note = note
  return patch
}

export const TaskEditor = ({
  target,
  categories,
  defaultAssignee,
  busy,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: {
  target: EditorTarget
  categories: string[]
  defaultAssignee: Assignee | null
  busy: boolean
  onClose: () => void
  onCreate: (draft: TaskDraft) => void
  onSave: (id: string, patch: TaskUpdate) => void
  onDelete: (id: string) => void
}) => {
  const isEdit = target.mode === 'edit'
  const [draft, setDraft] = useState<TaskDraft>(() =>
    target.mode === 'edit'
      ? draftFromTask(target.task)
      : emptyDraft(target.presetCategory, defaultAssignee),
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const titleId = useId()

  // Escape 로 닫기. 시트가 열려 있는 동안 뒤쪽 페이지가 같이 스크롤되지 않게 막는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    titleRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const patch = target.mode === 'edit' ? diff(target.task, draft) : null
  const dirty = patch === null ? true : Object.keys(patch).length > 0
  const valid = draft.title.trim().length > 0
  const canSubmit = valid && dirty && !busy

  const submit = () => {
    if (!canSubmit) return
    if (target.mode === 'edit') onSave(target.task.id, patch ?? {})
    else onCreate(draft)
  }

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <div
      className="ck-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ck-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ck-sheet__head">
          <h2 id={titleId}>{isEdit ? '항목 편집' : '항목 추가'}</h2>
          <button type="button" className="ck-ghostbtn" style={{ position: 'static' }} onClick={onClose}>
            닫기
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="ck-field">
            <label htmlFor={`${titleId}-t`}>할 일</label>
            <input
              id={`${titleId}-t`}
              ref={titleRef}
              className="ck-input"
              value={draft.title}
              placeholder="예) 스튜디오 촬영 예약"
              onChange={(e) => set('title', e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>

          <div className="ck-field">
            <label htmlFor={`${titleId}-c`}>카테고리</label>
            <input
              id={`${titleId}-c`}
              className="ck-input"
              value={draft.category}
              list={listId}
              placeholder="비우면 '기타'로 저장됩니다"
              onChange={(e) => set('category', e.target.value)}
              autoComplete="off"
            />
            <datalist id={listId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="ck-field">
            <label htmlFor={`${titleId}-d`}>마감일</label>
            <input
              id={`${titleId}-d`}
              className="ck-input"
              type="date"
              value={draft.due_date ?? ''}
              onChange={(e) => set('due_date', e.target.value === '' ? null : e.target.value)}
            />
          </div>

          <div className="ck-field">
            <label>담당자</label>
            <div className="ck-segment">
              {ASSIGNEES.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="ck-chip"
                  aria-pressed={draft.assignee === a}
                  onClick={() => set('assignee', draft.assignee === a ? null : a)}
                >
                  {a}
                </button>
              ))}
              <button
                type="button"
                className="ck-chip"
                aria-pressed={draft.assignee === null}
                onClick={() => set('assignee', null)}
              >
                미지정
              </button>
            </div>
          </div>

          <div className="ck-field">
            <label>상태</label>
            <div className="ck-segment">
              {TASK_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="ck-chip"
                  aria-pressed={draft.status === s}
                  onClick={() => set('status', s)}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="ck-field">
            <label htmlFor={`${titleId}-n`}>메모</label>
            <textarea
              id={`${titleId}-n`}
              className="ck-textarea"
              value={draft.note ?? ''}
              placeholder="연락처, 링크, 결정 사항 등"
              onChange={(e) => set('note', e.target.value === '' ? null : e.target.value)}
            />
          </div>

          <div className="ck-sheet__actions">
            {isEdit && (
              <button
                type="button"
                className="ck-btn ck-btn--danger"
                onClick={() => setConfirmingDelete((v) => !v)}
                disabled={busy}
              >
                삭제
              </button>
            )}
            <button type="submit" className="ck-btn ck-btn--primary" disabled={!canSubmit}>
              {busy ? '저장 중…' : isEdit ? '저장' : '추가'}
            </button>
          </div>
        </form>

        {isEdit && confirmingDelete && target.mode === 'edit' && (
          <div className="ck-confirm">
            <p>
              <b>{target.task.title}</b> 을(를) 삭제합니다. 되돌릴 수 없습니다.
            </p>
            <div className="ck-confirm__row">
              <button
                type="button"
                className="ck-btn ck-btn--danger"
                onClick={() => onDelete(target.task.id)}
                disabled={busy}
              >
                삭제할게요
              </button>
              <button
                type="button"
                className="ck-btn"
                onClick={() => setConfirmingDelete(false)}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
