/**
 * TaskRow.tsx — 항목 한 줄.
 *
 * 체크박스와 본문을 별도의 버튼으로 나눈다. 한 덩어리로 묶으면 체크하려다
 * 편집창이 열리는 오작동이 난다. 둘 다 최소 44px 를 확보한다.
 */
import { dueBadgeLabel, dueToneOf } from './dates'
import { STATUS_LABEL } from './types'
import type { Task } from './types'
import { CheckIcon } from './ui'

export const TaskRow = ({
  task,
  today,
  onToggle,
  onOpen,
}: {
  task: Task
  today: string
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
}) => {
  const isDone = task.status === 'done'
  const tone = dueToneOf(task.due_date, isDone, today)
  const showDueBadge = task.due_date !== null || tone === 'overdue'

  return (
    <li className="ck-item" data-tone={tone}>
      <button
        type="button"
        className="ck-check"
        role="checkbox"
        aria-checked={isDone}
        aria-label={`${task.title} ${isDone ? '완료 해제' : '완료 표시'}`}
        onClick={() => onToggle(task)}
      >
        <span className="ck-check__box">
          <CheckIcon />
        </span>
      </button>

      <button type="button" className="ck-item__body" onClick={() => onOpen(task)}>
        <span className="ck-item__title">{task.title}</span>
        <span className="ck-item__meta">
          {showDueBadge && (
            <span className="ck-badge" data-tone={tone}>
              {dueBadgeLabel(task.due_date, tone, today)}
            </span>
          )}
          {task.assignee && (
            <span className="ck-badge ck-badge--assignee">{task.assignee}</span>
          )}
          {(task.status === 'doing' || task.status === 'hold') && (
            <span className="ck-badge">{STATUS_LABEL[task.status]}</span>
          )}
        </span>
        {task.note && <span className="ck-item__note">{task.note}</span>}
      </button>
    </li>
  )
}
