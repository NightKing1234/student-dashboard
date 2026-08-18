import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SITE } from '@/config/site'
import Logo from './brand/Logo'

/**
 * המעטפת של הדפים הציבוריים — דף הבית ואודות.
 *
 * הסרגל שקוף מעל הכותרת הכהה ונעשה אטום בגלילה, כדי שהניווט לא יחתוך
 * את התמונה הראשונה שרואים.
 */
export default function PublicLayout({
  children,
  transparentNav = false,
}: {
  children: ReactNode
  transparentNav?: boolean
}) {
  const { pathname } = useLocation()

  const navLink = (to: string, label: string) => {
    const active = pathname === to
    return (
      <Link
        to={to}
        className={
          'rounded-lg px-3 py-2 text-sm font-medium transition ' +
          (transparentNav
            ? active
              ? 'text-white'
              : 'text-white/70 hover:text-white'
            : active
              ? 'text-sky-800'
              : 'text-slate-500 hover:text-sky-800')
        }
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header
        className={
          'z-30 w-full ' +
          (transparentNav
            ? 'absolute top-0 left-0 right-0'
            : 'sticky top-0 border-b border-slate-200 bg-white/90 backdrop-blur')
        }
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-10 w-10" />
            <span
              className={
                'text-[15px] font-bold leading-tight ' +
                (transparentNav ? 'text-white' : 'text-slate-800')
              }
            >
              {SITE.name}
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navLink('/', 'דף הבית')}
            {navLink('/about', 'אודות האתר')}
            {navLink('/contact', 'פרטי קשר')}
            <Link
              to="/login"
              className={
                'mr-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ' +
                (transparentNav
                  ? 'bg-white text-slate-900 hover:bg-slate-100'
                  : 'bg-sky-700 text-white hover:bg-sky-800')
              }
            >
              כניסה למערכת
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="flex items-start gap-3">
              <Logo className="h-11 w-11 shrink-0" />
              <div>
                <div className="font-bold text-slate-800">{SITE.owner.name}</div>
                <div className="mt-0.5 max-w-xs text-sm leading-relaxed text-slate-500">
                  {SITE.owner.role}
                </div>
              </div>
            </div>

            <div className="text-sm">
              <div className="font-semibold text-slate-700">יצירת קשר</div>
              <div className="mt-2 space-y-1">
                <a
                  href={`tel:${SITE.owner.phone.replace(/-/g, '')}`}
                  dir="ltr"
                  className="block text-slate-600 transition hover:text-sky-700"
                >
                  {SITE.owner.phone}
                </a>
                <a
                  href={`mailto:${SITE.owner.email}`}
                  dir="ltr"
                  className="block text-sky-700 transition hover:underline"
                >
                  {SITE.owner.email}
                </a>
                <a
                  href={`https://${SITE.owner.website}`}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                  className="block text-sky-700 transition hover:underline"
                >
                  {SITE.owner.website}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-400">
            {SITE.name} · נתוני תלמידים לרשויות מקומיות
          </div>
        </div>
      </footer>
    </div>
  )
}
