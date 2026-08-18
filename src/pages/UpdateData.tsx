import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { fetchAuthorities, type Authority } from '@/lib/admin'
import DataTab from '@/components/admin/DataTab'

/**
 * עדכון נתוני המצב"ת — עכשיו גם למנהל הרשות עצמו.
 *
 * סבא (13.8): "שלב ב' — לאפשר גם לאדמין של רשות לעשות את אותו דבר...
 * כמו שלך יש כפתור, גם יהיה כפתור להעלות קבצים. הוא הרי יכול למשוך את
 * הקבצים בעצמו, לא חייב אותי בשביל זה."
 *
 * ההרשאה נאכפת ב-RLS ולא כאן: מדיניות `moe_uploads` ומדיניות הבאקט
 * `moe-uploads` שתיהן דורשות `has_authority(code)`. הבדיקה בדף היא
 * נוחות בלבד — משתמש שינווט לרשות אחרת פשוט לא יוכל לכתוב.
 */
export default function UpdateData() {
  const { profile } = useAuth()
  const { code = '' } = useParams()
  const [authorities, setAuthorities] = useState<Authority[]>([])

  useEffect(() => {
    fetchAuthorities().then(setAuthorities).catch(() => setAuthorities([]))
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'
  const mayUpdate =
    isSuperAdmin ||
    (profile?.role === 'admin' && (profile.authority_codes ?? []).includes(code))

  if (profile && !mayUpdate) return <Navigate to="/" replace />

  const authority = authorities.find((a) => a.code === code)

  return (
    <div className="min-h-full bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-sky-800">
              עדכון נתוני מצב״ת
              <span className="mr-2 text-base font-normal text-slate-500">
                {authority?.name ?? `רשות ${code}`}
              </span>
            </h1>
            <p className="text-sm text-slate-500">
              העלאת ששת הקבצים שהתקבלו ממשרד החינוך. העיבוד מתחיל מעצמו.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              to={`/students/${code}`}
              className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-sky-50 hover:text-sky-700"
            >
              → חזרה לטבלה
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>לפני שמעדכנים:</strong> הטבלה הקיימת נדרסת ונטענת מחדש.
          המערכת שומרת ממנה גיבוי אוטומטי לפני כל עדכון, כך שאפשר לחזור
          אחורה אם התברר שהקבצים היו שגויים.
        </div>

        <DataTab code={code} />
      </main>
    </div>
  )
}
