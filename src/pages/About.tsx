import { Link } from 'react-router-dom'
import PublicLayout from '@/components/PublicLayout'
import Logo from '@/components/brand/Logo'
import { SITE } from '@/config/site'

/** פסקה עם כותרת — מבנה חוזר בדף */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200 py-8 last:border-0">
      <h2 className="text-xl font-bold text-sky-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

/**
 * אודות האתר — ההסבר המלא, לדף ציבורי.
 *
 * נועד למי ששוקל להשתמש במערכת ורוצה להבין מה היא עושה, מאיפה הנתונים
 * מגיעים ואיך הם מוגנים.
 */
export default function About() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-bold text-slate-800">אודות {SITE.name}</h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-500">
          מערכת לניהול נתוני התלמידים של רשות מקומית, שנבנתה מתוך שנים של
          עבודה יומיומית עם מצבת התלמידים של משרד החינוך.
        </p>

        <Section title="מה זו מצב״ת">
          <p>
            בתחילת כל חודש משרד החינוך מפיץ לכל רשות מקומית שישה קבצים —
            מצבת התלמידים. הם מכילים את פרטי התלמידים, פרטי הקשר, גורמי הקשר
            (ההורים), המוסדות, הכיתות והמגמות.
          </p>
          <p>
            הקבצים אינם שמישים כמו שהם: אותו תלמיד מופיע בכמה שורות, ההורים
            יושבים בקובץ נפרד ברשומה לכל אחד, והקודים מספריים. כדי לענות על
            שאלה פשוטה כמו "כמה תלמידים יש בכל שכבה בכל בית ספר" צריך לאחד
            את הקבצים, לנקות כפילויות ולתרגם קודים.
          </p>
        </Section>

        <Section title="מה המערכת עושה">
          <p>
            המערכת מבצעת את כל העיבוד הזה אוטומטית: מאחדת את ששת הקבצים
            לטבלה אחת, מנקה כפילויות כך שלכל תעודת זהות יש שורה אחת, מתרגמת
            את הקודים לעברית, ומשלימה שדות מחושבים — כיתה משולבת, סטטוס
            חינוך מיוחד, וסטטוס התלמיד ברשות.
          </p>
          <p>
            התוצאה היא טבלה אחת עם כ-160 שדות לכל תלמיד, שאפשר לסנן לפי כל
            שדה, למיין, לפתוח ממנה כרטיס תלמיד מפורט, להפיק ממנה דוחות
            סיכום, ולייצא לאקסל בכל תמהיל שדות שרוצים.
          </p>
        </Section>

        <Section title="עקרונות שהנחו את הבנייה">
          <ul className="list-inside list-disc space-y-2">
            <li>
              <strong>הכל ואז מצמצמים</strong> — המסך נפתח עם כל תלמידי הרשות,
              ומשם מסננים. לא מתחילים מחלון חיפוש ריק.
            </li>
            <li>
              <strong>עדיף להשאיר תלמיד במערכת מאשר למחוק אותו</strong> —
              תלמידים שעזבו או שטרם שובצו נטענים ומסומנים, ולא נמחקים בעיבוד.
              מי שרוצה, מסיר את הסינון ורואה גם אותם.
            </li>
            <li>
              <strong>תא ריק במקור נשאר ריק</strong> — המערכת לא ממציאה ערכים
              ולא ממלאת ברירות מחדל.
            </li>
            <li>
              <strong>ייצוא לאקסל הוא הדוח</strong> — במקום מחולל דוחות
              מסובך, בונים תמהיל שדות, מסננים, ומייצאים.
            </li>
          </ul>
        </Section>

        <Section title="פרטיות ואבטחה">
          <p>
            הנתונים כוללים תעודות זהות, כתובות וטלפונים של קטינים, והמערכת
            נבנתה סביב ההנחה הזו.
          </p>
          <ul className="list-inside list-disc space-y-2">
            <li>
              לכל רשות נתונים נפרדים לחלוטין. ההפרדה נאכפת במסד הנתונים ולא
              בתצוגה — גם מי שינסה לעקוף את הממשק לא יגיע לרשות אחרת.
            </li>
            <li>
              אפשר להגביל משתמש ליישובים או למוסדות מסוימים בתוך הרשות.
              ההגבלה רק מצמצמת, לעולם לא מרחיבה.
            </li>
            <li>
              משתמש שהושהה נחסם מיד — גם אם הוא מחובר באותו רגע.
            </li>
            <li>
              האתר אינו מופיע במנועי חיפוש, וקובצי המצב״ת אינם נשמרים בשום
              מקום ציבורי.
            </li>
          </ul>
        </Section>

        <Section title="עדכון הנתונים">
          <p>
            העדכון החודשי רץ מעצמו: ברגע שקובצי משרד החינוך מגיעים, המערכת
            מזהה אותם, מריצה את העיבוד וטוענת את התוצאה. לפני כל טעינה נשמר
            גיבוי מלא של הנתונים הקודמים, כך שתמיד אפשר לחזור אחורה.
          </p>
          <p>
            רשות שמעדיפה לשלוט בעיתוי יכולה להעלות את הקבצים בעצמה ולעדכן
            מתי שנוח לה.
          </p>
        </Section>

        {/* הפניה לדף האדם — הרקע המקצועי ופרטי ההתקשרות יושבים שם */}
        <div className="mt-10 flex flex-wrap items-center gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <Logo className="h-14 w-14 shrink-0" />
          <div className="min-w-[14rem] flex-1">
            <div className="font-bold text-slate-800">{SITE.owner.name}</div>
            <div className="mt-0.5 text-sm text-slate-500">{SITE.owner.role}</div>
          </div>
          <Link
            to="/contact"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-sky-800 ring-1 ring-slate-200 transition hover:bg-sky-50 hover:ring-sky-300"
          >
            רקע מקצועי ופרטי קשר ←
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="rounded-xl bg-sky-600 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-sky-700"
          >
            כניסה למערכת ←
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-600 transition hover:bg-slate-50"
          >
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    </PublicLayout>
  )
}
