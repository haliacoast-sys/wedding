/**
 * ui.tsx — 이 화면에서 두 번 이상 쓰이는 작은 조각들.
 *
 * 터치 타겟은 전부 최소 44×44px(--gs-tap). 200명 명단을 폰에서 한 손으로 훑는다.
 * 입력은 전부 16px 이상 — iOS 사파리가 포커스할 때 화면을 확대하지 않게.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export const PhoneIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="15" height="15">
    <path
      d="M3 2.5h2.2l1.1 2.7-1.4 1.1a8.4 8.4 0 0 0 3.8 3.8l1.1-1.4 2.7 1.1V12a1.5 1.5 0 0 1-1.6 1.5A11 11 0 0 1 2.5 4.1 1.5 1.5 0 0 1 3 2.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)

export const SearchIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="15" height="15">
    <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

/** 세그먼트 한 칸. aria-pressed 로 선택 상태를 표현한다. */
export const Chip = ({
  active,
  onClick,
  children,
  count,
  tone,
  title,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
  tone?: 'good' | 'warn' | 'crit'
  title?: string
}) => (
  <button
    type="button"
    className="gs-chip"
    aria-pressed={active}
    data-tone={tone}
    title={title}
    onClick={onClick}
  >
    <span>{children}</span>
    {count !== undefined && <span className="gs-chip__count">{count}</span>}
  </button>
)

/** 라디오 성격의 선택줄. 값 목록이 짧을 때만 쓴다(측·참석·청첩장). */
export const Segment = <T extends string>({
  value,
  options,
  onChange,
  allowNull = false,
  nullLabel = '미지정',
  label,
}: {
  value: T | null
  options: readonly T[]
  onChange: (next: T | null) => void
  allowNull?: boolean
  nullLabel?: string
  label: string
}) => (
  <div className="gs-segment" role="group" aria-label={label}>
    {allowNull && (
      <Chip active={value === null} onClick={() => onChange(null)}>
        {nullLabel}
      </Chip>
    )}
    {options.map((option) => (
      <Chip key={option} active={value === option} onClick={() => onChange(option)}>
        {option}
      </Chip>
    ))}
  </div>
)

export const Field = ({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
}) => (
  <div className="gs-field">
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {hint !== undefined && <p className="gs-field__hint">{hint}</p>}
  </div>
)

/**
 * 인원 입력기. −/+ 버튼이 각각 44px 라 폰에서 확실하게 눌린다.
 *
 * 숫자 칸을 직접 칠 수도 있게 남겨 둔다(가족 8명을 +로 여덟 번 누르게 하면 안 된다).
 * type="number" 대신 inputMode="numeric" 을 쓰는 이유는 iOS 에서 스피너가
 * 44px 타겟을 잡아먹고, 빈 문자열 상태를 다루기가 번거롭기 때문이다.
 */
export const CountStepper = ({
  id,
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  id?: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  label: string
}) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="gs-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="gs-stepper__btn"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`${label} 1 줄이기`}
      >
        −
      </button>
      <input
        id={id}
        className="gs-stepper__input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const digits = e.currentTarget.value.replace(/\D+/g, '').slice(0, 2)
          onChange(digits === '' ? min : clamp(Number(digits)))
        }}
      />
      <button
        type="button"
        className="gs-stepper__btn"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`${label} 1 늘리기`}
      >
        +
      </button>
    </div>
  )
}

/**
 * 하단 시트.
 *
 * 하단 고정 네비게이션(약 58px + safe-area)이 이 화면 밖에 깔려 있으므로 배경막의
 * z-index 를 충분히 높여 그 위를 덮는다. 시트가 네비 아래에 깔리면 저장 버튼이
 * 가려져 아무것도 저장하지 못하게 된다.
 */
export const Sheet = ({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // autoFocus 가 걸린 입력이 이미 포커스를 가져갔다면 뺏지 않는다.
    // 뺏으면 시트를 열자마자 모바일 키보드가 내려간다.
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) panel.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="gs-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        // 배경막을 직접 눌렀을 때만 닫는다. 시트 안에서 드래그하다 손을 떼도 닫히면 안 된다.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="gs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="gs-sheet__head">
          <h2>{title}</h2>
          <button type="button" className="gs-btn gs-btn--quiet" onClick={onClose}>
            닫기
          </button>
        </div>
        {children}
        {footer !== undefined && <div className="gs-sheet__actions">{footer}</div>}
      </div>
    </div>
  )
}

/** 되돌리기 어려운 동작 앞에 한 단계를 둔다. */
export const Confirm = ({
  message,
  onCancel,
  onConfirm,
  busy,
  confirmLabel = '삭제',
}: {
  message: string
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
  confirmLabel?: string
}) => (
  <div className="gs-confirm">
    <p>{message}</p>
    <div className="gs-confirm__row">
      <button type="button" className="gs-btn" onClick={onCancel}>
        취소
      </button>
      <button type="button" className="gs-btn gs-btn--danger" onClick={onConfirm} disabled={busy}>
        {confirmLabel}
      </button>
    </div>
  </div>
)

export const LiveDot = ({ state }: { state: 'connecting' | 'live' | 'offline' }) => {
  const label = state === 'live' ? '실시간' : state === 'offline' ? '연결 끊김' : '연결 중'
  return (
    <span className="gs-live" data-state={state} title="Supabase Realtime 구독 상태">
      <span className="gs-live__dot" />
      {label}
    </span>
  )
}

/**
 * 비율 막대. 보증인원 대비 식사 인원, 청첩장 전달률에 쓴다.
 * ratio 가 1 을 넘을 수 있다(보증인원 초과). 넘친 부분은 다른 색으로 잘라 보여 준다.
 */
export const Bar = ({
  ratio,
  tone = 'default',
  overflow = 0,
  label,
}: {
  ratio: number
  tone?: 'default' | 'good' | 'warn' | 'crit'
  /** 1 을 넘은 비율(전체 폭 대비). 0 이면 안 그린다. */
  overflow?: number
  label: string
}) => {
  const pct = Math.min(100, Math.max(0, ratio * 100))
  const over = Math.min(100, Math.max(0, overflow * 100))
  return (
    <div className="gs-track" role="img" aria-label={label} data-tone={tone}>
      <div className="gs-fill" style={{ width: `${pct}%` }} />
      {over > 0 && <div className="gs-fill gs-fill--over" style={{ width: `${over}%` }} />}
    </div>
  )
}
