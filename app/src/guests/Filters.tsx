/**
 * Filters.tsx — 200명을 폰에서 훑기 위한 도구.
 *
 * 화면 위쪽을 필터가 다 먹으면 정작 명단이 안 보인다. 그래서
 *   · 항상 보이는 것 : 검색창 + 필터 개수 버튼 + 걸린 필터의 해제 칩
 *   · 펼쳤을 때만    : 측 / 참석 / 청첩장 칩 세 줄
 * 로 나눴다. 필터가 걸려 있으면 접혀 있어도 무엇이 걸렸는지 칩으로 보이므로
 * "왜 명단이 비었지?" 하는 상황이 생기지 않는다.
 *
 * 검색은 입력 즉시 반영한다(디바운스 없음). 서버를 부르지 않고 이미 받아 둔 배열을
 * 거르는 것뿐이라 200행 정도에서는 사람이 인지할 지연이 없다.
 */
import { useId, useState } from 'react'
import { ATTENDANCES, INVITE_STATES, SIDES } from './types'
import type { Attendance, Filters as FiltersState, Guest, InviteState, WeddingSide } from './types'
import { attendanceCounts, inviteCounts, sideCounts } from './selectors'
import { Chip, SearchIcon } from './ui'

export type QuickMode = 'attending' | 'invitation'

export const FilterBar = ({
  rows,
  value,
  onChange,
  quickMode,
  onQuickModeChange,
}: {
  /** 뱃지에 쓰는 개수는 필터 이전의 전체 명단 기준이다. */
  rows: Guest[]
  value: FiltersState
  onChange: (next: FiltersState) => void
  quickMode: QuickMode
  onQuickModeChange: (next: QuickMode) => void
}) => {
  const [open, setOpen] = useState(false)
  const searchId = useId()

  const sides = sideCounts(rows)
  const atts = attendanceCounts(rows)
  const invites = inviteCounts(rows)

  const active =
    (value.side !== null ? 1 : 0) +
    (value.attending !== null ? 1 : 0) +
    (value.invitation !== null ? 1 : 0)

  const set = <K extends keyof FiltersState>(key: K, next: FiltersState[K]) =>
    onChange({ ...value, [key]: next })

  /** 같은 칩을 다시 누르면 해제된다. '전체' 칩을 따로 두지 않아 한 줄이 짧아진다. */
  const toggle = <T extends string>(current: T | null, picked: T): T | null =>
    current === picked ? null : picked

  return (
    <div className="gs-filters">
      <div className="gs-searchrow">
        <div className="gs-search">
          <span className="gs-search__icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            id={searchId}
            className="gs-search__input"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="이름 또는 연락처 검색"
            aria-label="이름 또는 연락처 검색"
            value={value.query}
            onChange={(e) => set('query', e.currentTarget.value)}
          />
          {value.query !== '' && (
            <button
              type="button"
              className="gs-search__clear"
              onClick={() => set('query', '')}
              aria-label="검색어 지우기"
            >
              ×
            </button>
          )}
        </div>
        <button
          type="button"
          className="gs-filterbtn"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          필터
          {active > 0 && <span className="gs-filterbtn__count">{active}</span>}
        </button>
      </div>

      {/* 접혀 있어도 걸린 필터는 보인다. 누르면 그 조건만 풀린다. */}
      {!open && active > 0 && (
        <div className="gs-activefilters">
          {value.side !== null && (
            <button type="button" className="gs-tagbtn" onClick={() => set('side', null)}>
              {value.side}측 <span aria-hidden="true">×</span>
            </button>
          )}
          {value.attending !== null && (
            <button type="button" className="gs-tagbtn" onClick={() => set('attending', null)}>
              {value.attending} <span aria-hidden="true">×</span>
            </button>
          )}
          {value.invitation !== null && (
            <button type="button" className="gs-tagbtn" onClick={() => set('invitation', null)}>
              청첩장 {value.invitation} <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="gs-filterpanel">
          <div className="gs-filterpanel__row">
            <span className="gs-filterpanel__label">측</span>
            <div className="gs-chiprow">
              {SIDES.map((s: WeddingSide) => (
                <Chip
                  key={s}
                  active={value.side === s}
                  count={sides[s]}
                  onClick={() => set('side', toggle(value.side, s))}
                >
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          <div className="gs-filterpanel__row">
            <span className="gs-filterpanel__label">참석</span>
            <div className="gs-chiprow">
              {ATTENDANCES.map((a: Attendance) => (
                <Chip
                  key={a}
                  active={value.attending === a}
                  count={atts[a]}
                  onClick={() => set('attending', toggle(value.attending, a))}
                >
                  {a}
                </Chip>
              ))}
            </div>
          </div>

          <div className="gs-filterpanel__row">
            <span className="gs-filterpanel__label">청첩장</span>
            <div className="gs-chiprow">
              {INVITE_STATES.map((i: InviteState) => (
                <Chip
                  key={i}
                  active={value.invitation === i}
                  count={invites[i]}
                  onClick={() => set('invitation', toggle(value.invitation, i))}
                >
                  {i}
                </Chip>
              ))}
            </div>
          </div>

          {/*
            목록 왼쪽 버튼이 무엇을 바꿀지 고른다.
            참석 여부도 청첩장도 '한 번에 몰아서' 바꾸는 일이라, 그때그때 무엇을
            돌릴지 정해 두면 행마다 버튼을 두 개 놓지 않아도 된다. 행이 그만큼 얇아진다.
          */}
          <div className="gs-filterpanel__row">
            <span className="gs-filterpanel__label">빠른 전환</span>
            <div className="gs-chiprow">
              <Chip
                active={quickMode === 'attending'}
                onClick={() => onQuickModeChange('attending')}
                title="목록 왼쪽 버튼이 참석 여부를 돌립니다"
              >
                참석 여부
              </Chip>
              <Chip
                active={quickMode === 'invitation'}
                onClick={() => onQuickModeChange('invitation')}
                title="목록 왼쪽 버튼이 청첩장 상태를 돌립니다"
              >
                청첩장
              </Chip>
            </div>
          </div>

          {active > 0 && (
            <button
              type="button"
              className="gs-btn gs-btn--quiet gs-filterpanel__clear"
              onClick={() => onChange({ ...value, side: null, attending: null, invitation: null })}
            >
              필터 모두 해제
            </button>
          )}
        </div>
      )}
    </div>
  )
}
