import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColumnValue } from '@/lib/columnValues'

interface Props {
  /** התווית של העמודה, לכותרת התפריט */
  title: string
  values: ColumnValue[]
  /** null = אין סינון על העמודה (הכל מסומן) */
  selected: string[] | null
  /** null מחזיר את העמודה למצב "הכל" ומסיר את הסינון */
  onChange: (selected: string[] | null) => void
  onSort?: (direction: 'asc' | 'desc') => void
  /** מלבן העוגן (כפתור המסנן בכותרת) — התפריט נפתח מתחתיו */
  anchor: DOMRect
  onClose: () => void
}

const PANEL_WIDTH = 264
const PANEL_MAX_HEIGHT = 420

/**
 * תפריט הסינון של עמודה — הפיצ'ר שסבא הגדיר כ"סופר-חשוב" (הערה 5).
 *
 * מציג את כל הערכים שבעמודה לפי א"ב, כל אחד עם צ'קבוקס וספירה, ומאפשר
 * לבחור כמה מהם בבת אחת. עד היום, כדי לראות שלושה יישובים היה צריך
 * שלושה סינונים נפרדים.
 *
 * מוצג ב-portal עם מיקום fixed: הכותרת יושבת בתוך אזור גלילה, ותפריט
 * רגיל בתוכה היה נחתך בקצוות.
 */
export default function ColumnFilterMenu({
  title,
  values,
  selected,
  onChange,
  onSort,
  anchor,
  onClose,
}: Props) {
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // מצב עבודה מקומי: null = הכל מסומן
  const selectedSet = useMemo(
    () => (selected === null ? null : new Set(selected)),
    [selected],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return values
    return values.filter((v) => v.label.toLowerCase().includes(q))
  }, [values, query])

  // סגירה בלחיצה בחוץ או ב-Escape
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const isChecked = (value: string) =>
    selectedSet === null ? true : selectedSet.has(value)

  function toggle(value: string) {
    // מצב "הכל" הופך לרשימה מפורשת ברגע שמורידים ממנו ערך אחד
    const current = selectedSet ?? new Set(values.map((v) => v.value))
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)

    if (next.size === values.length) onChange(null)
    else onChange([...next])
  }

  /** בחירת/ביטול כל מה שמוצג כרגע (מכבד את החיפוש) */
  function setAllVisible(checked: boolean) {
    const visible = filtered.map((v) => v.value)
    if (!query.trim()) {
      onChange(checked ? null : [])
      return
    }
    const current = new Set(selectedSet ?? values.map((v) => v.value))
    for (const v of visible) {
      if (checked) current.add(v)
      else current.delete(v)
    }
    if (current.size === values.length) onChange(null)
    else onChange([...current])
  }

  const chosen = selectedSet === null ? values.length : selectedSet.size

  // מיקום: נפתח מתחת לעוגן, ונצמד פנימה אם חורג מהמסך
  const left = Math.min(
    Math.max(8, anchor.left),
    Math.max(8, window.innerWidth - PANEL_WIDTH - 8),
  )
  const top = Math.min(anchor.bottom + 4, window.innerHeight - 120)

  return createPortal(
    <div
      ref={panelRef}
      dir="rtl"
      style={{ position: 'fixed', top, left, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT }}
      className="z-50 flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="truncate text-sm font-bold text-sky-800" title={title}>
          {title}
        </span>
        <button
          onClick={onClose}
          title="סגירה"
          className="rounded px-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
        >
          ✕
        </button>
      </div>

      {onSort && (
        <div className="flex gap-1 border-b border-slate-100 px-2 py-1.5 text-xs">
          <button
            onClick={() => {
              onSort('asc')
              onClose()
            }}
            className="flex-1 rounded-md px-2 py-1 text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
          >
            ▲ מיון א→ת
          </button>
          <button
            onClick={() => {
              onSort('desc')
              onClose()
            }}
            className="flex-1 rounded-md px-2 py-1 text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
          >
            ▼ מיון ת→א
          </button>
        </div>
      )}

      <div className="border-b border-slate-100 p-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש ערך…"
          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
        />
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <button
            onClick={() => setAllVisible(true)}
            className="rounded-md bg-sky-50 px-2 py-0.5 font-medium text-sky-700 transition hover:bg-sky-100"
          >
            בחר הכל
          </button>
          <button
            onClick={() => setAllVisible(false)}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 transition hover:bg-slate-200"
          >
            בטל הכל
          </button>
          <span className="mr-auto text-slate-400">
            {chosen}/{values.length}
          </span>
        </div>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="p-4 text-center text-sm text-slate-400">לא נמצא ערך מתאים</p>
        )}
        {filtered.map((v) => (
          <label
            key={v.value || '__blank__'}
            className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-sm last:border-0 hover:bg-sky-50"
          >
            <input
              type="checkbox"
              checked={isChecked(v.value)}
              onChange={() => toggle(v.value)}
              className="accent-sky-600"
            />
            <span
              className={'flex-1 truncate ' + (v.value === '' ? 'italic text-slate-400' : '')}
              title={v.label}
            >
              {v.label}
            </span>
            <span className="shrink-0 text-xs text-slate-400">
              {v.count.toLocaleString('he-IL')}
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <button
          onClick={() => {
            onChange(null)
            onClose()
          }}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          ניקוי סינון העמודה
        </button>
        <button
          onClick={onClose}
          className="mr-auto rounded-lg bg-sky-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-sky-700"
        >
          סיום
        </button>
      </div>
    </div>,
    document.body,
  )
}
