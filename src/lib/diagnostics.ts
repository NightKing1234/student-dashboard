// אבחון תקלות כניסה — מתרגם שגיאות Supabase להסבר בעברית, ובודק את
// תקינות הגדרות הסביבה. נועד לענות על השאלה "זו סיסמה שגויה או תקלת הגדרה?"
// בלי לפתוח את כלי המפתחים.

const EXPECTED_URL_PATTERN = /^https:\/\/[a-z0-9]+\.supabase\.co$/
// מפתחות publishable/anon תקינים באורך ~40+ תווים אחרי הקידומת
const MIN_KEY_LENGTH = 40

interface DescribedError {
  /** הסבר קצר בעברית שמוצג תמיד */
  message: string
  /** שורות טכניות שמוצגות בפירוט */
  technical: string[]
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status
    if (typeof s === 'number') return s
  }
  return undefined
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message ?? '')
  }
  return String(err)
}

/** ממפה שגיאת התחברות להסבר בעברית + פירוט טכני. */
export function describeAuthError(err: unknown): DescribedError {
  const status = statusOf(err)
  const raw = messageOf(err)
  const lower = raw.toLowerCase()

  const technical = [
    `error: ${raw || '(ללא הודעה)'}`,
    `status: ${status ?? '(אין)'}`,
  ]

  // מפתח API פגום/חסר — התסמין הכי מבלבל, כי הוא נראה כמו סיסמה שגויה
  if (lower.includes('api key') || lower.includes('apikey') || status === 401) {
    return {
      message:
        'תקלת הגדרה: מפתח ה-API של Supabase אינו תקין. זו אינה בעיה בסיסמה — ' +
        'יש לבדוק את משתנה הסביבה VITE_SUPABASE_ANON_KEY ולבנות מחדש.',
      technical,
    }
  }

  if (lower.includes('invalid login credentials')) {
    return { message: 'המייל או הסיסמה שגויים.', technical }
  }

  if (lower.includes('email not confirmed')) {
    return { message: 'המשתמש קיים אך המייל טרם אושר.', technical }
  }

  if (status === 429 || lower.includes('rate limit')) {
    return {
      message: 'יותר מדי ניסיונות כניסה. המתן דקה ונסה שוב.',
      technical,
    }
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return {
      message:
        'לא הצלחנו להגיע לשרת. ייתכן שאין חיבור לאינטרנט, או שכתובת Supabase שגויה.',
      technical,
    }
  }

  return { message: 'כניסה נכשלה. פתח את הפרטים הטכניים לאבחון.', technical }
}

/**
 * בדיקת שפיות על משתני הסביבה. אינה חושפת את המפתח עצמו —
 * רק אורך וקידומת, מספיק כדי לזהות ערך קטוע או חסר.
 */
export function configDiagnostics(): string[] {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const out: string[] = []

  if (!url) {
    out.push('VITE_SUPABASE_URL: חסר!')
  } else {
    out.push(`VITE_SUPABASE_URL: ${url}`)
    if (!EXPECTED_URL_PATTERN.test(url)) {
      out.push('  ^ הכתובת אינה בפורמט https://<ref>.supabase.co')
    }
  }

  if (!key) {
    out.push('VITE_SUPABASE_ANON_KEY: חסר!')
  } else {
    out.push(`VITE_SUPABASE_ANON_KEY: ${key.slice(0, 18)}… (${key.length} תווים)`)
    if (key.length < MIN_KEY_LENGTH) {
      out.push(`  ^ קצר מהצפוי — ייתכן שהמפתח נקטע בהעתקה`)
    }
    if (key.startsWith('sb_secret_') || key.includes('service_role')) {
      out.push('  ^ אזהרה: זהו מפתח סודי! יש להשתמש ב-publishable/anon בלבד')
    }
  }

  return out
}
