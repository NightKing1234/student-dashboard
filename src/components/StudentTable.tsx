import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { fieldLabel } from '@/config/fields'
import type { SortState } from '@/lib/table'

type Row = Record<string, unknown>

interface Props {
  rows: Row[]
  /** שדות הדף הנוכחי בלבד (אחרי דפדוף אופקי) */
  fields: string[]
  sort: SortState | null
  onSort: (field: string) => void
  onRowClick: (index: number) => void
}

const ROW_HEIGHT = 36
const DEFAULT_COL_WIDTH = 96 // צר יותר מבעבר כדי שייכנסו יותר עמודות במסך
const MIN_COL_WIDTH = 56
const INDEX_WIDTH = 44

/**
 * הטבלה הראשית — שורות מווירטואלות (~50k), רוחב עמודות ניתן לשינוי בגרירה (אפיון §6.1).
 * מבנה flex אחיד לכותרת ולשורות לשמירת יישור.
 */
export default function StudentTable({ rows, fields, sort, onSort, onRowClick }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  // רוחב לכל עמודה לפי מפתח השדה (נשמר גם במעבר בין תצורות/דפים)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const widthOf = (key: string) => colWidths[key] ?? DEFAULT_COL_WIDTH

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  // גרירת ידית לשינוי רוחב עמודה
  function startResize(e: ReactMouseEvent, key: string) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = widthOf(key)
    function onMove(ev: MouseEvent) {
      // הידית בקצה השמאלי של העמודה (RTL): גרירה שמאלה מרחיבה
      const newW = Math.max(MIN_COL_WIDTH, startW - (ev.clientX - startX))
      setColWidths((w) => ({ ...w, [key]: newW }))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const totalWidth = INDEX_WIDTH + fields.reduce((s, k) => s + widthOf(k), 0)

  return (
    <div ref={parentRef} className="thin-scrollbar h-full overflow-auto">
      <div style={{ minWidth: totalWidth }}>
        {/* כותרת דביקה */}
        <div className="sticky top-0 z-10 flex bg-sky-50 shadow-sm">
          <div
            style={{ width: INDEX_WIDTH }}
            className="flex shrink-0 items-center justify-center border-b-2 border-sky-200 py-2 text-sky-400"
          >
            #
          </div>
          {fields.map((key) => {
            const active = sort?.field === key
            return (
              <div
                key={key}
                style={{ width: widthOf(key) }}
                className="group relative flex shrink-0 items-center justify-between gap-1 whitespace-nowrap border-b-2 border-l border-sky-200 border-l-sky-100 py-2 pr-2 pl-1 font-semibold text-sky-700"
              >
                <button
                  onClick={() => onSort(key)}
                  title={fieldLabel(key) + ' — לחץ למיון'}
                  className="flex min-w-0 flex-1 items-center gap-1 text-right transition hover:text-sky-900"
                >
                  <span className="truncate">{fieldLabel(key)}</span>
                  {active && <span className="shrink-0 text-sky-500">{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                </button>
                {/* ידית שינוי רוחב */}
                <div
                  onMouseDown={(e) => startResize(e, key)}
                  title="גרור לשינוי רוחב"
                  className="absolute inset-y-0 left-0 w-1.5 cursor-col-resize bg-transparent transition hover:bg-sky-400"
                />
              </div>
            )
          })}
        </div>

        {/* גוף מווירטואל */}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = rows[vItem.index]
            return (
              <div
                key={vItem.key}
                onClick={() => onRowClick(vItem.index)}
                className={
                  "absolute flex w-full cursor-pointer border-b border-slate-100 transition-colors hover:bg-sky-50 " +
                  (vItem.index % 2 ? "bg-slate-50/60" : "bg-white")
                }
                style={{ transform: `translateY(${vItem.start}px)`, height: ROW_HEIGHT }}
              >
                <div
                  style={{ width: INDEX_WIDTH }}
                  className="flex shrink-0 items-center justify-center text-xs text-slate-400"
                >
                  {vItem.index + 1}
                </div>
                {fields.map((key) => (
                  <div
                    key={key}
                    style={{ width: widthOf(key) }}
                    className="flex shrink-0 items-center overflow-hidden whitespace-nowrap border-l border-slate-100 px-2 text-slate-700"
                    title={String(row[key] ?? '')}
                  >
                    <span className="truncate">{String(row[key] ?? '')}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="p-12 text-center text-slate-400">
          <div className="text-3xl">🔍</div>
          <p className="mt-2">אין תוצאות להצגה</p>
          <p className="mt-1 text-sm">נסה להסיר או לשנות את תנאי הסינון</p>
        </div>
      )}
    </div>
  )
}
