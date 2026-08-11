/**
 * CeremonyTimeCard.tsx — 진행표 맨 위의 기준 시각 카드 + 편집 시트.
 *
 * 이 화면 전체가 이 한 값 위에 얹혀 있다.
 * day_of_events 의 각 항목은 절대 시각을 갖고 있지 않고 예식 시작 기준 상대 분만 갖는다.
 * 실제 시각은 day_of_schedule 뷰가 ceremony_at + offset 으로 계산한다.
 * 그래서 여기를 한 번 고치면 30여 개 항목이 통째로 따라 움직인다.
 * 사용자가 그 사실을 모르고 누르면 안 되므로 안내 문구를 편집 화면 안에 붙여 둔다.
 *
 * 시간은 2026-08-09 에 계약서 원본대로 11:00 으로 확정됐다. 그래도 이 화면은 남긴다 —
 * 상대 분 저장 방식 덕분에 시간이 다시 바뀌어도 이 한 값만 고치면 되고,
 * 그 사실을 사용자가 알 수 있어야 개별 항목을 손으로 고치는 사고를 막을 수 있다.
 */
import { useState } from 'react'
import { dateLabel, fromLocalInput, hhmm, offsetLabel, toLocalInput } from './format'
import { Confirm, Field, Sheet } from './ui'
import type { DayOfConfig, DayOfConfigUpdate } from './types'

export const CeremonyTimeCard = ({
  config,
  busy,
  onSave,
  pendingMove,
}: {
  config: DayOfConfig | null
  busy: boolean
  onSave: (patch: DayOfConfigUpdate) => void
  /** 저장 직후 뷰가 다시 계산되기 전인지. true 면 진행표 시각이 아직 옛 값이다. */
  pendingMove: boolean
}) => {
  const [open, setOpen] = useState(false)

  const time = hhmm(config?.ceremony_at)
  const date = dateLabel(config?.ceremony_at)

  return (
    <>
      <section className="dof-card dof-base" aria-label="예식 기준 시각">
        <div className="dof-base__head">
          <span className="dof-base__eyebrow">예식 시작 기준 시각</span>
          <button
            type="button"
            className="dof-btn dof-btn--quiet"
            onClick={() => setOpen(true)}
            disabled={busy}
          >
            시각 변경
          </button>
        </div>

        {config ? (
          <>
            <div className="dof-base__clock">
              <b>{time ?? '--:--'}</b>
              <span>{date ?? '날짜 미상'}</span>
            </div>
            {config.hall && <p className="dof-base__hall">{config.hall}</p>}
            <div className="dof-base__facts">
              {config.guarantee_count !== null && config.guarantee_count !== undefined && (
                <span className="dof-badge">보증 인원 {config.guarantee_count}명</span>
              )}
              <span className="dof-badge">
                연회 {offsetLabel(config.banquet_from_offset_min)} ~{' '}
                {offsetLabel(config.banquet_to_offset_min)}
              </span>
            </div>
            {config.note && <p className="dof-base__note">{config.note}</p>}
          </>
        ) : (
          <div className="dof-callout dof-callout--crit">
            <b>기준 시각 행이 없습니다.</b> <code>day_of_config</code> 에 <code>id=1</code> 행이
            없으면 <code>day_of_schedule</code> 뷰가 cross join 때문에 0행을 반환합니다. 진행표
            항목이 있어도 화면은 텅 빈 채로 보입니다. 아래 <b>시각 변경</b>에서 예식 시각을
            넣으면 행을 새로 만듭니다.
          </div>
        )}

        {pendingMove && (
          <div className="dof-callout dof-callout--warn">
            기준 시각을 바꿨습니다. 각 항목의 실제 시각은 서버(<code>day_of_schedule</code> 뷰)가
            다시 계산해 내려줍니다. 잠시 뒤 아래 시각이 새 값으로 바뀝니다.
          </div>
        )}
      </section>

      {open && (
        <CeremonyTimeSheet
          config={config}
          busy={busy}
          onClose={() => setOpen(false)}
          onSave={(patch) => {
            onSave(patch)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

const CeremonyTimeSheet = ({
  config,
  busy,
  onClose,
  onSave,
}: {
  config: DayOfConfig | null
  busy: boolean
  onClose: () => void
  onSave: (patch: DayOfConfigUpdate) => void
}) => {
  const [local, setLocal] = useState(() => toLocalInput(config?.ceremony_at))
  const [hall, setHall] = useState(config?.hall ?? '')
  const [guarantee, setGuarantee] = useState(
    config?.guarantee_count === null || config?.guarantee_count === undefined
      ? ''
      : String(config.guarantee_count),
  )
  const [note, setNote] = useState(config?.note ?? '')
  const [confirming, setConfirming] = useState(false)

  const iso = fromLocalInput(local)
  const changed = iso !== null && iso !== (config?.ceremony_at ?? null)
  const valid = iso !== null

  const submit = () => {
    if (!iso) return
    const guaranteeValue = guarantee.trim() === '' ? null : Number(guarantee)
    onSave({
      ceremony_at: iso,
      hall: hall.trim() ? hall.trim() : null,
      guarantee_count:
        guaranteeValue !== null && Number.isFinite(guaranteeValue) ? guaranteeValue : null,
      note: note.trim() ? note.trim() : null,
    })
  }

  return (
    <Sheet
      title="예식 기준 시각"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="dof-btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="dof-btn dof-btn--primary"
            disabled={!valid || busy}
            onClick={() => (changed ? setConfirming(true) : submit())}
          >
            저장
          </button>
        </>
      }
    >
      <div className="dof-callout">
        <b>여기를 고치면 진행표 전체가 함께 움직입니다.</b> 각 항목은 절대 시각이 아니라{' '}
        <b>예식 시작 기준 상대 분</b>으로 저장돼 있습니다. 예를 들어 &lsquo;식사 시작&rsquo;은{' '}
        <code>+70분</code>으로만 적혀 있어서, 예식이 11:00 이면 12:10, 11:30 이면 12:40 이
        됩니다. 개별 항목을 하나하나 고칠 필요가 없고, 고쳐서도 안 됩니다.
      </div>

      <Field
        label="예식 시작"
        htmlFor="dof-ceremony-at"
        hint="예식장 현지(한국) 시각으로 입력합니다. 해외에서 접속해도 같은 값으로 저장됩니다."
      >
        <input
          id="dof-ceremony-at"
          className="dof-input"
          type="datetime-local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />
      </Field>

      {!valid && (
        <div className="dof-callout dof-callout--crit">
          날짜와 시각을 모두 채워야 저장할 수 있습니다.
        </div>
      )}

      <Field label="예식장" htmlFor="dof-hall">
        <input
          id="dof-hall"
          className="dof-input"
          type="text"
          value={hall}
          onChange={(e) => setHall(e.target.value)}
          placeholder="예: CA웨딩컨벤션 2F 루체홀"
        />
      </Field>

      <Field label="보증 인원" htmlFor="dof-guarantee">
        <input
          id="dof-guarantee"
          className="dof-input"
          type="text"
          inputMode="numeric"
          value={guarantee}
          onChange={(e) => setGuarantee(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="예: 200"
        />
      </Field>

      <Field label="메모" htmlFor="dof-config-note">
        <textarea
          id="dof-config-note"
          className="dof-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예식 시간 확정 여부, 홀 동의 진행 상황 등"
        />
      </Field>

      {confirming && (
        <Confirm
          message={`예식 시작을 ${dateLabel(iso) ?? ''} ${hhmm(iso) ?? '--:--'} 로 바꿉니다. 진행표의 모든 항목 시각이 함께 이동합니다.`}
          confirmLabel="시각 변경"
          danger={false}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            submit()
          }}
        />
      )}
    </Sheet>
  )
}
