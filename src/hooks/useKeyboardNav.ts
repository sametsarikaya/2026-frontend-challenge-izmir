import { useEffect } from 'react'

interface KeyboardNavOptions {
  itemIds: ReadonlyArray<string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpen?: (id: string) => void
  onEscape?: () => void
  enabled?: boolean
}

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardNav({
  itemIds,
  selectedId,
  onSelect,
  onOpen,
  onEscape,
  enabled = true,
}: KeyboardNavOptions) {
  useEffect(() => {
    if (!enabled || itemIds.length === 0) return undefined

    function handleKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && FORM_TAGS.has(target.tagName)) return
      if (target?.isContentEditable) return

      const currentIndex = selectedId ? itemIds.indexOf(selectedId) : -1

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = currentIndex < itemIds.length - 1 ? currentIndex + 1 : currentIndex
        if (nextIndex >= 0 && itemIds[nextIndex] !== selectedId) {
          onSelect(itemIds[nextIndex])
        } else if (currentIndex === -1) {
          onSelect(itemIds[0])
        }
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex
        if (prevIndex >= 0 && itemIds[prevIndex] !== selectedId) {
          onSelect(itemIds[prevIndex])
        } else if (currentIndex === -1) {
          onSelect(itemIds[0])
        }
        return
      }

      if (event.key === 'Enter' && selectedId && onOpen) {
        event.preventDefault()
        onOpen(selectedId)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        if (onEscape) onEscape()
        else onSelect(null)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [itemIds, selectedId, onSelect, onOpen, onEscape, enabled])
}
