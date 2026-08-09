/**
 * ui.tsx — 이 화면에서 두 번 이상 쓰이는 작은 조각들.
 *
 * 터치 타겟은 전부 최소 44×44px 다(--dof-tap). 당일에는 정장·드레스 차림에
 * 손에 뭔가를 든 채로 한 손으로 누른다. 작은 버튼은 그날 못 누른다.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Progress } from './selectors'

export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M2.5 8.5 6 12l7.5-8"
      fill="none"
      stroke="var(--surface)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const PhoneIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="14" height="14">
    <path
      d="M3 2.5h2.2l1.1 2.7-1.4 1.1a8.4 8.4 0 0 0 3.8 3.8l1.1-1.4 2.7 1.1V12a1.5 1.5 0 0 1-1.6 1.5A11 11 0 0 1 2.5 4.1 1.5 1.5 0 0 1 3 2.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)

export const Meter = ({
  label,
  progress,
  mini = false,
  tone = 'default',
}: {
  label?: ReactNode
  progress: Progress
  mini?: boolean
  tone?: 'default' | 'good'
}) => {
  const pct = Math.round(progress.ratio * 100)
  const complete = progress.total > 0 && progress.done === progress.total
  return (
    <div>
      {label !== undefined && (
        <div className="dof-meter__top">
          <b>{label}</b>
          <span>
            {progress.done}/{progress.total} · {pct}%
          </span>
        </div>
      )}
      <div
        className={mini ? 'dof-track dof-track--mini' : 'dof-track'}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-valuetext={`${progress.total}개 중 ${progress.done}개 완료`}
      >
        <div
          className={complete || tone === 'good' ? 'dof-fill dof-fill--done' : 'dof-fill'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** 세그먼트 한 칸. aria-pressed 로 선택 상태를 표현한다. */
export const Chip = ({
  active,
  onClick,
  children,
  count,
  tone,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
  tone?: 'crit' | 'warn'
}) => (
  <button
    type="button"
    className="dof-chip"
    aria-pressed={active}
    data-tone={tone}
    onClick={onClick}
  >
    <span>{children}</span>
    {count !== undefined && <span className="dof-chip__count">{count}</span>}
  </button>
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
  <div className="dof-field">
    <label htmlFor={htmlFor}>{label}</label>
    {children}
    {hint !== undefined && <p className="dof-field__hint">{hint}</p>}
  </div>
)

/** 라디오 성격의 선택줄. 값 목록이 짧을 때만 쓴다(단계·구분·담당). */
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
  <div className="dof-segment" role="group" aria-label={label}>
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

/**
 * 하단 시트.
 *
 * 하단 고정 네비게이션(56px + safe-area)이 이 화면 밖에 깔려 있으므로 배경막의
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
    // 뺏으면 추가 시트를 열자마자 모바일 키보드가 내려간다.
    const panel = panelRef.current
    if (panel && !panel.contains(document.activeElement)) panel.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="dof-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        // 배경막을 직접 눌렀을 때만 닫는다. 시트 안에서 드래그하다 손을 떼도 닫히면 안 된다.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="dof-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="dof-sheet__head">
          <h2>{title}</h2>
          <button type="button" className="dof-btn dof-btn--quiet" onClick={onClose}>
            닫기
          </button>
        </div>
        {children}
        {footer !== undefined && <div className="dof-sheet__actions">{footer}</div>}
      </div>
    </div>
  )
}

/** 되돌리기 어려운 동작 앞에 한 단계를 둔다. 당일엔 오조작이 잦다. */
export const Confirm = ({
  message,
  onCancel,
  onConfirm,
  busy,
  confirmLabel = '삭제',
  danger = true,
}: {
  message: string
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
  confirmLabel?: string
  danger?: boolean
}) => (
  <div className={danger ? 'dof-confirm dof-confirm--danger' : 'dof-confirm'}>
    <p>{message}</p>
    <div className="dof-confirm__row">
      <button type="button" className="dof-btn" onClick={onCancel}>
        취소
      </button>
      <button
        type="button"
        className={danger ? 'dof-btn dof-btn--danger' : 'dof-btn dof-btn--primary'}
        onClick={onConfirm}
        disabled={busy}
      >
        {confirmLabel}
      </button>
    </div>
  </div>
)

export const LiveDot = ({ state }: { state: 'connecting' | 'live' | 'offline' }) => {
  const label = state === 'live' ? '실시간' : state === 'offline' ? '연결 끊김' : '연결 중'
  return (
    <span className="dof-live" data-state={state} title="Supabase Realtime 구독 상태">
      <span className="dof-live__dot" />
      {label}
    </span>
  )
}
