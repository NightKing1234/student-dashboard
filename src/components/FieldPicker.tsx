import { useMemo, useState } from 'react'
import { ALL_FIELDS, FIELD_ORDER, type FieldGroup } from '@/config/fields'

interface Props {
  selected: string[]
  onToggle: (key: string) => void
  onClose: () => void
}

/** בורר שדות — הוספה/הסרה של שדות מתוך כל ~130 השדות (אפיון §6.1). */
export default function FieldPicker({ selected, onToggle, onClose }: Props) {
  const [query, setQuery] = useState('')
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const grouped = useMemo(() => {
    const q = query.trim()
    const map = new Map<FieldGroup, typeof ALL_FIELDS>()
    for (const f of ALL_FIELDS) {
      if (q && !f.label.includes(q)) continue
      const arr = map.get(f.group) ?? []
      arr.push(f)
      map.set(f.group, arr)
    }
    return map
  }, [query])

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-black/30" onClick={onClose}>
      <div
        className="thin-scrollbar h-full w-80 overflow-y-auto bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">בורר שדות</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <input
          type="search"
          placeholder="חיפוש שדה…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        />

        {FIELD_ORDER.map((group) => {
          const fields = grouped.get(group)
          if (!fields || fields.length === 0) return null
          return (
            <div key={group} className="mb-4">
              <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">{group}</h3>
              <ul className="space-y-0.5">
                {fields.map((f) => (
                  <li key={f.key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(f.key)}
                        onChange={() => onToggle(f.key)}
                        className="accent-brand-600"
                      />
                      <span className="text-slate-700">{f.label}</span>
                      {f.computed && (
                        <span className="text-[10px] text-amber-600">מחושב</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
