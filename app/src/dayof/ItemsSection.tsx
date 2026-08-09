/**
 * ItemsSection.tsx — 당일 준비물.
 *
 * tasks 의 4단계 status 와 달리 여기는 "챙겼나?" boolean 하나면 충분하다.
 * 그래서 행 전체가 하나의 큰 체크 타겟이고, 편집은 오른쪽 작은 버튼으로 뺐다.
 * 당일 아침에 가방을 싸면서 한 손으로 훑는 화면이라 오탭이 나면 안 된다.
 */
import { useState } from 'react'
import { describeError } from './dayofApi'
import { groupItems, itemCategories, progressOfItems } from './selectors'
import { ErrorState, LoadingList, WriteToast, ZeroRowState } from './StateViews'
import type { ProbeState } from './StateViews'
import { ItemEditor } from './ItemEditor'
import type { ItemEditorTarget } from './ItemEditor'
import type { Item, ItemDraft, ItemUpdate } from './types'
import { buildItemInsert, useCreateItem, useDeleteItem, useTogglePacked, useUpdateItem } from './useDayOf'
import { CheckIcon, Meter } from './ui'

const ItemRow = ({
  item,
  onToggle,
  onOpen,
}: {
  item: Item
  onToggle: (item: Item) => void
  onOpen: (item: Item) => void
}) => (
  <li className="dof-item" data-tone={item.packed ? 'done' : undefined}>
    <button
      type="button"
      className="dof-check"
      role="checkbox"
      aria-checked={item.packed}
      aria-label={`${item.label} ${item.packed ? '챙김 해제' : '챙김 표시'}`}
      onClick={() => onToggle(item)}
    >
      <span className="dof-check__box">
        <CheckIcon />
      </span>
    </button>

    {/* 라벨 전체가 토글이다. 편집은 오른쪽 버튼으로 분리했다. */}
    <button type="button" className="dof-item__body" onClick={() => onToggle(item)}>
      <span className="dof-item__title">{item.label}</span>
      {item.owner && (
        <span className="dof-item__meta">
          <span className="dof-badge dof-badge--person">{item.owner}</span>
        </span>
      )}
      {item.note && <span className="dof-item__note">{item.note}</span>}
    </button>

    <button
      type="button"
      className="dof-edit"
      aria-label={`${item.label} 수정`}
      onClick={() => onOpen(item)}
    >
      ⋯
    </button>
  </li>
)

export const ItemsSection = ({
  items,
  isPending,
  isError,
  error,
  onRetry,
  probe,
  probeError,
  onProbeRetry,
}: {
  items: Item[]
  isPending: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  probe: ProbeState
  probeError: unknown
  onProbeRetry: () => void
}) => {
  const toggle = useTogglePacked()
  const create = useCreateItem()
  const update = useUpdateItem()
  const remove = useDeleteItem()
  const [editor, setEditor] = useState<ItemEditorTarget | null>(null)

  const busy = create.isPending || update.isPending || remove.isPending
  const writeError = toggle.error ?? create.error ?? update.error ?? remove.error
  const dismiss = () => {
    toggle.reset()
    create.reset()
    update.reset()
    remove.reset()
  }

  const groups = groupItems(items)
  const overall = progressOfItems(items)
  const categories = itemCategories(items)
  const zeroRows = !isPending && !isError && items.length === 0

  const handleCreate = (draft: ItemDraft) => {
    create.mutate(buildItemInsert(items, draft))
    setEditor(null)
  }
  const handleSave = (id: string, patch: ItemUpdate) => {
    if (Object.keys(patch).length > 0) update.mutate({ id, patch })
    setEditor(null)
  }
  const handleDelete = (id: string) => {
    remove.mutate({ id })
    setEditor(null)
  }

  return (
    <>
      <section className="dof-card" aria-label="준비물 진행률">
        <Meter progress={overall} label="챙긴 물건" />
        <p className="dof-hint">
          {overall.total - overall.done > 0
            ? `아직 ${overall.total - overall.done}개 남았습니다. 전날 밤에 한 번, 당일 아침에 한 번 더 훑어보세요.`
            : overall.total > 0
              ? '전부 챙겼습니다.'
              : ''}
        </p>
      </section>

      <div className="dof-controls">
        <span className="dof-controls__label">
          {overall.done}/{overall.total}
        </span>
        <span className="dof-controls__spacer" />
        <button
          type="button"
          className="dof-addbtn"
          onClick={() => setEditor({ mode: 'create', presetCategory: null })}
          disabled={busy}
        >
          + 준비물 추가
        </button>
      </div>

      {isPending && <LoadingList rows={5} />}
      {isError && <ErrorState error={error} onRetry={onRetry} what="준비물 목록" />}

      {zeroRows && (
        <ZeroRowState
          what="준비물"
          probe={probe}
          probeError={probeError}
          onRetry={onProbeRetry}
          onAdd={() => setEditor({ mode: 'create', presetCategory: null })}
          addLabel="첫 준비물 추가"
          extra={
            <p>
              <code>day_of_items</code> 가 비어 있습니다. 시드가 아직 안 들어갔거나 전부 삭제된
              상태입니다.
            </p>
          }
        />
      )}

      {groups.map((group) => (
        <section className="dof-group" key={group.category}>
          <div className="dof-grouphead">
            <h3>{group.category}</h3>
            <span className="dof-grouphead__count">
              {group.progress.done}/{group.progress.total}
            </span>
          </div>
          <div className="dof-grouphead__meter">
            <Meter progress={group.progress} mini />
          </div>
          <ul className="dof-list">
            {group.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={(i) => toggle.mutate({ id: i.id, packed: !i.packed })}
                onOpen={(i) => setEditor({ mode: 'edit', item: i })}
              />
            ))}
          </ul>
        </section>
      ))}

      {editor && (
        <ItemEditor
          key={editor.mode === 'edit' ? editor.item.id : 'new'}
          target={editor}
          categories={categories}
          busy={busy}
          onClose={() => setEditor(null)}
          onCreate={handleCreate}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {writeError && <WriteToast message={describeError(writeError).message} onDismiss={dismiss} />}
    </>
  )
}
