/**
 * Snackbar.tsx — 삭제 직후 뜨는 실행취소 막대.
 *
 * 왜 확인 모달이 아니라 실행취소인가.
 *   확인 모달은 지우는 사람마다 매번 두 번 누르게 만든다. 실수는 가끔인데 비용은 항상이다.
 *   실행취소는 반대로 평소엔 한 번만 누르고, 실수했을 때만 한 번 더 누른다.
 *   되살리기가 원래 id 로 다시 넣는 것이라 상대방 화면에서도 그대로 복구된다.
 *
 * 위치는 하단 네비게이션 위. 네비 높이(56px)와 안전영역을 더한 만큼 띄운다.
 */
import { useEffect, useState } from 'react'

export type SnackbarProps = {
  message: string
  actionLabel: string
  onAction: () => void
  onDismiss: () => void
  /** 이 시간이 지나면 저절로 사라진다. */
  durationMs?: number
}

export const Snackbar = ({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 6000,
}: SnackbarProps) => {
  const [left, setLeft] = useState(Math.ceil(durationMs / 1000))

  useEffect(() => {
    const tick = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000)
    const timer = setTimeout(onDismiss, durationMs)
    return () => {
      clearInterval(tick)
      clearTimeout(timer)
    }
  }, [durationMs, onDismiss])

  return (
    <div className="bd-snack" role="status">
      <span className="bd-snack__text">{message}</span>
      <button type="button" className="bd-snack__undo" onClick={onAction}>
        {actionLabel} <i>{left}</i>
      </button>
    </div>
  )
}
