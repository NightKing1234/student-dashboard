import { Link } from 'react-router-dom'
import PublicLayout from '@/components/PublicLayout'
import { SITE, HIGHLIGHTS } from '@/config/site'
import { LOGO_GREEN } from '@/components/brand/Logo'
import {
  IconFilter,
  IconCard,
  IconFamily,
  IconPivot,
  IconExport,
  IconRefresh,
  IconLayers,
  IconLock,
  IconBadge,
} from '@/components/brand/Icons'

/**
 * דף הבית הציבורי — מה שרואים **לפני** הכניסה.
 *
 * אין כאן שום גישה לנתונים: הדף נטען למי שאינו מחובר, ו-RLS ממילא חוסם
 * כל שאילתה. גם התצוגה המקדימה של הטבלה היא שלד ריק ולא נתוני אמת.
 *
 * כל הגרפיקה מוטבעת (SVG ו-CSS) ואין תלות בקובץ תמונה חיצוני — טעינה
 * מיידית, חדות בכל רזולוציה, ובלי בקשה לשרת של צד שלישי בדף שמועצות
 * נכנסות אליו.
 */

/** קווי רשת עדינים ברקע הכותרת — נותנים מרקם בלי להסיח */
const GRID = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M48 0H0v48' fill='none' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='1'/%3E%3C/svg%3E")`

const FEATURES = [
  {
    Icon: IconFilter,
    title: 'סינון כמו שאתם רגילים',
    body: 'לחיצה על עמודה פותחת את כל הערכים שבה לפי א״ב, עם תיבת סימון לכל אחד. שלושה יישובים נבחרים יחד — במקום שלושה סינונים נפרדים.',
  },
  {
    Icon: IconCard,
    title: 'כרטיס תלמיד מלא',
    body: 'כל פרטי התלמיד מסודרים בקבוצות — פרטים אישיים, מוסד, כתובת והורים — עם מעבר להבא ולקודם בתוך תוצאות הסינון.',
  },
  {
    Icon: IconFamily,
    title: 'זיהוי אחים',
    body: 'לחיצה על תעודת הזהות של הורה מציגה מיד את כל ילדיו במערכת. כלי קריטי במצבי חירום ובאיתור משפחתי.',
  },
  {
    Icon: IconPivot,
    title: 'דוחות סיכום',
    body: 'כמה תלמידים בכל מוסד, בכל שכבה ובכל יישוב — כולל תלמידי חוץ ותושבים שלומדים מחוץ לרשות. מסננים, והדוח מתחולל על מה שנבחר.',
  },
  {
    Icon: IconExport,
    title: 'ייצוא לאקסל מעוצב',
    body: 'כל תמהיל שדות יוצא לקובץ מוכן לשליחה: כותרת מוקפאת, עיצוב מסודר וסינון אוטומטי — בלי לסדר ידנית.',
  },
  {
    Icon: IconRefresh,
    title: 'עדכון חודשי אוטומטי',
    body: 'ששת קבצי משרד החינוך מעובדים מעצמם ונטענים למערכת. לפני כל עדכון נשמר גיבוי של הנתונים הקודמים.',
  },
]

const PRIVACY = [
  {
    Icon: IconLayers,
    title: 'רשות = עולם',
    body: 'לכל רשות נתונים נפרדים לחלוטין. ההפרדה נאכפת במסד הנתונים עצמו, לא בתצוגה.',
  },
  {
    Icon: IconBadge,
    title: 'הרשאות מדורגות',
    body: 'אפשר להגביל משתמש ליישובים או לבתי ספר מסוימים. מנהל בית ספר יראה את תלמידיו בלבד.',
  },
  {
    Icon: IconLock,
    title: 'בלי קבצים שמסתובבים',
    body: 'במקום לשלוח אקסלים עם תעודות זהות בדואר, כל אחד נכנס ורואה רק את מה שמותר לו.',
  },
]

const STEPS = [
  { title: 'הקבצים מגיעים', body: 'ששת קובצי המצב״ת של משרד החינוך, בתחילת כל חודש' },
  { title: 'העיבוד רץ מעצמו', body: 'איחוד הקבצים, ניקוי כפילויות, תרגום קודים והשלמת שדות' },
  { title: 'הנתונים מוכנים', body: 'טבלה אחת מלאה — לסינון, לכרטיס, לדוח ולייצוא' },
]

/** תצוגה מקדימה של הטבלה — שלד בלבד, בלי נתונים אמיתיים */
function TablePreview() {
  const columns = ['שם משפחה', 'שם פרטי', 'שם מוסד', 'שכבה', 'יישוב']
  const widths = [
    [70, 55, 90, 24, 62],
    [58, 66, 78, 24, 54],
    [76, 48, 96, 24, 70],
    [62, 60, 84, 24, 58],
    [70, 52, 74, 24, 66],
    [54, 64, 92, 24, 50],
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl shadow-sky-950/40">
      {/* סרגל עליון של החלון */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="mr-2 text-[11px] font-medium text-slate-400">
          ניהול נתוני תלמידים
        </span>
      </div>

      {/* שבב סינון פעיל */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
        <span className="flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
          <IconFilter className="h-3 w-3" />
          יישוב · 3 נבחרו
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
          שכבה · ז׳–ט׳
        </span>
      </div>

      {/* כותרות */}
      <div className="flex bg-sky-50/70 px-4 py-2 text-[11px] font-semibold text-sky-800">
        {columns.map((c) => (
          <div key={c} className="flex-1 whitespace-nowrap">
            {c}
          </div>
        ))}
      </div>

      {/* שורות — פסים אפורים, לא נתונים */}
      <div className="px-4 pb-3">
        {widths.map((row, i) => (
          <div
            key={i}
            className={
              'flex items-center gap-2 border-b border-slate-50 py-2.5 last:border-0 ' +
              (i === 1 ? 'bg-sky-50/40' : '')
            }
          >
            {row.map((w, j) => (
              <div key={j} className="flex-1">
                <div
                  className="h-2 rounded-full bg-slate-200"
                  style={{ width: `${w}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <PublicLayout transparentNav>
      {/* ═══════════════ כותרת ראשית ═══════════════ */}
      <section className="relative overflow-hidden bg-slate-900">
        {/* שכבות רקע: גרדיאנט עומק, רשת עדינה, והילות צבע */}
        <div
          className="absolute inset-0 bg-gradient-to-bl from-sky-950 via-slate-900 to-slate-950"
          aria-hidden
        />
        <div className="absolute inset-0" style={{ backgroundImage: GRID }} aria-hidden />
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-56 left-0 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: `radial-gradient(circle, ${LOGO_GREEN} 0%, transparent 70%)` }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-32 sm:pb-28 sm:pt-36">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            {/* טקסט */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] text-sky-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                למועצות אזוריות ולרשויות מקומיות
              </span>

              <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.15] tracking-tight text-white sm:text-5xl">
                {SITE.tagline}
                <span className="mt-2 block bg-gradient-to-l from-sky-300 to-emerald-300 bg-clip-text text-transparent">
                  {SITE.subline}
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
                נתוני מצב״ת של משרד החינוך מגיעים בששה קבצים נפרדים ולא שמישים.
                המערכת מאחדת ומעבדת אותם אוטומטית, ונותנת טבלה אחת שאפשר לעבוד
                איתה מכל מקום — בלי אקסלים שרצים מצד לצד.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="rounded-xl bg-white px-7 py-3.5 font-bold text-slate-900 shadow-lg shadow-sky-950/50 transition hover:bg-slate-100"
                >
                  כניסה למערכת ←
                </Link>
                <Link
                  to="/about"
                  className="rounded-xl border border-white/20 px-7 py-3.5 font-medium text-white transition hover:border-white/40 hover:bg-white/5"
                >
                  מה יש במערכת
                </Link>
              </div>
            </div>

            {/* תצוגה מקדימה */}
            <div className="relative lg:mt-4">
              <div
                className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-sky-500/10 to-emerald-400/10 blur-2xl"
                aria-hidden
              />
              <div className="relative">
                <TablePreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ מספרים ═══════════════ */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl divide-y divide-slate-100 px-6 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-x-reverse">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="px-2 py-8 text-center">
              <div className="text-4xl font-bold tracking-tight text-sky-800">
                {h.value}
              </div>
              <div className="mt-1.5 text-sm font-semibold text-slate-700">{h.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-400">{h.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ איך זה עובד ═══════════════ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-sky-600">
            התהליך
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            שלושה שלבים, שניים מהם אוטומטיים
          </h2>
        </div>

        <div className="relative mt-14 grid gap-8 sm:grid-cols-3">
          {/* קו מקשר מאחורי המספרים */}
          <div
            className="absolute right-[16%] left-[16%] top-6 hidden h-px bg-gradient-to-l from-sky-200 via-sky-300 to-sky-200 sm:block"
            aria-hidden
          />
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-sky-700 text-lg font-bold text-white shadow-md">
                {i + 1}
              </div>
              <h3 className="mt-4 font-bold text-slate-800">{s.title}</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ פיצ'רים ═══════════════ */}
      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-sky-600">
              היכולות
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              מה יש במערכת
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100 transition group-hover:bg-sky-700 group-hover:text-white">
                  <Icon />
                </div>
                <h3 className="mt-4 font-bold text-slate-800">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ פרטיות ═══════════════ */}
      <section className="relative overflow-hidden bg-slate-900 py-20">
        <div className="absolute inset-0" style={{ backgroundImage: GRID }} aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-sky-400">
              אבטחת מידע
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
              הנתונים כוללים תעודות זהות של קטינים
            </h2>
            <p className="mt-3 leading-relaxed text-slate-400">
              המערכת נבנתה סביב ההנחה הזו, ולא הוסיפה אותה בדיעבד.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PRIVACY.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                  <Icon />
                </div>
                <h3 className="mt-4 font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ קריאה לפעולה ═══════════════ */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            כבר יש לכם משתמש?
          </h2>
          <p className="mx-auto mt-3 max-w-lg leading-relaxed text-slate-500">
            היכנסו עם המייל והסיסמה שקיבלתם, ותגיעו ישירות לנתוני הרשות שלכם.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="rounded-xl bg-sky-700 px-8 py-3.5 font-bold text-white shadow-sm transition hover:bg-sky-800"
            >
              כניסה למערכת ←
            </Link>
            <Link
              to="/about"
              className="rounded-xl border border-slate-300 px-8 py-3.5 font-medium text-slate-600 transition hover:bg-slate-50"
            >
              אודות האתר
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
