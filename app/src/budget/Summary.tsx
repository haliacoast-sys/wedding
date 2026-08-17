/**
 * Summary.tsx — 집계 표시. 계산은 전부 selectors.ts 가 하고 여기서는 그리기만 한다.
 *
 * 세 덩어리다.
 *   TotalsStrip — 화면 위에 붙어 있는 한 줄. 탭하면 아래 상세가 펼쳐진다.
 *   DueBanner   — 결제일이 지났거나 코앞인 항목이 있을 때만 뜨는 한 줄. 탭하면 그것만 걸러 본다.
 *   TotalsPanel — 펼쳤을 때만 그리는 상세(계약·실지출·자금 출처·예산 대비·카테고리).
 *
 * 붙는 줄에 숫자를 몇 개 올릴지가 이 화면의 전부다. 폰에서 첫 화면에 실제 항목이
 * 보이지 않으면 가계부로 쓸 수 없으므로, 붙는 것은 숫자 셋 + 진행 막대까지다.
 *
 * 왜 이 셋인가.
 *   ① 미지급 잔금 합계 = 앞으로 낼 돈. 계약은 끝났고 아직 안 낸 돈이라 확정된 빚이다.
 *      총액(계약 총액)은 이미 낸 돈까지 포함하므로 '지금 뭘 해야 하나'에 답하지 못한다.
 *   ② 그중 선지출 = 예식 전에 우리 현금으로 나갈 돈. 실제로 통장에 있어야 하는 금액.
 *   ③ 그중 축의금 = 예식 당일 축의금으로 정산할 돈. ②와 섞으면 필요한 현금을 크게
 *      오해한다(총 2,400만원 중 상당액이 축의금 정산분이다).
 *   계약 총액·실지출은 '지금 결정에 쓰이는 숫자'가 아니라 '확인용'이라 상세로 내렸다.
 */
import { formatManwon, formatSignedWon, formatWon } from './money'
import { DUE_SOON_DAYS, sharePercent } from './selectors'
import type { CategoryTotal, Totals } from './selectors'
import { ddayLabel } from './dates'
import type { RealtimeState } from './useBudgetRealtime'

const liveText = (live: RealtimeState): string =>
  live === 'live' ? '실시간 연결됨' : live === 'connecting' ? '연결 중' : '연결 끊김'

const gapTone = (gap: number): string =>
  gap > 0 ? 'bd-v bd-v--over' : gap < 0 ? 'bd-v bd-v--under' : 'bd-v'

// ── 붙어 있는 줄 ─────────────────────────────────────────────

export type TotalsStripProps = {
  totals: Totals
  live: RealtimeState
  open: boolean
  onToggle: () => void
}

export const TotalsStrip = ({ totals, live, open, onToggle }: TotalsStripProps) => {
  // 진행률은 '계약한 돈 중 얼마를 냈나'다. 계약 총액이 0이면 막대를 그리지 않는다.
  const paidPct = sharePercent(totals.paidTotal, totals.paidTotal + totals.unpaidTotal)

  return (
    <div className="bd-strip">
      <button type="button" className="bd-strip__row" aria-expanded={open} onClick={onToggle}>
        <span className="bd-strip__cell">
          <span className="bd-k">앞으로 낼 돈</span>
          <span className="bd-v bd-v--lead">{formatWon(totals.unpaidTotal)}</span>
        </span>
        <span className="bd-strip__cell">
          <span className="bd-k">우리 돈</span>
          <span className="bd-v">{formatWon(totals.own.unpaid)}</span>
        </span>
        <span className="bd-strip__cell">
          <span className="bd-k">축의금 정산</span>
          <span className="bd-v bd-v--gift">{formatWon(totals.gift.unpaid)}</span>
        </span>
        <span className={`bd-live bd-live--${live}`} title={liveText(live)}>
          <i aria-hidden="true" />
          <span className="bd-sr">{liveText(live)}</span>
        </span>
        <span className={open ? 'bd-chev bd-chev--open' : 'bd-chev'} aria-hidden="true" />
        <span className="bd-sr">{open ? '집계 상세 닫기' : '집계 상세 열기'}</span>
      </button>
      <div
        className="bd-strip__bar"
        role="img"
        aria-label={`계약금액의 ${paidPct}% 를 냈습니다`}
      >
        <i style={{ width: `${paidPct}%` }} />
      </div>
    </div>
  )
}

// ── 결제일 알림 줄 ───────────────────────────────────────────

export type DueBannerProps = {
  totals: Totals
  active: boolean
  onToggle: () => void
}

/**
 * 돈이 언제 나가는지가 이 화면의 핵심이다. 그래서 예정일이 걸린 항목은
 * 목록을 뒤지지 않아도 위에서 바로 보이게 한다. 없으면 아예 그리지 않는다 —
 * 항상 자리를 차지하는 안내는 며칠 만에 배경이 된다.
 */
export const DueBanner = ({ totals, active, onToggle }: DueBannerProps) => {
  const count = totals.overdueCount + totals.dueSoonCount
  if (count === 0) return null

  const amount = totals.overdueAmount + totals.dueSoonAmount
  const late = totals.overdueCount > 0

  return (
    <button
      type="button"
      className={late ? 'bd-duebar bd-duebar--late' : 'bd-duebar'}
      aria-pressed={active}
      onClick={onToggle}
    >
      <span className="bd-duebar__dot" aria-hidden="true" />
      <span className="bd-duebar__k">
        {late ? `납부일 지남 ${totals.overdueCount}건` : `${DUE_SOON_DAYS}일 안에 낼 돈 ${count}건`}
        {late && totals.dueSoonCount > 0 && ` · 곧 ${totals.dueSoonCount}건`}
      </span>
      <span className="bd-duebar__v">{formatWon(amount)}</span>
      {totals.nextDueInDays != null && (
        <span className="bd-duebar__d">{ddayLabel(totals.nextDueInDays)}</span>
      )}
    </button>
  )
}

// ── 펼친 상세 ────────────────────────────────────────────────

export type TotalsPanelProps = {
  totals: Totals
  categories: CategoryTotal[]
  /** 항목에 연결되지 않은 결제 건수. 합계에서 새는 돈이라 여기서 알려 준다. */
  orphanCount: number
  orphanAmount: number
}

export const TotalsPanel = ({
  totals,
  categories,
  orphanCount,
  orphanAmount,
}: TotalsPanelProps) => (
  <section className="bd-card bd-sum" aria-label="예산 집계 상세">
    <div className="bd-tri">
      <div className="bd-tri__cell">
        <span className="bd-k">계약 총액</span>
        <strong className="bd-v bd-v--md">{formatWon(totals.contractedTotal)}</strong>
        <span className="bd-sum__sub">{totals.contractedCount}건 확정</span>
      </div>
      <div className="bd-tri__cell">
        <span className="bd-k">실지출</span>
        <strong className="bd-v bd-v--md">{formatWon(totals.paidTotal)}</strong>
        <span className="bd-sum__sub">결제 {totals.paymentCount}건</span>
      </div>
      <div className="bd-tri__cell">
        <span className="bd-k">미지급 잔금</span>
        <strong className="bd-v bd-v--md bd-v--lead">{formatWon(totals.unpaidTotal)}</strong>
        <span className="bd-sum__sub">{totals.unpaidCount}건 남음</span>
      </div>
    </div>

    {/* 자금 출처 — 이 표를 한 줄로 합치면 안 된다. 축의금 정산분과 우리 현금은
        나가는 시점도 재원도 다르다. 섞어 놓은 총액은 어떤 판단에도 못 쓴다. */}
    <div className="bd-fund">
      <span className="bd-k">자금 출처</span>
      <table className="bd-ftable">
        <thead>
          <tr>
            <th scope="col">구분</th>
            <th scope="col">계약</th>
            <th scope="col">낸 돈</th>
            <th scope="col">남은 잔금</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              선지출<i>예식 전 우리 현금</i>
            </th>
            <td>{formatWon(totals.own.contracted)}</td>
            <td>{formatWon(totals.own.paid)}</td>
            <td className="bd-ftable__lead">{formatWon(totals.own.unpaid)}</td>
          </tr>
          <tr>
            <th scope="row">
              축의금<i>예식 당일 정산</i>
            </th>
            <td>{formatWon(totals.gift.contracted)}</td>
            <td>{formatWon(totals.gift.paid)}</td>
            <td className="bd-ftable__gift">{formatWon(totals.gift.unpaid)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div className="bd-sum__diff">
      <span className="bd-k">예산 대비 계약</span>
      {totals.gapCount === 0 ? (
        <p className="bd-sum__note">
          예산과 계약금액이 모두 적힌 항목이 아직 없습니다. 계약금액을 넣으면 여기서 초과·절감이
          계산됩니다.
        </p>
      ) : (
        <>
          <strong className={gapTone(totals.gap)}>
            {totals.gap === 0 ? '± 0원' : `${formatSignedWon(totals.gap)}원`}
            <span className="bd-sum__tag">
              {totals.gap > 0 ? '초과' : totals.gap < 0 ? '절감' : '일치'}
            </span>
          </strong>
          <p className="bd-sum__note">
            예산과 계약금액이 모두 적힌 {totals.gapCount}개 항목 기준
            {totals.gap !== 0 && ` · ${formatManwon(Math.abs(totals.gap))}`}
          </p>
        </>
      )}
    </div>

    {/* 합계를 믿어도 되는지 알려 주는 단서들. 빠진 게 있으면 총액은 늘 작아 보인다. */}
    <ul className="bd-caveats">
      {totals.openCount > 0 && (
        <li>
          아직 계약금액이 없는 <b>{totals.openCount}건</b>은 예산{' '}
          {formatWon(totals.openEstimate)}원으로 잡혀 있습니다. 계약이 확정되면 계약 총액에
          더해집니다.
        </li>
      )}
      {totals.unpricedCount > 0 && (
        <li>
          금액을 아직 안 적은 <b>{totals.unpricedCount}건</b>은 0원으로 세고 있습니다.
        </li>
      )}
      {totals.overpaidTotal > 0 && (
        <li>
          계약금액보다 <b>{formatWon(totals.overpaidTotal)}원</b> 더 냈습니다. 계약금액이 낡았거나
          추가금이 있었는지 확인해 주세요.
        </li>
      )}
      {totals.cancelledCount > 0 && (
        <li>취소된 {totals.cancelledCount}건은 모든 합계에서 빠져 있습니다.</li>
      )}
      {orphanCount > 0 && (
        <li>
          항목과 연결이 끊긴 결제가 <b>{orphanCount}건</b> ({formatWon(orphanAmount)}원) 있습니다.
          항목을 지울 때 남은 기록이며 위 실지출에는 들어가지 않습니다.
        </li>
      )}
    </ul>

    {categories.length > 0 && (
      <div className="bd-cats">
        <span className="bd-k">카테고리별</span>
        <ul className="bd-cats__list">
          {categories.map((c) => {
            const pct = sharePercent(c.weight, totals.contractedTotal + totals.openEstimate)
            return (
              <li key={c.category} className="bd-cat">
                <div className="bd-cat__head">
                  <span className="bd-cat__name">{c.category}</span>
                  <span className="bd-cat__count">{c.count}건</span>
                  <span className="bd-cat__won">{formatWon(c.weight)}</span>
                  <span className="bd-cat__pct">{pct}%</span>
                </div>
                <div className="bd-bar bd-bar--thin" aria-hidden="true">
                  <i style={{ width: `${pct}%` }} />
                </div>
                {c.unpaid > 0 && (
                  <span className="bd-cat__unpaid">잔금 {formatWon(c.unpaid)}원</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )}
  </section>
)
