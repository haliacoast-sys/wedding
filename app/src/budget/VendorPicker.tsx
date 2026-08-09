/**
 * VendorPicker.tsx — 항목에 업체를 연결한다.
 *
 * 업체 관리 화면을 따로 만들지 않는다. 예산을 적다가 "여기 업체가 어디였더라"가
 * 필요한 순간은 항목을 편집하는 바로 그 순간이고, 그때 화면을 옮기면 하던 입력이 끊긴다.
 * 그래서 목록에서 고르거나, 없으면 이름만 적어 즉석에서 만든다.
 */
import { useRef, useState } from 'react'
import { newId } from './budgetApi'
import { useCreateVendor } from './useBudget'
import type { Vendor } from './types'

export type VendorPickerProps = {
  vendors: Vendor[]
  value: string | null
  onChange: (vendorId: string | null) => void
  /** 새 업체를 만들 때 카테고리 기본값으로 쓴다. 항목의 카테고리를 그대로 물려준다. */
  categoryHint?: string
  disabled?: boolean
}

export const VendorPicker = ({
  vendors,
  value,
  onChange,
  categoryHint,
  disabled,
}: VendorPickerProps) => {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const nameRef = useRef<HTMLInputElement | null>(null)
  const createVendor = useCreateVendor()

  const openAdd = (): void => {
    setAdding(true)
    // 렌더 직후에 포커스를 준다. autoFocus 는 화면이 스크롤되는 부작용이 있어 쓰지 않는다.
    requestAnimationFrame(() => nameRef.current?.focus())
  }

  const submit = (): void => {
    const trimmed = name.trim()
    if (!trimmed) {
      setAdding(false)
      return
    }
    const id = newId()
    createVendor.mutate({ id, name: trimmed, category: categoryHint?.trim() || null })
    onChange(id) // 낙관적으로 만든 id 를 바로 연결한다. 실패하면 아래 에러 줄이 뜬다.
    setName('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="bd-vendor">
        <div className="bd-vendor__new">
          <input
            ref={nameRef}
            className="bd-input"
            type="text"
            value={name}
            placeholder="업체 이름"
            autoComplete="off"
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                setName('')
                setAdding(false)
              }
            }}
          />
          <button type="button" className="bd-btn bd-btn--primary bd-btn--sm" onClick={submit}>
            추가
          </button>
          <button
            type="button"
            className="bd-btn bd-btn--ghost bd-btn--sm"
            onClick={() => {
              setName('')
              setAdding(false)
            }}
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bd-vendor">
      <select
        className="bd-input bd-select"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const next = e.currentTarget.value
          if (next === '__new__') {
            openAdd()
            return
          }
          onChange(next || null)
        }}
      >
        <option value="">연결 안 함</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
        <option value="__new__">+ 새 업체 만들기…</option>
      </select>
      {createVendor.isError && (
        <p className="bd-vendor__err">업체를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      )}
    </div>
  )
}
