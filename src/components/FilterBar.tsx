import { ALL_FIELDS, getField } from '@/config/fields'
import {
  operatorsForType,
  type FilterCondition,
  type FilterOperator,
} from '@/lib/filters'

interface Props {
  conditions: FilterCondition[]
  onChange: (conditions: FilterCondition[]) => void
}

function newId() {
  return Math.random().toString(36).slice(2, 9)
}

/** האם האופרטור לא דורש ערך */
function isValueless(op: FilterOperator) {
  return op === 'empty' || op === 'not_empty'
}

/** סרגל סינון — אפיון §6.3. שילוב מספר סינונים ב-AND. */
export default function FilterBar({ conditions, onChange }: Props) {
  function update(id: string, patch: Partial<FilterCondition>) {
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function remove(id: string) {
    onChange(conditions.filter((c) => c.id !== id))
  }

  function add() {
    const first = ALL_FIELDS[0]
    onChange([
      ...conditions,
      { id: newId(), field: first.key, operator: 'contains', value: '' },
    ])
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-2">
      {conditions.map((c) => {
        const field = getField(c.field)
        const ops = operatorsForType(field?.type ?? 'text')
        // אם האופרטור הנוכחי לא תקף לסוג השדה, נופלים לראשון הזמין
        const op = ops.some((o) => o.op === c.operator) ? c.operator : ops[0].op
        return (
          <div
            key={c.id}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-sm shadow-sm"
          >
            <select
              value={c.field}
              onChange={(e) => update(c.id, { field: e.target.value })}
              className="max-w-[9rem] rounded bg-transparent py-0.5 focus:outline-none"
            >
              {ALL_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              value={op}
              onChange={(e) =>
                update(c.id, { operator: e.target.value as FilterOperator })
              }
              className="rounded bg-slate-100 py-0.5 focus:outline-none"
            >
              {ops.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>

            {!isValueless(op) && op !== 'between' && op !== 'one_of' && (
              <input
                type={field?.type === 'date' ? 'date' : 'text'}
                value={c.value ?? ''}
                onChange={(e) => update(c.id, { value: e.target.value })}
                placeholder="ערך"
                className="w-24 rounded border border-slate-200 px-1.5 py-0.5 focus:border-brand-500 focus:outline-none"
              />
            )}

            {op === 'between' && (
              <>
                <input
                  type={field?.type === 'date' ? 'date' : 'text'}
                  value={c.value ?? ''}
                  onChange={(e) => update(c.id, { value: e.target.value })}
                  placeholder="מ"
                  className="w-20 rounded border border-slate-200 px-1.5 py-0.5 focus:border-brand-500 focus:outline-none"
                />
                <span className="text-slate-400">–</span>
                <input
                  type={field?.type === 'date' ? 'date' : 'text'}
                  value={c.value2 ?? ''}
                  onChange={(e) => update(c.id, { value2: e.target.value })}
                  placeholder="עד"
                  className="w-20 rounded border border-slate-200 px-1.5 py-0.5 focus:border-brand-500 focus:outline-none"
                />
              </>
            )}

            {op === 'one_of' && (
              <input
                type="text"
                value={(c.values ?? []).join(', ')}
                onChange={(e) =>
                  update(c.id, {
                    values: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="ערכים מופרדים בפסיק"
                className="w-40 rounded border border-slate-200 px-1.5 py-0.5 focus:border-brand-500 focus:outline-none"
              />
            )}

            <button
              onClick={() => remove(c.id)}
              className="px-1 text-slate-400 hover:text-red-600"
              title="הסר סינון"
            >
              ✕
            </button>
          </div>
        )
      })}

      <button
        onClick={add}
        className="rounded-lg border border-dashed border-brand-400 px-2 py-1 text-sm text-brand-700 hover:bg-brand-50"
      >
        + הוסף סינון
      </button>

      {conditions.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-sm text-slate-500 hover:text-red-600"
        >
          נקה הכל
        </button>
      )}
    </div>
  )
}
