import PublicLayout from '@/components/PublicLayout'
import Logo from '@/components/brand/Logo'
import { SITE } from '@/config/site'
import { IconBadge, IconLayers } from '@/components/brand/Icons'

/**
 * פרטי קשר — הדף שמציג את מאיר יפה: הרקע המקצועי, התפיסה שבבסיס
 * הפעילות, המעמד מול משרד החינוך, ודרכי ההתקשרות.
 *
 * הופרד מדף "אודות האתר" בכוונה: שם מוסבר **המוצר**, וכאן מוצג **האדם**.
 * ערבוב השניים באותו דף החליש את שניהם.
 */

const { owner } = SITE

const phoneHref = `tel:${owner.phone.replace(/-/g, '')}`
/** וואטסאפ דורש מספר בפורמט בינלאומי, בלי אפס מוביל ובלי מקפים */
const whatsappHref = `https://wa.me/972${owner.phone.replace(/-/g, '').slice(1)}`

export default function Contact() {
  return (
    <PublicLayout>
      {/* ═══════════ כותרת ═══════════ */}
      <section className="border-b border-slate-200 bg-gradient-to-bl from-sky-50 via-white to-emerald-50/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <div className="flex flex-wrap items-center gap-6">
            <Logo className="h-24 w-24 shrink-0" />
            <div className="min-w-[15rem] flex-1">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                {owner.name}
              </h1>
              <p className="mt-2 text-lg font-medium text-sky-700">{owner.role}</p>
            </div>
          </div>

          <p className="mt-8 text-lg leading-relaxed text-slate-600">{owner.summary}</p>

          {/* מספרים */}
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {owner.stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-sky-800">{s.value}</div>
                <div className="mt-0.5 text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-14">
        {/* ═══════════ התפיסה ═══════════ */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 sm:p-10">
          <div
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
            style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }}
            aria-hidden
          />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-sky-300">
              <IconLayers className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">
              {owner.concept.title}
            </h2>
            <p className="mt-3 leading-relaxed text-slate-300">{owner.concept.body}</p>
          </div>
        </section>

        {/* ═══════════ רקע מקצועי ═══════════ */}
        <section className="mt-12 space-y-4 leading-relaxed text-slate-600">
          {owner.bio.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {/* ═══════════ מעמד מול משרד החינוך ═══════════ */}
        <section className="mt-12">
          <h2 className="text-sm font-bold uppercase tracking-wider text-sky-600">
            מול משרד החינוך
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {owner.credentials.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <IconBadge className="h-6 w-6" />
                </div>
                <h3 className="mt-3 font-bold text-slate-800">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ ניסיון ותחומי ייעוץ ═══════════ */}
        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-600">
              ניסיון ניהולי
            </h2>
            <ol className="mt-4 space-y-0">
              {owner.experience.map((e, i) => (
                <li key={e.years} className="flex gap-4">
                  {/* ציר זמן: נקודה וקו מקשר */}
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-600 ring-4 ring-sky-100" />
                    {i < owner.experience.length - 1 && (
                      <span className="w-px flex-1 bg-slate-200" />
                    )}
                  </div>
                  <div className="pb-6">
                    <div dir="ltr" className="text-right font-mono text-xs text-sky-700">
                      {e.years}
                    </div>
                    <div className="mt-0.5 text-slate-700">{e.what}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-600">
              תחומי הייעוץ
            </h2>
            <ul className="mt-4 space-y-2.5">
              {owner.services.map((s) => (
                <li key={s} className="flex gap-3 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ═══════════ יצירת קשר ═══════════ */}
        <section className="mt-14 rounded-3xl border border-sky-200 bg-sky-50 p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-sky-900">יצירת קשר</h2>
          <p className="mt-2 text-sky-900/70">
            לשאלות על המערכת, להתאמה לרשות שלכם או לתיאום הדגמה.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <a
              href={phoneHref}
              className="group rounded-2xl border border-sky-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
            >
              <div className="text-xs font-semibold text-slate-400">טלפון</div>
              <div dir="ltr" className="mt-1 text-lg font-bold text-slate-800">
                {owner.phone}
              </div>
            </a>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-emerald-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
            >
              <div className="text-xs font-semibold text-slate-400">וואטסאפ</div>
              <div className="mt-1 text-lg font-bold text-emerald-700">
                שליחת הודעה
              </div>
            </a>

            <a
              href={`mailto:${owner.email}`}
              className="group rounded-2xl border border-sky-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
            >
              <div className="text-xs font-semibold text-slate-400">דואר אלקטרוני</div>
              <div dir="ltr" className="mt-1 truncate text-lg font-bold text-slate-800">
                {owner.email}
              </div>
            </a>
          </div>

          <a
            href={`https://${owner.website}`}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="mt-5 inline-block text-sky-700 transition hover:underline"
          >
            {owner.website}
          </a>
        </section>
      </div>
    </PublicLayout>
  )
}
