/**
 * HomeScreen.tsx — 홈 대시보드.
 *
 * 화면 구성
 *   1) D-day     — 루트 index.html 의 표지 카드를 그대로 승계했다.
 *   2) 진행률    — tasks 완료 비율 + 남은 일이 많은 카테고리
 *   3) 임박·지연 — 마감이 지난 미완료를 맨 위에 따로 세운다
 *   4) 예산      — budget_items 견적/실제 합계
 *   5) 당일      — 본식 당일 화면으로 가는 입구
 *
 * 카드 전체가 탭 영역이다. 다만 카드를 통째로 <button> 으로 감싸지는 않았다.
 * 버튼 안에 목록·정의목록을 넣으면 마크업이 깨지고, 스크린리더는 카드의 모든 숫자를
 * 버튼 이름 하나로 읽어버린다. 대신 카드 위에 투명한 버튼을 덮는다(hm-card__link).
 * 내용은 내용대로 읽히고, 이동 버튼은 "체크리스트 열기" 한 마디로 읽힌다.
 * 재시도처럼 카드 안에 진짜 버튼이 필요할 때는 z-index 로 덮개 위에 띄운다.
 */
import { useMemo } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { TabKey } from './AppShell'
import { CEREMONY, ceremonyLabel, daysToCeremony, formatDday, formatDue, shortDate, useTodayKey } from './dday'
import { formatWon, percent } from './format'
import { toMessage } from './homeApi'
import type { DueItem } from './homeData'
import { summarizeBudget, summarizeTasks, useHomeBudgetQuery, useHomeTasksQuery } from './homeData'
import './home.css'

// ── 공통 조각 ─────────────────────────────────────────────────

const Card = ({
  title,
  to,
  linkLabel,
  onNavigate,
  minHeight,
  children,
}: {
  title: string
  to: TabKey
  linkLabel: string
  onNavigate: (key: TabKey) => void
  minHeight: number
  children: ReactNode
}) => (
  <section className="hm-card">
    <h2 className="hm-card__title">
      {title}
      <span className="hm-chev" aria-hidden="true">
        ›
      </span>
    </h2>
    <div className="hm-card__body" style={{ minHeight }}>
      {children}
    </div>
    <button type="button" className="hm-card__link" onClick={() => onNavigate(to)}>
      <span className="hm-sr">{linkLabel}</span>
    </button>
  </section>
)

/** 로딩 자리표시자. 카드 본문에 minHeight 가 걸려 있어 완료 시 레이아웃이 튀지 않는다. */
const Skeleton = ({ lines = 3 }: { lines?: number }) => (
  <div className="hm-sk" aria-hidden="true">
    <div className="hm-sk__bar hm-sk__bar--stat" />
    {Array.from({ length: lines }, (_, i) => (
      <div key={i} className="hm-sk__bar" style={{ width: `${88 - i * 14}%` }} />
    ))}
  </div>
)

const Failed = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div className="hm-fail">
    <p className="hm-fail__msg">불러오지 못했습니다. {toMessage(error)}</p>
    <button type="button" className="hm-retry" onClick={onRetry}>
      다시 시도
    </button>
  </div>
)

const DueRow = ({ item }: { item: DueItem }) => (
  <li className="hm-item">
    <span className="hm-item__text">
      <span className="hm-item__title">{item.title}</span>
      <span className="hm-item__meta">
        {item.category} · {shortDate(item.due)}
      </span>
    </span>
    <span className={item.days < 0 ? 'hm-due hm-due--over' : item.days <= 7 ? 'hm-due hm-due--soon' : 'hm-due'}>
      {formatDue(item.days)}
    </span>
  </li>
)

// ── 화면 ──────────────────────────────────────────────────────

export function HomeScreen(props: { onNavigate: (key: TabKey) => void }): ReactElement {
  const { onNavigate } = props

  // 자정이 지나면 스스로 갱신된다. D-day 와 '지연' 판정이 하루 밀리지 않는다.
  const today = useTodayKey()

  const tasksQuery = useHomeTasksQuery()
  const budgetQuery = useHomeBudgetQuery()

  const tasks = useMemo(
    () => (tasksQuery.data ? summarizeTasks(tasksQuery.data, today) : null),
    [tasksQuery.data, today],
  )
  const budget = useMemo(
    () => (budgetQuery.data ? summarizeBudget(budgetQuery.data) : null),
    [budgetQuery.data],
  )

  const left = daysToCeremony(today)
  const ratio = tasks ? percent(tasks.done, tasks.total) : 0

  return (
    <div className="wrap hm">
      <h1 className="hm-sr">결혼 준비 홈</h1>

      {/* ── D-day 배너.
          예전에는 연월일·D-day·요일시각·장소를 네 줄로 쌓아 화면의 3분의 1을 썼다.
          매일 보는 화면에서 바뀌는 값은 D-day 하나뿐이라 나머지는 한 줄로 붙인다. ── */}
      <section className="hm-hero hm-hero--slim">
        <p className="hm-hero__n">{formatDday(left)}</p>
        <p className="hm-hero__l">
          {ceremonyLabel()} · {CEREMONY.place}
        </p>
      </section>

      {/* ── 지금 할 일 ──
          홈의 존재 이유다. 예전에는 진행률 카드가 먼저 나오고 할 일이 그 아래였는데,
          "1% 완료"는 알아도 할 일이 없고 "내일 마감"은 알면 오늘 움직이게 된다.
          진행률은 별도 카드를 없애고 이 카드 아래 한 줄로 붙였다.
          카테고리별 막대 12줄은 뺐다 — 어느 카테고리를 왜 보여주는지 기준이 없었고
          자리만 크게 먹었다. 카테고리별 현황은 체크리스트 화면에서 필터로 본다. */}
      <Card
        title="지금 할 일"
        to="checklist"
        linkLabel="체크리스트 화면 열기"
        onNavigate={onNavigate}
        minHeight={180}
      >
        {tasksQuery.isPending && <Skeleton lines={4} />}
        {tasksQuery.isError && (
          <Failed error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} />
        )}
        {tasks && (
          <>
            {tasks.overdueCount > 0 && (
              <div className="hm-sec hm-sec--over">
                <p className="hm-sec__h">마감 지남 {tasks.overdueCount}건</p>
                <ul className="hm-list">
                  {tasks.overdue.map((item) => (
                    <DueRow key={item.id} item={item} />
                  ))}
                </ul>
                {tasks.overdueCount > tasks.overdue.length && (
                  <p className="hm-more">외 {tasks.overdueCount - tasks.overdue.length}건</p>
                )}
              </div>
            )}

            {tasks.upcoming.length > 0 ? (
              <ul className="hm-list">
                {tasks.upcoming.map((item) => (
                  <DueRow key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              tasks.overdueCount === 0 && (
                <p className="hm-empty">마감일이 잡힌 미완료 항목이 없습니다.</p>
              )
            )}

            {tasks.total > 0 && (
              <div className="hm-progline">
                <div
                  className="hm-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={tasks.total}
                  aria-valuenow={tasks.done}
                  aria-valuetext={`${tasks.total}개 중 ${tasks.done}개 완료 (${ratio}%)`}
                >
                  <div
                    className={ratio >= 100 ? 'hm-bar__fill hm-bar__fill--done' : 'hm-bar__fill'}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                <span className="hm-progline__n">
                  {tasks.done}/{tasks.total} · {ratio}%
                  {tasks.noDue > 0 && ` · 기한 미정 ${tasks.noDue}건`}
                </span>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── 예산 ──
          총액이 아니라 자금 출처를 먼저 보여준다. 총 2천만원 중 대부분은 예식 당일
          축의금으로 정산되는 홀 청구분이라, 총액만 보면 미리 마련해야 할 현금을
          몇 배로 오해하게 된다. */}
      <Card
        title="예산"
        to="budget"
        linkLabel="가계부 화면 열기"
        onNavigate={onNavigate}
        minHeight={116}
      >
        {budgetQuery.isPending && <Skeleton lines={2} />}
        {budgetQuery.isError && (
          <Failed error={budgetQuery.error} onRetry={() => void budgetQuery.refetch()} />
        )}
        {budget?.count === 0 && <p className="hm-empty">아직 등록된 항목이 없습니다.</p>}
        {budget && budget.count > 0 && (
          <>
            <p className="hm-statline">
              <span className="hm-stat hm-stat--won">{formatWon(budget.ownCashRemaining)}</span>
              <span className="hm-statline__side">예식 전 낼 돈</span>
            </p>
            <dl className="hm-kv">
              <dt>축의금 충당</dt>
              <dd className="hm-gift">{formatWon(budget.giftMoney)}</dd>
              <dt>총액</dt>
              <dd>{formatWon(budget.estimate)}</dd>
            </dl>
          </>
        )}
      </Card>

      {/* ── 당일 ── 예식까지 1년 넘게 남은 지금은 입구 역할이면 충분하다. */}
      <Card
        title="본식 당일"
        to="dayof"
        linkLabel="당일 화면 열기"
        onNavigate={onNavigate}
        minHeight={28}
      >
        <p className="hm-line">진행 순서 · 역할 분담 · 당일 준비물</p>
      </Card>
    </div>
  )
}
