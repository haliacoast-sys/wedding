/**
 * Summary.tsx — 엑셀 <하객> 시트가 보여주던 집계.
 *
 * ★ 이 카드는 언제나 '전체 명단' 기준이다. 필터를 걸어도 숫자가 변하지 않는다.
 *   필터에 따라 축의금 합계가 흔들리면 "지금 보이는 부분합"과 "전체 합"을 구분할 수
 *   없게 되고, 그 상태로 보증인원을 통보하면 그날 현장에서 돈이 틀어진다.
 *   지금 걸린 필터의 부분합은 목록 머리(GuestsApp)에서 따로 보여 준다.
 *
 * 계산식은 selectors.ts 에 있고 여기서는 그리기만 한다.
 *   참석 인원  = Σ head_count  (attending = 참석)
 *   식사 인원  = Σ meal_count  (attending = 참석)   ← 보증인원과 비교하는 값
 *   축의금     = Σ gift_amount (참석 여부 무관)
 *   예상 식대  = 식사 인원 × 1인 식대
 *   수지       = 축의금 − 예상 식대
 *   실제 청구  = max(식사 인원, 보증인원) × 1인 식대
 */
import { INVITE_LEAD_DAYS, inviteCounts, mealMath, totalsBySide, totalsOf } from './selectors'
import { SIDES } from './types'
import type { DayOfConfig, Guest } from './types'
import { FALLBACK_GUARANTEE, FALLBACK_MEAL_UNIT_PRICE } from './types'
import { dateLabel, daysUntil, manwon, people, shiftDays, signedWon, won, wonPlain } from './format'
import { Bar } from './ui'

/** 보증인원 통보 시한. 엑셀·마이그레이션 주석이 잡아 둔 D-2주. */
const GUARANTEE_NOTICE_DAYS = 14

export const Summary = ({
  rows,
  config,
  onFilterUninvited,
  onFilterUndecided,
}: {
  rows: Guest[]
  config: DayOfConfig | null
  onFilterUninvited: () => void
  onFilterUndecided: () => void
}) => {
  const all = totalsOf(rows)
  const bySide = totalsBySide(rows, SIDES)
  const invites = inviteCounts(rows)

  /**
   * 보증인원은 guarantee_count 가 정답이지만, 아직 계약 전이라 그 칸이 비어 있고
   * expected_guests(예상 하객수)만 채워진 상태가 있다. 홈 화면 카드도 같은 순서로
   * 읽는다(shell/homeApi.ts). 두 화면이 다른 숫자를 말하면 안 되므로 순서를 맞춘다.
   */
  const guarantee = config?.guarantee_count ?? config?.expected_guests ?? null
  const unitPriceIsFallback = config?.meal_unit_price == null
  const guaranteeIsFallback = guarantee === null
  const math = mealMath({
    mealCount: all.mealCount,
    potentialMealCount: all.mealCount + all.pendingMealCount,
    gift: all.gift,
    unitPrice: config?.meal_unit_price ?? FALLBACK_MEAL_UNIT_PRICE,
    guarantee: guarantee ?? FALLBACK_GUARANTEE,
    unitPriceIsFallback,
    guaranteeIsFallback,
  })

  const sendFrom = shiftDays(config?.ceremony_at, -INVITE_LEAD_DAYS)
  const daysToSend = daysUntil(sendFrom)
  const daysToNotice = daysUntil(shiftDays(config?.ceremony_at, -GUARANTEE_NOTICE_DAYS))

  return (
    <>
      {/* ── 수지: 이 화면이 존재하는 이유 ──────────────────── */}
      <section className="gs-card gs-net" aria-label="축의금과 식대">
        <div className="gs-net__head">
          <span className="gs-eyebrow">축의금 − 예상 식대</span>
          <span className="gs-net__basis">전체 명단 기준</span>
        </div>
        <b className="gs-net__amount" data-tone={math.net >= 0 ? 'good' : 'crit'}>
          {signedWon(math.net)}
        </b>
        <p className="gs-net__manwon">{manwon(math.net)}</p>

        <div className="gs-net__split">
          <div>
            <span>축의금 합계</span>
            <b>{won(all.gift)}</b>
            <i>
              {all.giftFilled}건 기입 / 명단 {all.count}건
            </i>
          </div>
          <div>
            <span>예상 식대</span>
            <b>{won(math.mealCost)}</b>
            <i>
              식사 {people(math.mealCount)} × {wonPlain(math.unitPrice)}원
            </i>
          </div>
        </div>

        {all.gift === 0 && all.count > 0 && (
          <p className="gs-hint">
            아직 축의금이 한 건도 적히지 않았습니다. 예식 후에 채워도 되지만, 미리 적어 두면
            이 숫자가 곧 <b>예식 비용의 주 재원</b>이 됩니다.
          </p>
        )}
        {(unitPriceIsFallback || guaranteeIsFallback) && (
          <p className="gs-hint gs-hint--warn">
            {unitPriceIsFallback && (
              <>
                1인 식대가 DB(<code>day_of_config.meal_unit_price</code>)에 없어 기본값{' '}
                {wonPlain(FALLBACK_MEAL_UNIT_PRICE)}원으로 계산했습니다.{' '}
              </>
            )}
            {guaranteeIsFallback && (
              <>
                보증인원이 없어 기본값 {FALLBACK_GUARANTEE}명으로 계산했습니다.{' '}
              </>
            )}
            실제 계약서 값과 다르면 아래 숫자가 전부 틀어집니다.
          </p>
        )}
      </section>

      {/* ── 보증인원 대비 ──────────────────────────────────── */}
      <section className="gs-card" aria-label="보증인원 대비 식사 인원">
        <div className="gs-rowhead">
          <span className="gs-eyebrow">보증인원 대비 식사 인원</span>
          <span className="gs-rowhead__value">
            <b>{math.mealCount}</b> / {math.guarantee}명
          </span>
        </div>

        <Bar
          ratio={math.guarantee === 0 ? 0 : Math.min(1, math.mealCount / math.guarantee)}
          overflow={
            math.guarantee === 0 || math.overBy === 0
              ? 0
              : Math.min(0.4, math.overBy / math.guarantee)
          }
          tone={math.overBy > 0 ? 'crit' : math.shortBy > 0 ? 'warn' : 'good'}
          label={`보증인원 ${math.guarantee}명 중 식사 인원 ${math.mealCount}명`}
        />

        {/* 초과와 미달은 둘 다 돈이 새는 방향이다. 어느 쪽인지 말로 못 박는다. */}
        {math.overBy > 0 && (
          <div className="gs-callout gs-callout--crit">
            <b>보증인원을 {math.overBy}명 초과했습니다.</b> 초과분은 예식 당일 추가로 정산합니다.
            지금 기준 추가 예상액 <b>{won(math.overCost)}</b>. 실제 청구 예상액은{' '}
            {won(math.billedCost)}({math.billedCount}명분)입니다.
          </div>
        )}
        {math.shortBy > 0 && (
          <div className="gs-callout gs-callout--warn">
            <b>보증인원에 {math.shortBy}명 모자랍니다.</b> 덜 와도 보증한 {math.guarantee}명분{' '}
            <b>{won(math.billedCost)}</b> 은 그대로 냅니다. 지금대로면 안 온 자리에{' '}
            <b>{won(math.shortCost)}</b> 을 내는 셈입니다. 이 기준 수지는{' '}
            {signedWon(math.netBilled)} 입니다.
          </div>
        )}
        {math.overBy === 0 && math.shortBy === 0 && math.mealCount > 0 && (
          <div className="gs-callout">
            식사 인원이 보증인원과 정확히 같습니다. 추가 정산도 낭비도 없습니다.
          </div>
        )}

        {all.undecidedCount > 0 && (
          <button type="button" className="gs-inlinebtn" onClick={onFilterUndecided}>
            <span>
              <b>미정 {all.undecidedCount}건</b> 이 전부 참석하면 식사 인원{' '}
              {math.potentialMealCount}명 (
              {math.potentialMealCount > math.guarantee
                ? `보증 ${math.potentialMealCount - math.guarantee}명 초과`
                : `보증까지 ${math.guarantee - math.potentialMealCount}명 남음`}
              )
            </span>
            <span className="gs-inlinebtn__go">미정만 보기 →</span>
          </button>
        )}

        {daysToNotice !== null && (
          <p className="gs-hint">
            보증인원 통보는 예식 2주 전까지입니다
            {daysToNotice >= 0 ? ` (D-${daysToNotice})` : ' (기한 지남)'}. 그 전까지 미정을 최대한
            줄여야 이 숫자가 의미를 갖습니다.
          </p>
        )}
      </section>

      {/* ── 측별 집계 ──────────────────────────────────────── */}
      <section className="gs-card" aria-label="측별 집계">
        <span className="gs-eyebrow">측별 집계</span>
        {/* 표가 화면보다 넓다. body 를 가로로 흔들지 않도록 이 안에서만 스크롤한다. */}
        <div className="gs-tablewrap">
          <table className="gs-table">
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col">명단</th>
                <th scope="col">참석</th>
                <th scope="col">참석 인원</th>
                <th scope="col">식사 인원</th>
                <th scope="col">축의금</th>
              </tr>
            </thead>
            <tbody>
              {bySide.map(({ side, totals }) => (
                <tr key={side}>
                  <th scope="row">{side}</th>
                  <td>{totals.count}</td>
                  <td>{totals.attendingCount}</td>
                  <td>{totals.headCount}</td>
                  <td>{totals.mealCount}</td>
                  <td>{wonPlain(totals.gift)}</td>
                </tr>
              ))}
              <tr className="gs-table__sum">
                <th scope="row">합계</th>
                <td>{all.count}</td>
                <td>{all.attendingCount}</td>
                <td>{all.headCount}</td>
                <td>{all.mealCount}</td>
                <td>{wonPlain(all.gift)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="gs-hint">
          <b>명단·참석</b>은 줄 수(건)이고 <b>참석 인원·식사 인원</b>은 사람 수(명)입니다. 한 줄에
          가족 4명을 적을 수 있어서 두 숫자가 다릅니다. <b>참석 인원과 식사 인원도 다릅니다</b> —
          아이가 함께 와도 식대는 안 나갈 수 있고, 식장에 내는 돈은 식사 인원 쪽입니다.
          축의금은 불참자 것도 포함합니다.
        </p>
      </section>

      {/* ── 청첩장 전달 현황 ───────────────────────────────── */}
      <section className="gs-card" aria-label="청첩장 전달 현황">
        <div className="gs-rowhead">
          <span className="gs-eyebrow">청첩장 전달</span>
          <span className="gs-rowhead__value">
            <b>{invites.delivered}</b> / {invites.total}건
          </span>
        </div>
        <Bar
          ratio={invites.total === 0 ? 0 : invites.delivered / invites.total}
          tone={invites.미전달 === 0 ? 'good' : 'default'}
          label={`${invites.total}건 중 ${invites.delivered}건 전달`}
        />
        <div className="gs-facts">
          <span className="gs-badge gs-badge--pending">미전달 {invites.미전달}</span>
          <span className="gs-badge gs-badge--ok">전달완료 {invites.전달완료}</span>
          <span className="gs-badge gs-badge--info">모바일 {invites.모바일}</span>
        </div>

        {invites.미전달 > 0 && (
          <button type="button" className="gs-inlinebtn" onClick={onFilterUninvited}>
            <span>
              아직 <b>{invites.미전달}건</b> 이 미전달입니다
            </span>
            <span className="gs-inlinebtn__go">미전달만 보기 →</span>
          </button>
        )}

        {sendFrom && daysToSend !== null && (
          <p className="gs-hint">
            발송 권장 시작 <b>{dateLabel(sendFrom)}</b> (예식 6주 전)
            {daysToSend > 0
              ? ` — D-${daysToSend}. 아직 여유가 있지만 명단부터 채워 둬야 그날 한 번에 보냅니다.`
              : daysToSend === 0
                ? ' — 오늘부터입니다.'
                : ` — ${-daysToSend}일 지났습니다. 미전달을 먼저 처리하세요.`}
          </p>
        )}
      </section>
    </>
  )
}
