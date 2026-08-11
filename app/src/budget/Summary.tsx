/**
 * Summary.tsx — 집계 표시. 계산은 전부 selectors.ts 가 하고 여기서는 그리기만 한다.
 *
 * 두 덩어리로 나눴다.
 *   TotalsStrip — 화면 위에 붙어 있는 한 줄(총 견적 / 실제 지출 / 차액).
 *                 목록을 한참 내려도 지금 얼마짜리 살림인지 보인다.
 *   TotalsCard  — 스크롤되는 상세(예상 최종, 결제 진행, 카테고리별 비중).
 *
 * 붙어 있는 줄에 상세까지 넣으면 폰 화면의 3분의 1을 상시 차지한다.
 * 그래서 붙는 건 숫자 세 개까지만이다.
 */
import { formatManwon, formatSignedWon, formatWon } from './money'
import { sharePercent } from './selectors'
import type { CategoryTotal, Totals } from './selectors'
import type { RealtimeState } from './useBudgetRealtime'

const diffTone = (diff: number): string =>
  diff > 0 ? 'bd-v bd-v--over' : diff < 0 ? 'bd-v bd-v--under' : 'bd-v'

export type TotalsStripProps = {
  totals: Totals
  live: RealtimeState
}

export const TotalsStrip = ({ totals, live }: TotalsStripProps) => {
  const paidPct = sharePercent(totals.paid, totals.projected)

  return (
    <div className="bd-strip">
      <div className="bd-strip__row">
        {/* 맨 위에는 총액이 아니라 "우리가 실제로 마련해야 하는 돈"을 둔다.
            총액 2천만원 중 대부분은 예식 당일 축의금으로 정산되는 홀 청구분이라,
            둘을 섞어 보면 필요한 현금을 크게 오해하게 된다. */}
        <div className="bd-strip__cell">
          <span className="bd-k">예식 전 낼 돈</span>
          <span className="bd-v">{formatWon(totals.ownCashRemaining)}</span>
        </div>
        <div className="bd-strip__cell">
          <span className="bd-k">축의금 충당</span>
          <span className="bd-v bd-v--gift">{formatWon(totals.giftMoney)}</span>
        </div>
        <div className="bd-strip__cell">
          <span className="bd-k">총액</span>
          <span className="bd-v">{formatWon(totals.projected)}</span>
        </div>
        <span
          className={`bd-live bd-live--${live}`}
          title={live === 'live' ? '실시간 연결됨' : live === 'connecting' ? '연결 중' : '연결 끊김'}
        >
          <i aria-hidden="true" />
          <span className="bd-sr">
            {live === 'live' ? '실시간 연결됨' : live === 'connecting' ? '연결 중' : '연결 끊김'}
          </span>
        </span>
      </div>
      <div className="bd-strip__bar" aria-hidden="true">
        <i style={{ width: `${paidPct}%` }} />
      </div>
    </div>
  )
}

export type TotalsCardProps = {
  totals: Totals
  categories: CategoryTotal[]
}

export const TotalsCard = ({ totals, categories }: TotalsCardProps) => {
  const paidPct = sharePercent(totals.paid, totals.projected)

  return (
    <section className="bd-card bd-sum" aria-label="예산 집계">
      <div className="bd-sum__head">
        <span className="bd-k">예상 최종 총액</span>
        <strong className="bd-sum__big">{formatWon(totals.projected)}</strong>
        <span className="bd-sum__man">{formatManwon(totals.projected)}</span>
        <p className="bd-sum__note">
          실제 지출이 적힌 항목은 실제로, 아직 안 적힌 항목은 견적으로 잡은 금액입니다.
          {totals.unpricedCount > 0 && (
            // 시드 데이터에는 '미정 — 견적 필요' 항목이 여럿 있다. 그 항목들은 0원으로
            // 더해지므로, 아무 말도 없으면 이 총액이 최종인 줄 알게 된다.
            <>
              {' '}
              <b>금액을 아직 안 적은 {totals.unpricedCount}건은 빠져 있습니다.</b>
            </>
          )}
        </p>
      </div>

      <div className="bd-sum__pay">
        <div className="bd-payrow">
          <span className="bd-dot bd-dot--paid" aria-hidden="true" />
          <span className="bd-payrow__k">결제 완료 {totals.paidCount}건</span>
          <span className="bd-payrow__v">{formatWon(totals.paid)}</span>
        </div>
        <div className="bd-payrow">
          <span className="bd-dot bd-dot--unpaid" aria-hidden="true" />
          <span className="bd-payrow__k">남은 결제 {totals.unpaidCount}건</span>
          <span className="bd-payrow__v">{formatWon(totals.unpaid)}</span>
        </div>
        <div className="bd-bar" role="img" aria-label={`결제 완료 ${paidPct}%`}>
          <i style={{ width: `${paidPct}%` }} />
        </div>
        <p className="bd-sum__note">전체의 {paidPct}% 를 냈습니다.</p>
      </div>

      <div className="bd-sum__diff">
        <span className="bd-k">견적 대비</span>
        {totals.diffCount === 0 ? (
          <p className="bd-sum__note">
            견적과 실제 지출이 모두 적힌 항목이 아직 없습니다. 결제한 항목에 실제 금액을 넣으면
            여기서 초과·절감이 계산됩니다.
          </p>
        ) : (
          <>
            <strong className={diffTone(totals.diff)}>
              {totals.diff === 0 ? '± 0원' : `${formatSignedWon(totals.diff)}원`}
              <span className="bd-sum__tag">
                {totals.diff > 0 ? '초과' : totals.diff < 0 ? '절감' : '일치'}
              </span>
            </strong>
            <p className="bd-sum__note">
              견적과 실제가 모두 적힌 {totals.diffCount}개 항목 기준
              {totals.diff !== 0 && ` · ${formatManwon(Math.abs(totals.diff))}`}
            </p>
          </>
        )}
      </div>

      {categories.length > 0 && (
        <div className="bd-cats">
          <span className="bd-k">카테고리별</span>
          <ul className="bd-cats__list">
            {categories.map((c) => {
              const pct = sharePercent(c.projected, totals.projected)
              return (
                <li key={c.category} className="bd-cat">
                  <div className="bd-cat__head">
                    <span className="bd-cat__name">{c.category}</span>
                    <span className="bd-cat__count">{c.count}건</span>
                    <span className="bd-cat__won">{formatWon(c.projected)}</span>
                    <span className="bd-cat__pct">{pct}%</span>
                  </div>
                  <div className="bd-bar bd-bar--thin" aria-hidden="true">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
