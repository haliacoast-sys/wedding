/**
 * GuestRow.tsx — 명단 한 줄.
 *
 * 행을 얇게 유지하는 것이 이 파일의 목표다. 200줄을 폰에서 스크롤하는데 한 줄이
 * 100px 이면 화면에 6명밖에 안 들어온다. 그래서 행에 두는 버튼은 두 개뿐이다.
 *
 *   왼쪽  : 상태 순환 버튼 하나. 무엇을 돌릴지는 위의 '빠른 전환'이 정한다.
 *           (참석 여부와 청첩장을 각각 버튼으로 두면 행이 한 줄 더 두꺼워진다.
 *            둘 다 '한 번에 몰아서' 바꾸는 일이라 그때그때 하나만 있으면 충분하다.)
 *   오른쪽: 전화. 연락처가 없으면 자리만 남기고 흐려 둔다 —
 *           행마다 오른쪽 끝 위치가 달라지면 엄지가 매번 다시 조준해야 한다.
 *
 * 가운데 본문을 누르면 전체 편집 시트가 열린다.
 *
 * memo 를 씌운 이유: 검색어를 한 글자 칠 때마다 부모가 다시 그려진다.
 * 200개 행이 매 타이핑마다 전부 재렌더되면 폰에서 체감된다.
 */
import { memo } from 'react'
import type { Guest } from './types'
import { manwon, prettyPhone, telHref } from './format'
import { PhoneIcon } from './ui'
import type { QuickMode } from './Filters'

const ATT_TONE: Record<Guest['attending'], string> = {
  참석: 'good',
  불참: 'off',
  미정: 'warn',
}

const INVITE_TONE: Record<Guest['invitation'], string> = {
  전달완료: 'good',
  모바일: 'good',
  미전달: 'warn',
}

/** 순환 버튼에 쓰는 짧은 표기. 44px 안에 들어가야 한다. */
const INVITE_SHORT: Record<Guest['invitation'], string> = {
  미전달: '미전달',
  전달완료: '전달',
  모바일: '모바일',
}

export const GuestRow = memo(
  ({
    guest,
    quickMode,
    onCycle,
    onOpen,
  }: {
    guest: Guest
    quickMode: QuickMode
    onCycle: (guest: Guest) => void
    onOpen: (guest: Guest) => void
  }) => {
    const tel = telHref(guest.contact)
    const cycling = quickMode === 'attending' ? guest.attending : guest.invitation
    const tone =
      quickMode === 'attending' ? ATT_TONE[guest.attending] : INVITE_TONE[guest.invitation]
    const cycleLabel =
      quickMode === 'attending' ? guest.attending : INVITE_SHORT[guest.invitation]

    // 인원이 1/1 이면 굳이 보여주지 않는다. 대부분의 줄이 그 상태라 전부 표시하면 소음이다.
    const showCounts = guest.head_count !== 1 || guest.meal_count !== guest.head_count

    return (
      <li className="gs-item">
        <button
          type="button"
          className="gs-cycle"
          data-tone={tone}
          onClick={() => onCycle(guest)}
          aria-label={`${guest.name} ${quickMode === 'attending' ? '참석 여부' : '청첩장'}: ${cycling}. 눌러서 다음 상태로`}
        >
          {cycleLabel}
        </button>

        <button
          type="button"
          className="gs-item__body"
          onClick={() => onOpen(guest)}
          aria-label={`${guest.name} 편집`}
        >
          <span className="gs-item__title">
            <b>{guest.name}</b>
            <span className="gs-badge gs-badge--side">{guest.side}</span>
            {guest.relation && <span className="gs-badge">{guest.relation}</span>}
          </span>

          <span className="gs-item__meta">
            {/* 순환 버튼이 안 보여주는 쪽을 여기서 보여 준다. 두 상태를 한눈에 본다. */}
            {quickMode === 'attending' ? (
              <span className="gs-badge" data-tone={INVITE_TONE[guest.invitation]}>
                {guest.invitation}
              </span>
            ) : (
              <span className="gs-badge" data-tone={ATT_TONE[guest.attending]}>
                {guest.attending}
              </span>
            )}

            {showCounts && (
              <span className="gs-badge gs-badge--count">
                인원 {guest.head_count}
                {guest.meal_count !== guest.head_count && ` · 식사 ${guest.meal_count}`}
              </span>
            )}

            {guest.gift_amount !== null && guest.gift_amount !== undefined && (
              <span className="gs-badge gs-badge--gift">{manwon(guest.gift_amount)}</span>
            )}

            {guest.contact && <span className="gs-item__tel">{prettyPhone(guest.contact)}</span>}
          </span>

          {guest.memo && <span className="gs-item__note">{guest.memo}</span>}
        </button>

        {tel ? (
          <a
            className="gs-call"
            href={tel}
            aria-label={`${guest.name}에게 전화`}
            onClick={(e) => e.stopPropagation()}
          >
            <PhoneIcon />
          </a>
        ) : (
          <span className="gs-call gs-call--off" aria-hidden="true">
            <PhoneIcon />
          </span>
        )}
      </li>
    )
  },
)

GuestRow.displayName = 'GuestRow'
