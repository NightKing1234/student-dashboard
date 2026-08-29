import { useEffect, useState } from 'react'
import { fetchAuditLog, type AuditEntry } from '@/lib/admin'

/** תוויות עבריות לעמודות שמופיעות ביומן. */
const FIELD_LABELS: Record<string, string> = {
  role: 'תפקיד',
  is_suspended: 'השהיה',
  authority_codes: 'שיוך לרשויות',
  scope_level: 'רמת היקף',
  scope_values: 'ערכי היקף',
  display_name: 'שם לתצוגה',
  email: 'מייל',
  job_title: 'תפקיד (תיאור)',
  institution_name: 'מוסד',
  institution_code: 'סמל מוסד',
  is_service_account: 'חשבון שירות',
  name: 'שם',
  is_active: 'פעילה',
  moe_code: 'קוד משרד החינוך',
}

const ACTION: Record<AuditEntry['action'], { text: string; tone: string }> = {
  insert: { text: 'נוצר', tone: 'bg-emerald-50 text-emerald-700' },
  update: { text: 'עודכן', tone: 'bg-sky-50 text-sky-700' },
  delete: { text: 'נמחק', tone: 'bg-red-50 text-red-700' },
}

const ENTITY: Record<AuditEntry['entity'], string> = {
  user: 'משתמש',
  authority: 'מועצה',
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'כן' : 'לא'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  return String(v)
}

/** אילו שדות השתנו — רק הם, ולא כל השורה. */
function summarize(e: AuditEntry): string {
  if (!e.changes) return ''
  if (e.action !== 'update') return ''
  return Object.keys(e.changes)
    .filter((k) => k !== 'updated_at')
    .map((k) => {
      const c = e.changes![k]
      const label = FIELD_LABELS[k] ?? k
      return `${label}: ${show(c?.['לפני'])} ← ${show(c?.['אחרי'])}`
    })
    .join(' · ')
}

/**
 * יומן פעולות הניהול.
 *
 * נבנה אחרי שחשבון מנהל-על נמחק ואיש לא ידע מתי, מי, או שזה בכלל קרה —
 * הגילוי היה מקרי, בהשוואה לתמונת מצב ישנה.
 */
export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || entries) return
    fetchAuditLog(50)
      .then(setEntries)
      .catch((e) => setError((e as Error).message))
  }, [open, entries])

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-right"
      >
        <span className="font-bold text-sky-800">יומן פעולות ניהול</span>
        <span className="text-sm text-slate-400">
          {open ? 'הסתר ▲' : 'הצג ▼'}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          <p className="mb-4 text-xs text-slate-400">
            כל יצירה, עדכון ומחיקה של משתמש או מועצה. נכתב אוטומטית ואינו
            ניתן לעריכה או למחיקה — גם לא למנהל-על.
          </p>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
              שגיאה: {error}
            </p>
          )}

          {!entries && !error && <p className="text-sm text-slate-400">טוען…</p>}

          {entries?.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              עדיין אין רשומות. היומן מתחיל מרגע התקנתו.
            </p>
          )}

          {!!entries?.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="px-2 py-2 font-medium">מתי</th>
                    <th className="px-2 py-2 font-medium">מה</th>
                    <th className="px-2 py-2 font-medium">על מי</th>
                    <th className="px-2 py-2 font-medium">מי ביצע</th>
                    <th className="px-2 py-2 font-medium">פרטים</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const a = ACTION[e.action]
                    return (
                      <tr key={e.id} className="border-b border-slate-100 align-top">
                        <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                          {new Date(e.at).toLocaleString('he-IL', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${a.tone}`}>
                            {ENTITY[e.entity]} {a.text}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-medium text-slate-700">
                          {e.entity_label ?? e.entity_id ?? '—'}
                        </td>
                        <td className="px-2 py-2 text-slate-500">
                          {e.actor_email ?? (
                            <span
                              title="הפעולה רצה דרך פונקציית השרת עם service_role, שאינה נושאת זהות משתמש"
                              className="text-slate-400"
                            >
                              דרך השרת
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-500">
                          {summarize(e)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
