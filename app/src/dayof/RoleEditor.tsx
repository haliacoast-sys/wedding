/**
 * RoleEditor.tsx — 역할 추가·수정·삭제 시트.
 *
 * fee 는 bigint(원 단위 정수)다. 소수점이 들어갈 여지를 아예 막기 위해 입력에서
 * 숫자 외 문자를 지우고, 화면에는 천단위 쉼표를 붙여 되짚어 준다.
 * 30만 원을 3만 원으로 잘못 읽는 사고가 실제로 잦다.
 */
import { useState } from 'react'
import { won } from './format'
import { SIDES } from './types'
import type { Role, RoleDraft, RoleUpdate, WeddingSide } from './types'
import { Chip, Confirm, Field, Sheet } from './ui'

export type RoleEditorTarget = { mode: 'create' } | { mode: 'edit'; role: Role }

const digits = (value: string): string => value.replace(/[^\d]/g, '')

export const RoleEditor = ({
  target,
  busy,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: {
  target: RoleEditorTarget
  busy: boolean
  onClose: () => void
  onCreate: (draft: RoleDraft) => void
  onSave: (id: string, patch: RoleUpdate) => void
  onDelete: (id: string) => void
}) => {
  const editing = target.mode === 'edit' ? target.role : null

  const [role, setRole] = useState(editing?.role ?? '')
  const [side, setSide] = useState<WeddingSide>(editing?.side ?? '공통')
  const [person, setPerson] = useState(editing?.person_name ?? '')
  const [contact, setContact] = useState(editing?.contact ?? '')
  const [fee, setFee] = useState(
    editing?.fee === null || editing?.fee === undefined ? '' : String(editing.fee),
  )
  const [confirmed, setConfirmed] = useState(editing?.confirmed ?? false)
  const [note, setNote] = useState(editing?.note ?? '')
  const [confirming, setConfirming] = useState(false)

  const feeValue = fee.trim() === '' ? null : Number(fee)
  const canSave = role.trim().length > 0 && !busy

  const draft = (): RoleDraft => ({
    role: role.trim(),
    side,
    person_name: person.trim() ? person.trim() : null,
    contact: contact.trim() ? contact.trim() : null,
    fee: feeValue !== null && Number.isFinite(feeValue) ? feeValue : null,
    confirmed,
    note: note.trim() ? note.trim() : null,
  })

  /** 바뀐 필드만 담는다. 안 바꾼 컬럼까지 보내면 상대의 동시 편집을 덮어쓴다. */
  const patch = (): RoleUpdate => {
    if (!editing) return {}
    const next = draft()
    const out: RoleUpdate = {}
    if (next.role !== editing.role) out.role = next.role
    if (next.side !== editing.side) out.side = next.side
    if (next.person_name !== editing.person_name) out.person_name = next.person_name
    if (next.contact !== editing.contact) out.contact = next.contact
    if (next.fee !== editing.fee) out.fee = next.fee
    if (next.confirmed !== editing.confirmed) out.confirmed = next.confirmed
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
      title={editing ? '역할 수정' : '역할 추가'}
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
      <Field label="역할" htmlFor="dof-role-name">
        <input
          id="dof-role-name"
          className="dof-input"
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="예: 사회자"
          autoFocus={!editing}
        />
      </Field>

      <Field label="구분">
        <div className="dof-segment" role="group" aria-label="구분">
          {SIDES.map((s) => (
            <Chip key={s} active={side === s} onClick={() => setSide(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </Field>

      <Field
        label="이름"
        htmlFor="dof-role-person"
        hint="비워두면 '미정'으로 표시됩니다. 아직 정하지 않았다면 비워두는 편이 낫습니다."
      >
        <input
          id="dof-role-person"
          className="dof-input"
          type="text"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        />
      </Field>

      <Field
        label="연락처"
        htmlFor="dof-role-contact"
        hint="입력하면 목록에서 바로 전화를 걸 수 있습니다."
      >
        <input
          id="dof-role-contact"
          className="dof-input"
          type="tel"
          inputMode="tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="010-0000-0000"
        />
      </Field>

      <Field
        label="사례비"
        htmlFor="dof-role-fee"
        hint={feeValue !== null ? `${won(feeValue)} · 당일 현금 봉투` : '비워두면 합계에서 빠집니다.'}
      >
        <input
          id="dof-role-fee"
          className="dof-input"
          type="text"
          inputMode="numeric"
          value={fee}
          onChange={(e) => setFee(digits(e.target.value))}
          placeholder="예: 300000"
        />
      </Field>

      <Field label="확정 여부">
        <div className="dof-segment" role="group" aria-label="확정 여부">
          <Chip active={!confirmed} onClick={() => setConfirmed(false)}>
            미확정
          </Chip>
          <Chip active={confirmed} onClick={() => setConfirmed(true)}>
            확정
          </Chip>
        </div>
      </Field>

      <Field label="메모" htmlFor="dof-role-note">
        <textarea
          id="dof-role-note"
          className="dof-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {confirming && editing && (
        <Confirm
          message={`'${editing.role}' 역할을 삭제합니다. 이 역할을 담당으로 지정해 둔 진행표 항목은 담당자 없음으로 바뀝니다.`}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => onDelete(editing.id)}
        />
      )}
    </Sheet>
  )
}
