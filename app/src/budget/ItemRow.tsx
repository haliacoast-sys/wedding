/**
 * ItemRow.tsx — 목록 한 줄.
 *
 * 한 줄에 답해야 하는 질문은 넷이다.
 *   무엇을 · 어디와 · 얼마에 계약했고 · 앞으로 얼마가 남았나.
 * 그래서 오른쪽 큰 숫자는 계약금액이 아니라 <남은 잔금> 이다. 계약금액은 이미 낸 돈까지
 * 포함한 값이라 '앞으로 뭘 해야 하나'에 답하지 못한다. 계약금액과 낸 돈은 왼쪽 아래에
 * 작은 글씨로 근거처럼 붙인다.
 *
 * 예산(estimate)은 계약금액과 다를 때만 보여 준다. 계약이 끝난 뒤의 예산은
 * 지나간 숫자라, 같은 값을 두 번 적으면 줄만 길어지고 읽는 사람이 매번 비교하게 된다.
 *
 * 전화 버튼은 줄 버튼의 형제로 둔다. <button> 안에 <a> 를 넣으면 유효하지 않은 마크업이고
 * 폰에서 어느 쪽이 눌린 건지도 불안정하다. 둘 다 44px 을 따로 확보한다.
 */
import { parseContact } from './contact'
import { ddayLabel, shortDate } from './dates'
import { formatSignedWon, formatWon } from './money'
import { statusTone } from './types'
import type { RowView } from './selectors'

export type ItemRowProps = {
  view: RowView
  /** vendors 테이블에서 연결된 업체 이름. 인라인 vendor_name 이 우선한다. */
  vendorName?: string
  expanded: boolean
  onToggle: () => void
}

type Headline = { text: string; cap: string; tone: string }

/** 오른쪽 큰 숫자 하나를 무엇으로 채울지. 상태에 따라 의미가 달라지므로 cap 을 꼭 붙인다. */
const headlineOf = (v: RowView): Headline => {
  if (v.cancelled) return { text: '취소', cap: '', tone: 'off' }
  if (v.unpaid != null && v.unpaid > 0) {
    return { text: formatWon(v.unpaid), cap: '남은 잔금', tone: 'due' }
  }
  if (v.contracted != null && v.contracted > 0) {
    return { text: '완납', cap: formatWon(v.contracted), tone: 'done' }
  }
  // 계약금액이 0원인 항목이 실제로 여럿 있다(스드메 패키지 포함분, CA 필수 포함 옵션).
  // '금액 미정'으로 흘려보내면 아직 안 정해진 것처럼 보인다 — 정해졌고, 0원이다.
  if (v.contracted === 0) return { text: '0', cap: '추가 비용 없음', tone: 'muted' }
  if (v.paid > 0) return { text: formatWon(v.paid), cap: '지출', tone: 'plain' }
  if (v.estimate != null) return { text: formatWon(v.estimate), cap: '예산', tone: 'est' }
  return { text: '금액 미정', cap: '', tone: 'muted' }
}

/** 예정일 배지 색. 지났으면 빨강, 일주일 안이면 빨강, 한 달 안이면 노랑. */
const dueTone = (v: RowView): string => {
  if (v.overdue) return 'bd-due bd-due--late'
  if (!v.dueSoon) return 'bd-due'
  return v.dueInDays != null && v.dueInDays <= 7 ? 'bd-due bd-due--late' : 'bd-due bd-due--soon'
}

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false">
    <path
      d="M21.5 16.9v3a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6A2 2 0 0 1 3.8 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.8 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const ItemRow = ({ view, vendorName, expanded, onToggle }: ItemRowProps) => {
  const item = view.row
  const head = headlineOf(view)
  const vendor = item.vendor_name?.trim() || vendorName || ''
  const contact = parseContact(item.vendor_contact)
  // 시세는 '얼마에 계약했어야 했나'를 묻는 값이므로 확정된 계약금액과 비교한다.
  // 계약 전이면 업체가 부른 예산과 비교한다. 실지출과 비교하면 판단에 쓸 수 없다.
  const marketBase = view.contracted ?? view.estimate

  return (
    <div className="bd-rowwrap">
      <button
        type="button"
        className={view.cancelled ? 'bd-row bd-row--off' : 'bd-row'}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="bd-row__main">
          <span className="bd-row__label">{item.label}</span>

          <span className="bd-row__meta">
            <span className={`bd-st bd-st--${statusTone(view.status)}`}>{view.status}</span>
            {/* 축의금으로 정산되는 항목은 우리 지갑에서 나가는 돈이 아니다.
                같은 목록에 섞여 있으므로 한눈에 갈리도록 표시한다. */}
            {item.funding === '축의금' && <span className="bd-tag bd-tag--gift">축의금</span>}
            {item.category?.trim() && <span className="bd-tag">{item.category.trim()}</span>}
            {vendor && <span className="bd-row__vendor">{vendor}</span>}
            {!vendor && contact?.rest && <span className="bd-row__vendor">{contact.rest}</span>}
          </span>

          {(view.contracted != null || view.paid > 0) && (
            <span className="bd-row__money">
              {view.contracted != null && <>계약 {formatWon(view.contracted)}</>}
              {view.contracted == null && <b className="bd-warnmark">계약금액 미입력</b>}
              {view.paid > 0 && (
                <>
                  {' · '}낸 돈 {formatWon(view.paid)}
                  <i className="bd-row__cnt">{view.paymentCount}건</i>
                </>
              )}
              {view.gap != null && view.gap !== 0 && (
                <>
                  {' · '}예산 {formatWon(view.estimate)}
                  <b className={view.gap > 0 ? 'bd-delta bd-delta--over' : 'bd-delta bd-delta--under'}>
                    {formatSignedWon(view.gap)}
                  </b>
                </>
              )}
            </span>
          )}

          {item.market_avg != null && (
            <span className="bd-row__money bd-row__market">
              시세 {formatWon(item.market_avg)}
              {marketBase != null && marketBase !== item.market_avg && (
                <b
                  className={
                    marketBase > item.market_avg
                      ? 'bd-delta bd-delta--over'
                      : 'bd-delta bd-delta--under'
                  }
                >
                  {formatSignedWon(marketBase - item.market_avg)}
                </b>
              )}
              {marketBase != null && marketBase === item.market_avg && (
                <b className="bd-delta">시세와 같음</b>
              )}
            </span>
          )}
        </span>

        <span className="bd-row__nums">
          <span className={`bd-amt bd-amt--${head.tone}`}>{head.text}</span>
          {head.cap && <span className="bd-amt__cap">{head.cap}</span>}
          {item.due_on && (
            <span className={dueTone(view)}>
              {view.dueInDays != null && <b>{ddayLabel(view.dueInDays)}</b>}
              {shortDate(item.due_on)}
            </span>
          )}
        </span>
      </button>

      {/* 실제 데이터에 "010-9019-9920 이도경이사" 처럼 번호와 담당자가 한 칸에 들어온다.
          번호를 찾아냈을 때만 버튼을 그린다. */}
      {contact?.tel && (
        <a
          className="bd-call"
          href={`tel:${contact.tel}`}
          aria-label={`${vendor || item.label} ${contact.number} 전화 걸기`}
        >
          <PhoneIcon />
        </a>
      )}
    </div>
  )
}
