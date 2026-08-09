/**
 * ui.tsx — 이 화면에서 두 번 이상 쓰이는 작은 조각들.
 */
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

export const Meter = ({
  label,
  progress,
  mini = false,
}: {
  label?: ReactNode
  progress: Progress
  mini?: boolean
}) => {
  const pct = Math.round(progress.ratio * 100)
  const complete = progress.total > 0 && progress.done === progress.total
  return (
    <div>
      {label !== undefined && (
        <div className="ck-meter__top">
          <b>{label}</b>
          <span>
            {progress.done}/{progress.total} · {pct}%
          </span>
        </div>
      )}
      <div
        className={mini ? 'ck-track ck-track--mini' : 'ck-track'}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-valuetext={`${progress.total}개 중 ${progress.done}개 완료`}
      >
        <div
          className={complete ? 'ck-fill ck-fill--done' : 'ck-fill'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** 필터 칩. aria-pressed 로 선택 상태를 표현한다(라디오가 아니라 토글 버튼 의미). */
export const Chip = ({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) => (
  <button type="button" className="ck-chip" aria-pressed={active} onClick={onClick}>
    <span>{children}</span>
    {count !== undefined && <span className="ck-chip__count">{count}</span>}
  </button>
)
