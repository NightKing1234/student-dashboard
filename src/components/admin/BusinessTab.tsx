import { useEffect, useState } from 'react'
import {
  fetchClient,
  fetchDocuments,
  saveClient,
  updateAuthority,
  uploadDocument,
  deleteDocument,
  documentUrl,
  authorityFootprint,
  deleteAuthority,
  TEMPLATE_AUTHORITY_CODE,
  type Authority,
  type Client,
  type ClientDocument,
  type DeletedAuthoritySummary,
} from '@/lib/admin'

interface Props {
  code: string
  /** הרשות עצמה — לעריכת השם ומצב הפעילות */
  authority: Authority | null
  /** מרענן את הכותרת אחרי שינוי שם */
  onAuthorityChange: (patch: { name?: string; is_active?: boolean }) => void
  /** המועצה נמחקה — הדף מחזיר לרשימת הלקוחות */
  onDeleted: (summary: DeletedAuthoritySummary) => void
}

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** אייקון לפי סוג הקובץ — רמז ויזואלי מהיר בתצוגת האריחים. */
function docIcon(mime: string | null) {
  if (!mime) return '📄'
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('image')) return '🖼'
  if (mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.includes('word') || mime.includes('document')) return '📘'
  return '📄'
}

/** מסך 1 — התנהלות עסקית: מועדי תשלום, חידוש הסכם ומסמכים מצורפים. */
export default function BusinessTab({
  code,
  authority,
  onAuthorityChange,
  onDeleted,
}: Props) {
  const [client, setClient] = useState<Client | null>(null)
  const [docs, setDocs] = useState<ClientDocument[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // עריכת שם הרשות — טיוטה מקומית עד לשמירה
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  // מחיקת המועצה — נפתח רק בבקשה מפורשת, ודורש הקלדת השם
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [footprint, setFootprint] = useState<Awaited<
    ReturnType<typeof authorityFootprint>
  > | null>(null)

  const isTemplate = code === TEMPLATE_AUTHORITY_CODE

  async function openDelete() {
    setDeleteOpen(true)
    setDeleteName('')
    setFootprint(null)
    try {
      setFootprint(await authorityFootprint(code))
    } catch {
      // ספירה שנכשלה לא חוסמת — הפונקציה במסד סופרת בעצמה
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    setError(null)
    try {
      const summary = await deleteAuthority(code, deleteName.trim())
      onDeleted(summary)
    } catch (e) {
      setError((e as Error).message)
      setDeleting(false)
    }
  }

  useEffect(() => {
    setNameDraft(authority?.name ?? '')
    setNameSaved(false)
  }, [authority?.name])

  async function saveName() {
    const name = nameDraft.trim()
    if (!authority || !name || name === authority.name) return
    setSavingName(true)
    setError(null)
    try {
      await updateAuthority(code, { name })
      onAuthorityChange({ name })
      setNameSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingName(false)
    }
  }

  async function toggleActive() {
    if (!authority) return
    const next = !authority.is_active
    setError(null)
    try {
      await updateAuthority(code, { is_active: next })
      onAuthorityChange({ is_active: next })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    fetchClient(code).then(setClient).catch((e) => setError(e.message))
    fetchDocuments(code).then(setDocs).catch((e) => setError(e.message))
  }, [code])

  function field<K extends keyof Client>(key: K, value: Client[K]) {
    setClient((c) => (c ? { ...c, [key]: value } : c))
    setSavedAt(null)
  }

  async function handleSave() {
    if (!client) return
    setSaving(true)
    setError(null)
    try {
      await saveClient(client)
      setSavedAt(new Date().toLocaleTimeString('he-IL'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(code, file, file.name)
      }
      setDocs(await fetchDocuments(code))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function openDoc(doc: ClientDocument) {
    const url = await documentUrl(doc)
    if (url) window.open(url, '_blank', 'noopener')
  }

  async function removeDoc(doc: ClientDocument) {
    if (!confirm(`למחוק את "${doc.title}"?`)) return
    try {
      await deleteDocument(doc)
      setDocs((d) => d.filter((x) => x.id !== doc.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!client) return <p className="text-slate-400">טוען…</p>

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300'

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">שגיאה: {error}</p>
      )}

      {/* פרטי המועצה — שם וקוד */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-bold text-sky-800">פרטי המועצה</h3>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">שם המועצה</span>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value)
                  setNameSaved(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                placeholder="מטה מנשה"
              />
              <button
                onClick={saveName}
                disabled={
                  savingName ||
                  !nameDraft.trim() ||
                  nameDraft.trim() === authority?.name
                }
                className="shrink-0 rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-40"
              >
                {savingName ? 'שומר…' : 'שינוי'}
              </button>
            </div>
            {nameSaved && (
              <span className="mt-1 block text-xs text-emerald-600">השם עודכן</span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">
              קוד רשות <span className="text-xs text-slate-400">(קבוע)</span>
            </span>
            <input
              dir="ltr"
              value={code}
              readOnly
              disabled
              title="הקוד מזהה את טבלת התלמידים ולכן אינו ניתן לשינוי"
              className={inputClass + ' cursor-not-allowed bg-slate-50 font-mono text-slate-500'}
            />
          </label>

          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={authority?.is_active ?? true}
              onChange={toggleActive}
              className="accent-sky-600"
            />
            <span className="text-sm text-slate-600">מועצה פעילה</span>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          קוד הרשות מרכיב את שם טבלת התלמידים ולכן אינו ניתן לשינוי. מועצה
          שאינה פעילה נשארת עם כל הנתונים שלה ורק מסומנת ככזו.
        </p>
      </section>

      {/* פרטי קשר */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-bold text-sky-800">פרטי קשר ברשות</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">איש קשר</span>
            <input
              className={inputClass}
              value={client.contact_name ?? ''}
              onChange={(e) => field('contact_name', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">מייל</span>
            <input
              type="email"
              dir="ltr"
              className={inputClass}
              value={client.contact_email ?? ''}
              onChange={(e) => field('contact_email', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">טלפון</span>
            <input
              dir="ltr"
              className={inputClass}
              value={client.contact_phone ?? ''}
              onChange={(e) => field('contact_phone', e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* התנהלות כספית */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-bold text-sky-800">התנהלות כספית</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">שולם לאחרונה</span>
            <input
              type="date"
              className={inputClass}
              value={client.last_payment_date ?? ''}
              onChange={(e) => field('last_payment_date', e.target.value || null)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">התשלום הבא</span>
            <input
              type="date"
              className={inputClass}
              value={client.next_payment_date ?? ''}
              onChange={(e) => field('next_payment_date', e.target.value || null)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">חידוש הסכם</span>
            <input
              type="date"
              className={inputClass}
              value={client.contract_renewal ?? ''}
              onChange={(e) => field('contract_renewal', e.target.value || null)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">עלות שנתית (₪)</span>
            <input
              type="number"
              className={inputClass}
              value={client.annual_fee ?? ''}
              onChange={(e) =>
                field('annual_fee', e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm text-slate-600">הערות</span>
          <textarea
            rows={3}
            className={inputClass}
            value={client.notes ?? ''}
            onChange={(e) => field('notes', e.target.value)}
          />
        </label>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'שומר…' : 'שמירה'}
          </button>
          {savedAt && <span className="text-sm text-emerald-600">נשמר ב-{savedAt}</span>}
        </div>
      </section>

      {/* מסמכים */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-sky-800">מסמכים מצורפים</h3>
          <label className="cursor-pointer rounded-lg border border-dashed border-sky-400 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
            {uploading ? 'מעלה…' : '+ הוסף מסמך'}
            <input
              type="file"
              multiple
              hidden
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
        </div>

        {docs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            אין עדיין מסמכים. חוזים, חשבוניות ואישורים — הכל כאן.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="text-4xl">{docIcon(doc.mime_type)}</div>
                <p
                  title={doc.title}
                  className="line-clamp-2 text-sm font-medium text-slate-700"
                >
                  {doc.title}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(doc.uploaded_at).toLocaleDateString('he-IL')} · {fmtSize(doc.size_bytes)}
                </p>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <button
                    onClick={() => openDoc(doc)}
                    className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700"
                  >
                    פתיחה
                  </button>
                  <button
                    onClick={() => removeDoc(doc)}
                    className="rounded-lg px-2 py-1 text-xs text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* מחיקת המועצה — פעולה בלתי הפיכה, ולכן מופרדת ויזואלית ונעולה מאחורי הקלדת השם */}
      {!isTemplate && (
        <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
          <h3 className="mb-1 font-bold text-red-800">מחיקת המועצה</h3>
          <p className="mb-4 text-sm text-slate-600">
            מוחקת את המועצה על כל נתוניה — טבלת התלמידים, קובצי המצב״ת
            שהועלו, המסמכים והשיוכים. <strong>אין דרך לשחזר.</strong> אם
            המטרה היא רק להפסיק להשתמש במועצה — עדיף להסיר את הסימון
            &quot;מועצה פעילה&quot; למעלה, וכל הנתונים יישמרו.
          </p>

          {!deleteOpen ? (
            <button
              onClick={openDelete}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-600 hover:text-white"
            >
              מחיקת המועצה…
            </button>
          ) : (
            <div className="rounded-xl border border-red-300 bg-white p-4">
              <p className="text-sm text-slate-700">
                עומדים להימחק לצמיתות עבור <strong>{authority?.name}</strong>:
              </p>

              <ul className="my-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                {footprint ? (
                  <>
                    <li>• {footprint.students.toLocaleString('he-IL')} תלמידים</li>
                    <li>• {footprint.files} קובצי מצב״ת ב-Storage</li>
                    <li>• {footprint.uploads} רשומות עדכון</li>
                    <li>• {footprint.documents} מסמכים מצורפים</li>
                    {footprint.users > 0 && (
                      <li className="font-medium text-red-700 sm:col-span-2">
                        • {footprint.users} משתמשים יאבדו את השיוך למועצה זו
                      </li>
                    )}
                  </>
                ) : (
                  <li className="text-slate-400">סופר…</li>
                )}
              </ul>

              <label className="block">
                <span className="mb-1 block text-sm text-slate-600">
                  לאישור, הקלד את שם המועצה במדויק:{' '}
                  <strong className="text-slate-800">{authority?.name}</strong>
                </span>
                <input
                  className={inputClass + ' max-w-sm'}
                  value={deleteName}
                  onChange={(e) => setDeleteName(e.target.value)}
                  placeholder={authority?.name ?? ''}
                  autoFocus
                />
              </label>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={confirmDelete}
                  disabled={deleting || deleteName.trim() !== authority?.name}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-40"
                >
                  {deleting ? 'מוחק…' : 'מחיקה סופית'}
                </button>
                <button
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                  className="text-sm text-slate-500 transition hover:text-slate-800"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
