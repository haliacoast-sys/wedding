/**
 * BulkAdd.tsx — 붙여넣기로 여러 명을 한 번에.
 *
 * 200명을 폼으로 한 명씩 넣는 건 폰에서 사실상 불가능하다. 그런데 원본은 이미
 * 엑셀·카톡·메모장에 이름 목록으로 존재한다. 그걸 그대로 붙여넣게 하는 것이
 * 이 화면에서 가장 큰 시간 절약이다.
 *
 * ★ 규칙을 설명하는 대신 결과를 보여 준다.
 *   파싱 규칙을 아무리 잘 적어도 사용자는 안 읽는다. 그래서 입력하는 즉시
 *   "이렇게 N명이 들어갑니다" 를 표로 보여 주고, 그게 틀렸으면 모드를 바꾸게 한다.
 *   저장 버튼을 누르기 전에 무슨 일이 일어날지 전부 눈에 보인다.
 *
 * 전송은 배열 insert 한 번이다. 한 명씩 30번 보내면 중간에 하나만 실패했을 때
 * 어디까지 들어갔는지 알 수 없다.
 */
import { useMemo, useState } from 'react'
import { RELATIONS, SIDES } from './types'
import type { GuestDraft, WeddingSide } from './types'
import { duplicatesAgainst, duplicatesWithin, parseBulk } from './bulk'
import type { BulkMode } from './bulk'
import { Chip, Field, Sheet } from './ui'

const SAMPLE = `김철수
이영희, 친구
박민수, 직장, 010-1234-5678
정가족, 가족, 4`

export const BulkAdd = ({
  defaultSide,
  defaultRelation,
  existingNames,
  onClose,
  onSubmit,
  busy,
}: {
  defaultSide: WeddingSide
  defaultRelation: string | null
  /** 공백을 제거한 기존 이름 집합. 중복 경고에만 쓴다(막지는 않는다). */
  existingNames: Set<string>
  onClose: () => void
  onSubmit: (drafts: GuestDraft[]) => void
  busy: boolean
}) => {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<BulkMode>('line')
  const [side, setSide] = useState<WeddingSide>(defaultSide)
  const [relation, setRelation] = useState<string | null>(defaultRelation)

  const parsed = useMemo(() => parseBulk(text, mode), [text, mode])
  const dupWithin = useMemo(() => duplicatesWithin(parsed.rows), [parsed.rows])
  const dupExisting = useMemo(
    () => duplicatesAgainst(parsed.rows, existingNames),
    [parsed.rows, existingNames],
  )

  const drafts: GuestDraft[] = parsed.rows.map((r) => ({
    name: r.name,
    side,
    // 줄에서 읽은 관계가 있으면 그걸 쓰고, 없으면 위에서 고른 기본값을 쓴다.
    relation: r.relation ?? relation,
    contact: r.contact,
    invitation: '미전달',
    attending: '미정',
    head_count: r.headCount,
    // 처음에는 식사 인원 = 참석 인원. 아이가 끼어 있으면 나중에 그 줄만 고친다.
    meal_count: r.headCount,
    gift_amount: null,
    thanks: null,
    memo: null,
  }))

  const totalPeople = drafts.reduce((n, d) => n + d.head_count, 0)

  return (
    <Sheet
      title="여러 명 한 번에 추가"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="gs-btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="gs-btn gs-btn--primary"
            disabled={drafts.length === 0 || busy}
            onClick={() => onSubmit(drafts)}
          >
            {drafts.length > 0 ? `${drafts.length}명 추가` : '추가'}
          </button>
        </>
      }
    >
      <Field
        label="붙여넣기"
        hint={
          mode === 'line'
            ? '한 줄에 한 명. 쉼표 뒤에 관계·연락처·인원을 덧붙일 수 있고 순서는 상관없습니다.'
            : '쉼표와 줄바꿈으로 나눈 조각이 전부 이름이 됩니다. 이름만 죽 나열된 목록을 옮길 때 쓰세요.'
        }
        htmlFor="gs-bulk-text"
      >
        <div className="gs-segment gs-segment--tight">
          <Chip active={mode === 'line'} onClick={() => setMode('line')}>
            한 줄에 한 명
          </Chip>
          <Chip active={mode === 'comma'} onClick={() => setMode('comma')}>
            쉼표로 여러 명
          </Chip>
        </div>
        <textarea
          id="gs-bulk-text"
          className="gs-textarea gs-textarea--bulk"
          placeholder={SAMPLE}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
      </Field>

      <Field label="이 사람들의 측">
        <div className="gs-segment">
          {SIDES.map((s: WeddingSide) => (
            <Chip key={s} active={side === s} onClick={() => setSide(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </Field>

      <Field
        label="이 사람들의 관계"
        hint="줄에 관계를 직접 적었으면 그쪽이 우선합니다."
      >
        <div className="gs-segment">
          <Chip active={relation === null} onClick={() => setRelation(null)}>
            미지정
          </Chip>
          {RELATIONS.map((r) => (
            <Chip key={r} active={relation === r} onClick={() => setRelation(r)}>
              {r}
            </Chip>
          ))}
        </div>
      </Field>

      {/* ── 미리보기: 저장 전에 결과를 그대로 보여 준다 ────── */}
      {text.trim() !== '' && (
        <div className="gs-preview">
          <div className="gs-preview__head">
            <b>{drafts.length}명</b>
            <span>
              참석 인원 합계 {totalPeople}명
              {parsed.skipped > 0 && ` · 이름을 못 찾아 건너뛴 줄 ${parsed.skipped}개`}
            </span>
          </div>

          {drafts.length === 0 ? (
            <p className="gs-hint">
              읽어낼 이름이 없습니다. 모드를 바꾸거나 줄바꿈·쉼표로 구분해 보세요.
            </p>
          ) : (
            <div className="gs-tablewrap">
              <table className="gs-table gs-table--preview">
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">측</th>
                    <th scope="col">관계</th>
                    <th scope="col">연락처</th>
                    <th scope="col">인원</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.slice(0, 8).map((d, i) => (
                    <tr key={`${d.name}-${i}`}>
                      <th scope="row">{d.name}</th>
                      <td>{d.side}</td>
                      <td>{d.relation ?? '—'}</td>
                      <td>{d.contact ?? '—'}</td>
                      <td>{d.head_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {drafts.length > 8 && (
                <p className="gs-preview__more">… 아래로 {drafts.length - 8}명 더</p>
              )}
            </div>
          )}

          {dupWithin.length > 0 && (
            <div className="gs-callout gs-callout--warn">
              <b>붙여넣은 목록 안에 같은 이름이 있습니다</b> — {dupWithin.slice(0, 5).join(', ')}
              {dupWithin.length > 5 && ` 외 ${dupWithin.length - 5}명`}. 동명이인이면 그대로 두세요.
            </div>
          )}
          {dupExisting.length > 0 && (
            <div className="gs-callout gs-callout--warn">
              <b>이미 명단에 있는 이름입니다</b> — {dupExisting.slice(0, 5).join(', ')}
              {dupExisting.length > 5 && ` 외 ${dupExisting.length - 5}명`}. 같은 목록을 두 번
              붙여넣은 건 아닌지 확인하세요.
            </div>
          )}

          <p className="gs-hint">
            전부 <b>참석 미정 · 청첩장 미전달 · 식사 인원 = 참석 인원</b> 으로 들어갑니다.
            나머지는 나중에 한 명씩 고치면 됩니다.
          </p>
        </div>
      )}
    </Sheet>
  )
}
