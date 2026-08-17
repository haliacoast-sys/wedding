/**
 * GuestEditor.tsx — 한 명의 모든 칸을 고치는 하단 시트.
 *
 * 목록에서 자주 쓰는 두 가지(참석 여부·청첩장)는 행에서 바로 돌린다. 여기는
 * 나머지를 채우러 오는 곳이다. 그래서 순서를 '먼저 알게 되는 것'부터 놓았다:
 *   이름 → 측·관계 → 연락처 → 청첩장 → 참석 → 인원 → 축의금 → 메모
 *
 * ★ 저장은 바뀐 칸만 보낸다.
 *   두 사람이 같은 사람의 다른 칸을 동시에 고칠 수 있다(한쪽은 연락처, 다른 쪽은 축의금).
 *   전체 필드를 통째로 보내면 나중에 저장한 쪽이 상대의 변경까지 옛 값으로 되돌린다.
 *   바뀐 키만 보내면 그 충돌이 컬럼 단위로 줄어든다.
 */
import { useId, useState } from 'react'
import {
  ATTENDANCES,
  INVITE_STATES,
  MAX_PEOPLE_PER_ROW,
  RELATIONS,
  SIDES,
  draftOf,
} from './types'
import type { Guest, GuestDraft, GuestUpdate } from './types'
import { groupDigits, manwon, onlyDigits, parseWon } from './format'
import { Chip, Confirm, CountStepper, Field, Segment, Sheet } from './ui'

/**
 * 축의금 입력.
 *
 * 포커스 중에는 숫자만, 포커스가 빠지면 천단위 쉼표를 찍는다.
 * 입력 중에 쉼표를 계속 다시 찍으면 문자열 길이가 바뀌어 커서가 튄다. 그 문제를
 * 커서 위치 재계산으로 푸는 방법도 있지만(예산 화면이 그렇게 한다), 축의금은
 * 보통 끝에서부터 한 번에 치고 마는 값이라 여기서는 단순한 쪽을 골랐다.
 */
const GiftInput = ({
  id,
  value,
  onChange,
}: {
  id: string
  value: number | null
  onChange: (won: number | null) => void
}) => {
  const [focused, setFocused] = useState(false)
  const digits = value === null ? '' : String(value)
  return (
    <>
      <div className="gs-moneybox">
        <input
          id={id}
          className="gs-input gs-input--money"
          type="text"
          inputMode="numeric"
          pattern="[0-9,]*"
          autoComplete="off"
          placeholder="0"
          value={focused ? digits : digits === '' ? '' : groupDigits(digits)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(parseWon(onlyDigits(e.currentTarget.value).slice(0, 12)))}
        />
        <span className="gs-moneybox__unit" aria-hidden="true">
          원
        </span>
      </div>
      <div className="gs-quickrow">
        {[50_000, 100_000, 200_000].map((amount) => (
          <button
            key={amount}
            type="button"
            className="gs-quickbtn"
            onClick={() => onChange((value ?? 0) + amount)}
          >
            +{amount / 10_000}만
          </button>
        ))}
        <button
          type="button"
          className="gs-quickbtn gs-quickbtn--clear"
          onClick={() => onChange(null)}
          disabled={value === null}
        >
          지우기
        </button>
      </div>
      {value !== null && value >= 10_000 && <p className="gs-field__hint">{manwon(value)}</p>}
    </>
  )
}

/** 바뀐 칸만 골라낸다. 하나도 안 바뀌었으면 빈 객체 → 호출부가 저장을 건너뛴다. */
const diffPatch = (before: Guest, draft: GuestDraft): GuestUpdate => {
  const trimmed = (v: string | null) => {
    const t = v?.trim()
    return t ? t : null
  }
  const patch: GuestUpdate = {}
  const name = draft.name.trim()
  if (name !== before.name) patch.name = name
  if (draft.side !== before.side) patch.side = draft.side
  if (trimmed(draft.relation) !== before.relation) patch.relation = trimmed(draft.relation)
  if (trimmed(draft.contact) !== before.contact) patch.contact = trimmed(draft.contact)
  if (draft.invitation !== before.invitation) patch.invitation = draft.invitation
  if (draft.attending !== before.attending) patch.attending = draft.attending
  if (draft.head_count !== before.head_count) patch.head_count = draft.head_count
  if (draft.meal_count !== before.meal_count) patch.meal_count = draft.meal_count
  if ((draft.gift_amount ?? null) !== before.gift_amount) patch.gift_amount = draft.gift_amount
  if (trimmed(draft.thanks) !== before.thanks) patch.thanks = trimmed(draft.thanks)
  if (trimmed(draft.memo) !== before.memo) patch.memo = trimmed(draft.memo)
  return patch
}

export const GuestEditor = ({
  guest,
  onClose,
  onSave,
  onDelete,
  busy,
}: {
  guest: Guest
  onClose: () => void
  onSave: (patch: GuestUpdate) => void
  onDelete: () => void
  busy: boolean
}) => {
  const [draft, setDraft] = useState<GuestDraft>(() => draftOf(guest))
  const [confirming, setConfirming] = useState(false)
  const uid = useId()

  const set = <K extends keyof GuestDraft>(key: K, value: GuestDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  /**
   * 참석 인원을 올리면 식사 인원도 따라 올린다 — 단, 둘이 같았을 때만.
   * 사용자가 이미 식사 인원을 따로 정해 뒀다면(아이 때문에 head 3 / meal 2)
   * 그 의도를 덮어쓰면 안 된다.
   */
  const setHead = (next: number) =>
    setDraft((d) => ({
      ...d,
      head_count: next,
      meal_count: d.meal_count === d.head_count ? next : Math.min(d.meal_count, next),
    }))

  const nameOk = draft.name.trim() !== ''
  const relationIsCustom =
    !!draft.relation?.trim() && !(RELATIONS as readonly string[]).includes(draft.relation.trim())

  return (
    <Sheet
      title={guest.name || '하객'}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="gs-btn gs-btn--danger"
            onClick={() => setConfirming(true)}
            disabled={busy || confirming}
          >
            삭제
          </button>
          <button
            type="button"
            className="gs-btn gs-btn--primary"
            disabled={!nameOk || busy}
            onClick={() => {
              const patch = diffPatch(guest, draft)
              if (Object.keys(patch).length === 0) {
                onClose()
                return
              }
              onSave(patch)
            }}
          >
            저장
          </button>
        </>
      }
    >
      <Field label="이름" htmlFor={`${uid}-name`}>
        <input
          id={`${uid}-name`}
          className="gs-input"
          type="text"
          autoComplete="off"
          value={draft.name}
          onChange={(e) => set('name', e.currentTarget.value)}
        />
      </Field>

      <Field label="측">
        <Segment
          label="측"
          value={draft.side}
          options={SIDES}
          onChange={(next) => next && set('side', next)}
        />
      </Field>

      <Field
        label="관계"
        hint={
          relationIsCustom
            ? '목록에 없는 값도 그대로 저장되고 명단에서 같은 이름끼리 묶입니다.'
            : '명단은 이 값으로 묶여서 보입니다. 직접 입력해도 됩니다.'
        }
        htmlFor={`${uid}-relation`}
      >
        <div className="gs-segment">
          {RELATIONS.map((r) => (
            <Chip
              key={r}
              active={draft.relation?.trim() === r}
              onClick={() => set('relation', draft.relation?.trim() === r ? null : r)}
            >
              {r}
            </Chip>
          ))}
        </div>
        <input
          id={`${uid}-relation`}
          className="gs-input gs-input--sub"
          type="text"
          autoComplete="off"
          placeholder="직접 입력 (예: 대학 동기)"
          value={draft.relation ?? ''}
          onChange={(e) => set('relation', e.currentTarget.value || null)}
        />
      </Field>

      <Field label="연락처" htmlFor={`${uid}-contact`} hint="적어 두면 명단에서 바로 전화할 수 있습니다.">
        <input
          id={`${uid}-contact`}
          className="gs-input"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="010-0000-0000"
          value={draft.contact ?? ''}
          onChange={(e) => set('contact', e.currentTarget.value || null)}
        />
      </Field>

      <Field label="청첩장">
        <Segment
          label="청첩장"
          value={draft.invitation}
          options={INVITE_STATES}
          onChange={(next) => next && set('invitation', next)}
        />
      </Field>

      <Field label="참석 여부">
        <Segment
          label="참석 여부"
          value={draft.attending}
          options={ATTENDANCES}
          onChange={(next) => next && set('attending', next)}
        />
      </Field>

      <Field
        label="인원"
        hint="참석 인원은 식장에 오는 사람 수, 식사 인원은 식대가 나가는 사람 수입니다. 아이가 함께 오면 두 값이 달라지고, 보증인원에 세는 건 식사 인원 쪽입니다."
      >
        {/* <label> 로 감싸지 않는다. 그러면 캡션을 눌렀을 때 첫 번째 컨트롤(− 버튼)이
            눌려서 인원이 줄어든다. 접근성 이름은 CountStepper 가 aria-label 로 붙인다. */}
        <div className="gs-row2">
          <div className="gs-row2__cell">
            <span>참석 인원</span>
            <CountStepper
              label="참석 인원"
              value={draft.head_count}
              onChange={setHead}
              min={1}
              max={MAX_PEOPLE_PER_ROW}
            />
          </div>
          <div className="gs-row2__cell">
            <span>식사 인원</span>
            <CountStepper
              label="식사 인원"
              value={draft.meal_count}
              onChange={(n) => set('meal_count', n)}
              min={0}
              max={MAX_PEOPLE_PER_ROW}
            />
          </div>
        </div>
        {draft.meal_count !== draft.head_count && (
          <p className="gs-echo">
            참석 {draft.head_count}명 중 {draft.meal_count}명분 식대 — 차이 {draft.head_count - draft.meal_count}명은
            식대가 나가지 않습니다.
          </p>
        )}
        {draft.attending !== '참석' && (
          <p className="gs-field__hint">
            참석 여부가 <b>{draft.attending}</b> 이라 이 인원은 아직 집계에 들어가지 않습니다.
          </p>
        )}
      </Field>

      <Field
        label="축의금"
        htmlFor={`${uid}-gift`}
        hint="불참이어도 받은 축의금은 그대로 적습니다. 합계에는 참석 여부와 무관하게 전부 들어갑니다."
      >
        <GiftInput id={`${uid}-gift`} value={draft.gift_amount} onChange={(v) => set('gift_amount', v)} />
      </Field>

      <Field label="답례 · 감사" htmlFor={`${uid}-thanks`} hint="답례품 발송 여부 등.">
        <input
          id={`${uid}-thanks`}
          className="gs-input"
          type="text"
          autoComplete="off"
          value={draft.thanks ?? ''}
          onChange={(e) => set('thanks', e.currentTarget.value || null)}
        />
      </Field>

      <Field label="메모" htmlFor={`${uid}-memo`}>
        <textarea
          id={`${uid}-memo`}
          className="gs-textarea"
          value={draft.memo ?? ''}
          onChange={(e) => set('memo', e.currentTarget.value || null)}
        />
      </Field>

      {confirming && (
        <Confirm
          message={`${guest.name} 을(를) 명단에서 지웁니다. 축의금·메모도 함께 사라지고 되돌릴 수 없습니다.`}
          onCancel={() => setConfirming(false)}
          onConfirm={onDelete}
          busy={busy}
        />
      )}
    </Sheet>
  )
}
