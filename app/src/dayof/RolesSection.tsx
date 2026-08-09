/**
 * RolesSection.tsx — 역할 분담.
 *
 * 두 가지가 이 화면의 핵심이다.
 *
 * 1) 미정(person_name = null)을 눈에 띄게.
 *    시드 기준으로 11개 역할이 전부 미정이다. 목록에 섞여 있으면 무엇이 남았는지 안 보인다.
 *    그래서 미정은 왼쪽 띠 + 배지로 분리하고, 맨 위에 남은 개수를 먼저 보여준다.
 *
 * 2) 사례비 합계.
 *    당일 현금 봉투로 나가는 돈이다. 전날 은행에 다녀와야 하므로 총액을 미리 알아야 한다.
 *    확정분과 전체를 나눠 보여주는 이유는, 미정 자리의 사례비가 섭외가 끝나는 순간
 *    그대로 확정 지출로 바뀌기 때문이다. 둘 다 봐야 준비할 금액이 나온다.
 *
 * 연락처는 tel: 링크로 건다. 당일 가장 많이 쓰는 기능이다.
 */
import { useState } from 'react'
import { describeError } from './dayofApi'
import { won, wonPlain } from './format'
import { feeTotals, isUnassigned, sortRoles, telHref } from './selectors'
import { ErrorState, LoadingList, WriteToast, ZeroRowState } from './StateViews'
import type { ProbeState } from './StateViews'
import { RoleEditor } from './RoleEditor'
import type { RoleEditorTarget } from './RoleEditor'
import type { Role, RoleDraft, RoleUpdate } from './types'
import { buildRoleInsert, useCreateRole, useDeleteRole, useUpdateRole } from './useDayOf'
import { CheckIcon, PhoneIcon } from './ui'

const RoleCard = ({
  role,
  onToggleConfirmed,
  onOpen,
}: {
  role: Role
  onToggleConfirmed: (role: Role) => void
  onOpen: (role: Role) => void
}) => {
  const undecided = isUnassigned(role)
  const tel = telHref(role.contact)

  return (
    <li className="dof-item dof-item--role" data-tone={undecided ? 'undecided' : undefined}>
      <button
        type="button"
        className="dof-check"
        role="checkbox"
        aria-checked={role.confirmed}
        aria-label={`${role.role} ${role.confirmed ? '확정 해제' : '확정 표시'}`}
        onClick={() => onToggleConfirmed(role)}
      >
        <span className="dof-check__box">
          <CheckIcon />
        </span>
      </button>

      <button type="button" className="dof-item__body" onClick={() => onOpen(role)}>
        <span className="dof-item__title">
          {role.role}
          <span className="dof-badge dof-badge--side">{role.side}</span>
        </span>
        <span className="dof-item__meta">
          {undecided ? (
            <span className="dof-badge dof-badge--undecided">담당자 미정</span>
          ) : (
            <span className="dof-badge dof-badge--person">{role.person_name}</span>
          )}
          {role.confirmed && <span className="dof-badge dof-badge--ok">확정</span>}
          {role.fee !== null && role.fee !== undefined && (
            <span className="dof-badge dof-badge--fee">{won(role.fee)}</span>
          )}
        </span>
        {role.note && <span className="dof-item__note">{role.note}</span>}
      </button>

      {tel ? (
        <a className="dof-call" href={tel} aria-label={`${role.person_name ?? role.role} 에게 전화`}>
          <PhoneIcon />
        </a>
      ) : (
        <span className="dof-call dof-call--off" aria-hidden="true">
          <PhoneIcon />
        </span>
      )}
    </li>
  )
}

export const RolesSection = ({
  roles,
  isPending,
  isError,
  error,
  onRetry,
  probe,
  probeError,
  onProbeRetry,
}: {
  roles: Role[]
  isPending: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  probe: ProbeState
  probeError: unknown
  onProbeRetry: () => void
}) => {
  const create = useCreateRole()
  const update = useUpdateRole()
  const remove = useDeleteRole()
  const [editor, setEditor] = useState<RoleEditorTarget | null>(null)

  const busy = create.isPending || update.isPending || remove.isPending
  const writeError = create.error ?? update.error ?? remove.error
  const dismiss = () => {
    create.reset()
    update.reset()
    remove.reset()
  }

  const sorted = sortRoles(roles)
  const totals = feeTotals(roles)
  const zeroRows = !isPending && !isError && roles.length === 0

  const handleCreate = (draft: RoleDraft) => {
    create.mutate(buildRoleInsert(roles, draft))
    setEditor(null)
  }
  const handleSave = (id: string, patch: RoleUpdate) => {
    if (Object.keys(patch).length > 0) update.mutate({ id, patch })
    setEditor(null)
  }
  const handleDelete = (id: string) => {
    remove.mutate({ id })
    setEditor(null)
  }

  return (
    <>
      <section className="dof-card dof-fees" aria-label="사례비 합계">
        <div className="dof-fees__main">
          <span className="dof-fees__eyebrow">당일 현금 봉투 합계</span>
          <b className="dof-fees__amount">
            {wonPlain(totals.all)}
            <i>원</i>
          </b>
        </div>
        <div className="dof-fees__split">
          <div>
            <span>확정</span>
            <b>{won(totals.confirmed)}</b>
          </div>
          <div>
            <span>미정 자리</span>
            <b>{won(totals.unassigned)}</b>
          </div>
          <div>
            <span>역할</span>
            <b>
              {roles.length - totals.unassignedCount}/{roles.length}명
            </b>
          </div>
        </div>
        {totals.unassignedCount > 0 && (
          <div className="dof-callout dof-callout--warn">
            아직 사람이 정해지지 않은 자리가 <b>{totals.unassignedCount}개</b> 있습니다. 그
            자리들의 사례비 <b>{won(totals.unassigned)}</b> 은 섭외가 끝나면 그대로 당일 지출이
            됩니다. 봉투는 전날 미리 준비해 이름을 적어 두세요.
          </div>
        )}
      </section>

      <div className="dof-controls">
        <span className="dof-controls__label">
          확정 {totals.confirmedCount}/{roles.length}
        </span>
        <span className="dof-controls__spacer" />
        <button
          type="button"
          className="dof-addbtn"
          onClick={() => setEditor({ mode: 'create' })}
          disabled={busy}
        >
          + 역할 추가
        </button>
      </div>

      {isPending && <LoadingList rows={5} />}
      {isError && <ErrorState error={error} onRetry={onRetry} what="역할 목록" />}

      {zeroRows && (
        <ZeroRowState
          what="역할"
          probe={probe}
          probeError={probeError}
          onRetry={onProbeRetry}
          onAdd={() => setEditor({ mode: 'create' })}
          addLabel="첫 역할 추가"
          extra={
            <p>
              <code>day_of_roles</code> 가 비어 있습니다. 시드가 아직 안 들어갔거나 전부 삭제된
              상태입니다.
            </p>
          }
        />
      )}

      {sorted.length > 0 && (
        <ul className="dof-list">
          {sorted.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onToggleConfirmed={(r) =>
                update.mutate({ id: r.id, patch: { confirmed: !r.confirmed } })
              }
              onOpen={(r) => setEditor({ mode: 'edit', role: r })}
            />
          ))}
        </ul>
      )}

      {editor && (
        <RoleEditor
          key={editor.mode === 'edit' ? editor.role.id : 'new'}
          target={editor}
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
