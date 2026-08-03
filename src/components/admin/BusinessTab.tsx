import { useEffect, useState } from 'react'
import {
  fetchClient,
  fetchDocuments,
  saveClient,
  uploadDocument,
  deleteDocument,
  documentUrl,
  type Client,
  type ClientDocument,
} from '@/lib/admin'

interface Props {
  code: string
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
export default function BusinessTab({ code }: Props) {
  const [client, setClient] = useState<Client | null>(null)
  const [docs, setDocs] = useState<ClientDocument[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

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

      {/* פרטי קשר */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-bold text-sky-800">פרטי קשר</h3>
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
                className="group relative h-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                {/* תצוגה מקדימה — נחתכת בתחתית */}
                <div className="flex h-full flex-col items-center justify-start gap-2 p-4 text-center">
                  <div className="text-4xl">{docIcon(doc.mime_type)}</div>
                  <p className="text-sm font-medium text-slate-700">{doc.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(doc.uploaded_at).toLocaleDateString('he-IL')} · {fmtSize(doc.size_bytes)}
                  </p>
                </div>

                {/* ערפל בתחתית — רומז שיש עוד, ומכיל את הפעולות */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/85 to-transparent backdrop-blur-[2px]" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3">
                  <button
                    onClick={() => openDoc(doc)}
                    className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-medium text-white shadow transition hover:bg-sky-700"
                  >
                    פתיחה
                  </button>
                  <button
                    onClick={() => removeDoc(doc)}
                    className="rounded-lg px-2 py-1 text-xs text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
