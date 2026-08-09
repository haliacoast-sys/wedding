/**
 * ItemEditor.tsx — 준비물 추가·수정·삭제 시트.
 *
 * 분류(category)는 자유 문자열이라 enum 이 아니다. 기존 분류를 datalist 로 제안해
 * '신부' 와 '신부용' 이 따로 생기는 것을 막는다. 그래도 새 분류는 얼마든지 만들 수 있다.
 */
import { useState } from 'react'
import { ASSIGNEES } from './types'
import type { Assignee, Item, ItemDraft, ItemUpdate } from './types'
import { Confirm, Field, Segment, Sheet } from './ui'

export type ItemEditorTarget =
  | { mode: 'create'; presetCategory: string | null }
  | { mode: 'edit'; item: Item }

export const ItemEditor = ({
  target,
  categories,
  busy,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: {
  target: ItemEditorTarget
  categories: string[]
  busy: boolean
  onClose: () => void
  onCreate: (draft: ItemDraft) => void
  onSave: (id: string, patch: ItemUpdate) => void
  onDelete: (id: string) => void
}) => {
  const editing = target.mode === 'edit' ? target.item : null

  const [label, setLabel] = useState(editing?.label ?? '')
  const [category, setCategory] = useState(
    editing?.category ?? (target.mode === 'create' ? (target.presetCategory ?? '') : ''),
  )
  const [owner, setOwner] = useState<Assignee | null>(editing?.owner ?? null)
  const [note, setNote] = useState(editing?.note ?? '')
  const [confirming, setConfirming] = useState(false)

  const canSave = label.trim().length > 0 && !busy

  const draft = (): ItemDraft => ({
    label: label.trim(),
    category: category.trim() || '기타',
    owner,
    note: note.trim() ? note.trim() : null,
  })

  const patch = (): ItemUpdate => {
    if (!editing) return {}
    const next = draft()
    const out: ItemUpdate = {}
    if (next.label !== editing.label) out.label = next.label
    if (next.category !== editing.category) out.category = next.category
    if (next.owner !== editing.owner) out.owner = next.owner
    if (next.note !== editing.note) out.note = next.note
    return out
  }

  const submit = () => {
    if (!canSave) return
    if (editing) onSave(editing.id, patch())
    else onCreate(draft())
  }

  return (
    <Sheet
      title={editing ? '준비물 수정' : '준비물 추가'}
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
      <Field label="이름" htmlFor="dof-item-label">
        <input
          id="dof-item-label"
          className="dof-input"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 결혼반지"
          autoFocus={!editing}
        />
      </Field>

      <Field label="분류" htmlFor="dof-item-category" hint="비워두면 '기타'로 들어갑니다.">
        <input
          id="dof-item-category"
          className="dof-input"
          type="text"
          list="dof-item-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="예: 신부 / 공통 / 서류"
        />
        <datalist id="dof-item-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>

      <Field label="담당">
        <Segment
          label="담당"
          value={owner}
          options={ASSIGNEES}
          onChange={setOwner}
          allowNull
          nullLabel="미지정"
        />
      </Field>

      <Field label="메모" htmlFor="dof-item-note">
        <textarea
          id="dof-item-note"
          className="dof-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {confirming && editing && (
        <Confirm
          message={`'${editing.label}' 을(를) 목록에서 삭제합니다.`}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => onDelete(editing.id)}
        />
      )}
    </Sheet>
  )
}
