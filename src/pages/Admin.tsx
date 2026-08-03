import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  fetchAuthorities,
  fetchClients,
  countStudents,
  type Authority,
  type Client,
} from '@/lib/admin'

interface CardData {
  authority: Authority
  client: Client | null
  students: number
}

/** מתי מועד קרוב מספיק כדי להדליק נורה — 30 יום. */
const SOON_DAYS = 30

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** סטטוס מועד: פג / קרוב / תקין — לצביעת התגית בכרטיס. */
function dateStatus(date: string | null) {
  const days = daysUntil(date)
  if (date === null || days === null) return { tone: 'text-slate-400', text: '—' }
  if (days < 0) return { tone: 'text-red-600 font-semibold', text: `באיחור ${-days} ימים` }
  if (days <= SOON_DAYS) return { tone: 'text-amber-600 font-semibold', text: `בעוד ${days} ימים` }
  return { tone: 'text-slate-600', text: new Date(date).toLocaleDateString('he-IL') }
}

/** מסך המנהל — כרטיס לקוח לכל מועצה אזורית. */
export default function Admin() {
  const { profile, signOut } = useAuth()
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [authorities, clients] = await Promise.all([fetchAuthorities(), fetchClients()])
        const withCounts = await Promise.all(
          authorities.map(async (a) => ({
            authority: a,
            client: clients.find((c) => c.authority_code === a.code) ?? null,
            students: await countStudents(a.code),
          })),
        )
        if (active) setCards(withCounts)
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-full bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-sky-800">ניהול לקוחות</h1>
          <p className="text-sm text-slate-500">מועצות אזוריות ובתי ספר במערכת</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{profile?.display_name ?? profile?.email}</span>
          <button
            onClick={signOut}
            className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          >
            יציאה
          </button>
        </div>
      </header>

      <main className="p-6">
        {loading && <p className="text-slate-400">טוען לקוחות…</p>}
        {error && <p className="text-red-600">שגיאה: {error}</p>}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ authority, client, students }) => {
            const payment = dateStatus(client?.next_payment_date ?? null)
            const renewal = dateStatus(client?.contract_renewal ?? null)
            return (
              <Link
                key={authority.code}
                to={`/admin/client/${authority.code}`}
                className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg"
              >
                {/* פס עליון צבעוני */}
                <div className="h-1.5 bg-gradient-to-l from-sky-400 to-sky-600" />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 group-hover:text-sky-700">
                        {authority.name}
                      </h2>
                      <p className="font-mono text-xs text-slate-400" dir="ltr">
                        {authority.code}
                      </p>
                    </div>
                    {!authority.is_active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        לא פעיל
                      </span>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-center">
                    <div className="text-2xl font-bold text-sky-700">
                      {students.toLocaleString('he-IL')}
                    </div>
                    <div className="text-xs text-sky-600">תלמידים במערכת</div>
                  </div>

                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">תשלום הבא</dt>
                      <dd className={payment.tone}>{payment.text}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">חידוש הסכם</dt>
                      <dd className={renewal.tone}>{renewal.text}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">איש קשר</dt>
                      <dd className="truncate text-slate-700">{client?.contact_name || '—'}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            )
          })}
        </div>

        {!loading && cards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
            <div className="text-3xl">🏛</div>
            <p className="mt-2">אין עדיין מועצות במערכת</p>
          </div>
        )}
      </main>
    </div>
  )
}
