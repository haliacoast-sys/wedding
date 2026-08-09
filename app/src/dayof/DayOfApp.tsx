/**
 * DayOfApp.tsx — 본식 당일 화면의 유일한 진입점.
 *
 * 통합 담당은 이렇게만 부른다:
 *   <DayOfApp />
 *
 * props 가 없다. 인증은 상위 AuthGate 가, QueryClientProvider 도 상위가 맡는다는 전제다.
 * 이 컴포넌트는 세션을 스스로 조회하지 않는다.
 *
 * ── 데이터 흐름 요약 ────────────────────────────────────────
 *   조회는 여기서 한 번만 한다(쿼리 4개). 각 섹션은 받은 배열로 자기 계산만 한다.
 *   섹션을 오갈 때 쿼리를 새로 만들지 않으므로 탭 전환에 깜빡임이 없다 —
 *   당일 현장에서 진행표와 준비물을 수십 번 오간다.
 *
 *   Realtime 구독도 여기 한 곳에서만 건다. 섹션마다 걸면 채널이 3개 생기고
 *   같은 이벤트를 세 번 처리하게 된다.
 *
 * ── 하단 여백 ───────────────────────────────────────────────
 *   앱 셸이 하단 고정 네비게이션(56px + safe-area)을 깐다. 그래서 이 화면은
 *   하단에 그만큼 여백을 두고, 스스로는 하단 고정 요소를 만들지 않는다.
 *   (쓰기 실패 토스트도 상단에 띄운다 — StateViews.WriteToast 참조)
 */
import { useState } from 'react'
import './dayof.css'
import { ItemsSection } from './ItemsSection'
import { RolesSection } from './RolesSection'
import { ScheduleSection } from './ScheduleSection'
import type { ProbeState } from './StateViews'
import type { SectionId } from './types'
import {
  useConfigQuery,
  useItemsQuery,
  useMembershipProbe,
  useRolesQuery,
  useScheduleQuery,
} from './useDayOf'
import { useDayOfRealtime } from './useDayOfRealtime'
import { LiveDot } from './ui'
import { dateLabel, hhmm } from './format'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'schedule', label: '진행표' },
  { id: 'roles', label: '역할 분담' },
  { id: 'items', label: '당일 준비물' },
]

export const DayOfApp = () => {
  const [section, setSection] = useState<SectionId>('schedule')

  const configQuery = useConfigQuery()
  const scheduleQuery = useScheduleQuery()
  const rolesQuery = useRolesQuery()
  const itemsQuery = useItemsQuery()
  const realtime = useDayOfRealtime()

  const config = configQuery.data ?? null
  const schedule = scheduleQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const items = itemsQuery.data ?? []

  /**
   * 세 목록 중 하나라도 0행인데 에러가 없으면 권한을 캐묻는다.
   * 셋 다 같은 RLS 정책(is_member())을 쓰므로 한 번만 물으면 된다.
   * 항상 켜두면 정상 상태에서도 매번 rpc 를 한 번씩 더 부르게 된다.
   */
  const anyZeroRows =
    (scheduleQuery.isSuccess && schedule.length === 0) ||
    (rolesQuery.isSuccess && roles.length === 0) ||
    (itemsQuery.isSuccess && items.length === 0)
  const membership = useMembershipProbe(anyZeroRows)

  const probe: ProbeState = membership.isPending
    ? 'checking'
    : membership.isError
      ? 'unknown'
      : membership.data === true
        ? 'member'
        : membership.data === false
          ? 'not-member'
          : 'checking'

  const onProbeRetry = () => {
    void membership.refetch()
    void scheduleQuery.refetch()
    void rolesQuery.refetch()
    void itemsQuery.refetch()
  }

  const ceremonyTime = hhmm(config?.ceremony_at)
  const ceremonyDate = dateLabel(config?.ceremony_at)

  return (
    <div className="dof-app">
      <header className="dof-hero">
        <div className="dof-hero__row">
          <div>
            <div className="dof-hero__eyebrow">Wedding Day</div>
            <h1 className="dof-hero__title">본식 당일</h1>
          </div>
          <LiveDot state={realtime} />
        </div>
        <div className="dof-hero__when">
          <b>{ceremonyTime ?? '--:--'}</b>
          <span>{ceremonyDate ?? '기준 시각 미설정'}</span>
        </div>
      </header>

      <div className="dof-sticky">
        <div className="dof-chiprow" role="tablist" aria-label="화면 전환">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              className="dof-chip"
              aria-selected={s.id === section}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'schedule' && (
        <ScheduleSection
          config={config}
          configPending={configQuery.isPending}
          rows={schedule}
          roles={roles}
          isPending={scheduleQuery.isPending}
          isError={scheduleQuery.isError}
          error={scheduleQuery.error}
          onRetry={() => {
            void scheduleQuery.refetch()
            void configQuery.refetch()
          }}
          probe={probe}
          probeError={membership.error}
          onProbeRetry={onProbeRetry}
        />
      )}

      {section === 'roles' && (
        <RolesSection
          roles={roles}
          isPending={rolesQuery.isPending}
          isError={rolesQuery.isError}
          error={rolesQuery.error}
          onRetry={() => void rolesQuery.refetch()}
          probe={probe}
          probeError={membership.error}
          onProbeRetry={onProbeRetry}
        />
      )}

      {section === 'items' && (
        <ItemsSection
          items={items}
          isPending={itemsQuery.isPending}
          isError={itemsQuery.isError}
          error={itemsQuery.error}
          onRetry={() => void itemsQuery.refetch()}
          probe={probe}
          probeError={membership.error}
          onProbeRetry={onProbeRetry}
        />
      )}

      <footer className="dof-footnote">
        진행표의 각 항목은 절대 시각이 아니라 <b>예식 시작 기준 상대 분</b>으로 저장됩니다.
        예식 시간이 바뀌면 진행표 맨 위 <b>기준 시각</b> 하나만 고치면 전체가 따라 움직입니다.
        체크 상태는 두 사람의 화면에 실시간으로 공유됩니다.
      </footer>
    </div>
  )
}

export default DayOfApp
