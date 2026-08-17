/**
 * HomeScreen.tsx — 홈 대시보드.
 *
 * 화면 구성 (위에서부터)
 *   1) D-day     — 두 줄짜리 배너
 *   2) 지금 할 일 — 지연·임박 목록. 진행률은 이 카드 하단 한 줄
 *   3) 예산      — 우리 현금 잔금 + 임박한 결제
 *   4) 하객      — 참석 인원 · 식사 인원 · 축의금
 *   5) 당일      — 본식 당일 화면으로 가는 입구
 *
 * 순서는 사용자 피드백으로 정해졌다. '지금 할 일'이 맨 위이고 진행률은 그 카드 아래
 * 한 줄이다. 카드를 늘릴 때 이 순서를 뒤집지 않는다.
 *
 * ── 세로 예산 ─────────────────────────────────────────────────
 * 첫 화면에서 스크롤 없이 D-day·할 일·예산·하객 머리 숫자까지 보여야 한다.
 * 하객 카드를 새로 넣으면서 세로가 빠듯해져 세 군데를 압축했다.
 *   · 카드 패딩 16 → 14, 카드 간격 13 → 10 (home.css)
 *   · 할 일 목록 지연 4건·임박 5건 → 각 3건 ('외 N건'은 그대로 표시)
 *   · 예산 카드의 항목을 늘리는 대신 한 줄짜리 결제 예정 행(.hm-pay)을 새로 만들었다
 * 카드를 더 넣어야 한다면 여기부터 다시 재야 한다.
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
import type { DueItem, PayDue } from './homeData'
import {
  summarizeBudget,
  summarizeGuests,
  summarizeTasks,
  useHomeBudgetQuery,
  useHomeGuestsQuery,
  useHomeTasksQuery,
} from './homeData'
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

/**
 * 결제 예정 한 줄. 할 일 목록(.hm-item)과 달리 두 줄이 아니라 한 줄이다.
 * 예산 카드에 목록이 하나 더 들어가면 하객 카드가 화면 밖으로 밀리기 때문이고,
 * 결제는 "언제 · 무엇 · 얼마" 세 조각이면 충분해서 한 줄에 담긴다.
 *
 * 축의금으로 정산할 건은 금액을 파란색으로 칠하고 '축의금' 꼬리표를 붙인다.
 * 위쪽 '축의금 정산 잔금' 줄과 같은 색이라 두 숫자가 같은 주머니임이 이어져 읽히고,
 * 무엇보다 머리 숫자(우리 현금)에 이 금액을 더해 오해하는 일을 막는다.
 */
const PayRow = ({ item }: { item: PayDue }) => (
  <li className="hm-pay">
    <span className={item.days < 0 ? 'hm-pay__when hm-pay__when--over' : 'hm-pay__when'}>
      {shortDate(item.due)}
    </span>
    <span className="hm-pay__what">
      {item.label}
      {item.funding === '축의금' && <em className="hm-pay__tag">축의금</em>}
    </span>
    <span className={item.funding === '축의금' ? 'hm-pay__amt hm-gift' : 'hm-pay__amt'}>
      {formatWon(item.amount)}
    </span>
  </li>
)

/** 1,234명 — 인원은 금액과 표기 규칙이 달라 따로 둔다. */
const heads = (n: number): string => `${n.toLocaleString('ko-KR')}명`

// ── 화면 ──────────────────────────────────────────────────────

export function HomeScreen(props: { onNavigate: (key: TabKey) => void }): ReactElement {
  const { onNavigate } = props

  // 자정이 지나면 스스로 갱신된다. D-day 와 '지연' 판정이 하루 밀리지 않는다.
  const today = useTodayKey()

  const tasksQuery = useHomeTasksQuery()
  const budgetQuery = useHomeBudgetQuery()
  const guestsQuery = useHomeGuestsQuery()

  const tasks = useMemo(
    () => (tasksQuery.data ? summarizeTasks(tasksQuery.data, today) : null),
    [tasksQuery.data, today],
  )
  const budget = useMemo(
    () => (budgetQuery.data ? summarizeBudget(budgetQuery.data, today) : null),
    [budgetQuery.data, today],
  )
  const guests = useMemo(
    () => (guestsQuery.data ? summarizeGuests(guestsQuery.data) : null),
    [guestsQuery.data],
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
        minHeight={150}
      >
        {tasksQuery.isPending && <Skeleton lines={3} />}
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
              <>
                <ul className="hm-list">
                  {tasks.upcoming.map((item) => (
                    <DueRow key={item.id} item={item} />
                  ))}
                </ul>
                {tasks.upcomingCount > tasks.upcoming.length && (
                  <p className="hm-more">외 {tasks.upcomingCount - tasks.upcoming.length}건</p>
                )}
              </>
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
          머리 숫자는 '우리 현금 잔금'이다. 계약 총액(2,400만 규모)을 머리에 올리지 않는 이유:
          그 대부분은 예식 당일 축의금으로 정산되는 홀 청구분이라, 총액을 보면 미리 마련해야 할
          현금을 몇 배로 오해하게 된다. 미지급 잔금 전체(축의금분 포함)도 같은 이유로 쓰지 않는다.
          축의금 주머니는 바로 아래 별도 줄에 따로 세운다 — 두 숫자는 절대 더하지 않는다.

          그 아래 결제 예정을 둔 것은 "얼마"보다 "언제"가 더 급한 정보이기 때문이다.
          잔금 총액은 1년 내내 거의 그대로지만 결제일은 다음 주에 돌아온다. */}
      <Card
        title="예산"
        to="budget"
        linkLabel="가계부 화면 열기"
        onNavigate={onNavigate}
        minHeight={104}
      >
        {budgetQuery.isPending && <Skeleton lines={2} />}
        {budgetQuery.isError && (
          <Failed error={budgetQuery.error} onRetry={() => void budgetQuery.refetch()} />
        )}
        {budget?.count === 0 && <p className="hm-empty">아직 등록된 항목이 없습니다.</p>}
        {budget && budget.count > 0 && (
          <>
            <p className="hm-statline">
              <span className="hm-stat hm-stat--won">{formatWon(budget.ownRemaining)}</span>
              <span className="hm-statline__side">우리 현금 잔금</span>
            </p>

            {budget.upcoming.length > 0 && (
              <div className="hm-sec">
                {/* 잘린 건수를 '외 N건' 줄로 따로 달지 않고 머리글에 총 건수를 적는다.
                    줄 하나(20px 남짓)를 아끼려는 것이기도 하지만, 원래 '결제 예정'이라는
                    머리글만으로는 몇 건이 남았는지 알 수 없었다. */}
                <p className="hm-sec__h">결제 예정 {budget.upcomingCount}건</p>
                <ul className="hm-list">
                  {budget.upcoming.map((item) => (
                    <PayRow key={item.id} item={item} />
                  ))}
                </ul>
              </div>
            )}

            <dl className="hm-kv">
              <dt>축의금 정산 잔금</dt>
              <dd className="hm-gift">{formatWon(budget.giftRemaining)}</dd>
            </dl>
            <p className="hm-foot">
              계약 {formatWon(budget.contracted)} · 결제 {formatWon(budget.paid)}
            </p>
          </>
        )}
      </Card>

      {/* ── 하객 ──
          머리 숫자는 '참석 확정 인원'이다. 명단 건수는 우리가 얼마나 적었는지일 뿐이고,
          예식 비용과 보증인원 통보(D-2주)를 좌우하는 건 실제로 오는 사람 수다.
          명단이 아직 0건인 기간이 길기 때문에 빈 상태에서 '0명'을 크게 띄우지 않는다.
          대신 이 카드가 무엇을 재는 카드인지 알 수 있게 보증인원·1인 식대를 보여준다. */}
      <Card
        title="하객"
        to="guests"
        linkLabel="하객 화면 열기"
        onNavigate={onNavigate}
        minHeight={46}
      >
        {guestsQuery.isPending && <Skeleton lines={1} />}
        {guestsQuery.isError && (
          <Failed error={guestsQuery.error} onRetry={() => void guestsQuery.refetch()} />
        )}
        {guests && guests.count === 0 && (
          <>
            <p className="hm-line">아직 명단이 비어 있습니다.</p>
            <p className="hm-foot">
              {guests.guarantee !== null ? `보증 ${heads(guests.guarantee)}` : '보증인원 미정'}
              {guests.mealUnitPrice !== null && ` · 1인 식대 ${formatWon(guests.mealUnitPrice)}`}
            </p>
          </>
        )}
        {guests && guests.count > 0 && (
          <>
            <p className="hm-statline">
              <span className="hm-stat">
                {guests.attendingHeads.toLocaleString('ko-KR')}
                <span className="hm-stat__unit">명</span>
              </span>
              <span className="hm-statline__side">참석 확정</span>
            </p>
            <dl className="hm-kv">
              <dt>축의금</dt>
              <dd className="hm-gift">{formatWon(guests.gift)}</dd>
            </dl>
            <p className="hm-foot">
              명단 {guests.count}건
              {guests.pendingCount > 0 && ` · 미정 ${guests.pendingCount}건`}
              {' · 식사 '}
              <span className={guests.overGuarantee ? 'hm-over' : undefined}>
                {guests.mealCount}
              </span>
              {guests.guarantee !== null ? ` / 보증 ${heads(guests.guarantee)}` : '명'}
            </p>
          </>
        )}
      </Card>

      {/* ── 당일 ── 예식까지 1년 넘게 남은 지금은 입구 역할이면 충분하다.
          첫 화면에서 유일하게 접혀도 되는 카드라 맨 아래에 둔다. */}
      <Card
        title="본식 당일"
        to="dayof"
        linkLabel="당일 화면 열기"
        onNavigate={onNavigate}
        minHeight={22}
      >
        <p className="hm-line">진행 순서 · 역할 분담 · 당일 준비물</p>
      </Card>
    </div>
  )
}
