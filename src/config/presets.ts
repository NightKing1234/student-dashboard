// תצורות שדות (Presets) — אפיון §5.
// כל תצורה היא נקודת פתיחה על אותה טבלה מרכזית: קבוצת שדות ברירת מחדל שממנה
// המשתמש מוסיף/מסיר שדות בחופשיות. לכל תצורה כרטיס תואם (StudentCard).

import type { FilterOperator } from '@/lib/filters'

/** תנאי סינון שנטען אוטומטית עם התצורה. מוצג בסרגל וניתן להסרה. */
export interface PresetFilter {
  field: string
  operator: FilterOperator
  value?: string
  values?: string[]
}

export interface Preset {
  id: string
  /** שם התצורה (טאב) */
  name: string
  /** תיאור קצר / מיקוד */
  description: string
  /** שדות ברירת המחדל, לפי הסדר */
  defaultFields: string[]
  /**
   * סינון שנפתח יחד עם התצורה — למסכים שרלוונטיים רק לחלק מהאוכלוסייה.
   * מוצג בסרגל הסינון וניתן להסרה, כמו סינון מצב הרישום.
   */
  defaultFilters?: PresetFilter[]
}

// שם רשות המוסד ושם רשות מגורים התלמיד — סבא ביקש (הערה 9) שיופיעו
// כברירת מחדל **בכל** המסכים. עד היום הוצג `RASHUT_TALMID` שהוא סמל
// מספרי, בעוד שם הרשות יושב בעמודה נפרדת ולא היה בשימוש.
const AUTHORITY_NAME_FIELDS = ['RASHUT_CHINUCH_TEUR', 'SHEM_RASHUT_MEGURIM_TALMID']

export const PRESETS: Preset[] = [
  {
    id: 'students',
    name: 'תלמידים',
    description: 'מידע פדגוגי ואישי על התלמיד',
    defaultFields: [
      'MISPAR_ZEHUT',
      'SHEM_MISHPACHA',
      'SHEM_PRATI',
      'CODE_MIN',
      'TAARICH_LEDA',
      'SEMEL_MOSAD',
      'SHEM_MOSAD',
      'SHICHVA',
      'KITA_MESHULEVET',
      'SHLAV_HINUCH_TEUR',
      'SUG_PIKUACH_TEUR',
      'SUG_CHINUCH_TEUR',
      ...AUTHORITY_NAME_FIELDS,
      'TEUR_YISHUV1',
      'STATUS_TALMID_BARASHUT',
      // הטבלה כוללת גם תלמידים שאינם "משובץ" — המצב מוצג כברירת מחדל כדי שלא
      // ייספרו בטעות כתלמידים פעילים.
      'MATZAV_RISHUM_TEUR',
    ],
  },
  {
    id: 'contacts',
    name: 'פרטי קשר והורים',
    description: 'זיהוי אחים דרך ת.ז. הורה, איתור משפחתי במצבי חירום',
    defaultFields: [
      'MISPAR_ZEHUT',
      'SHEM_MISHPACHA',
      'SHEM_PRATI',
      'SHEM_MOSAD',
      'KITA_MESHULEVET',
      'GOREM_KESHER_1_FULL_NAME',
      'GOREM_KESHER_1_ID',
      'NAYAD_1_parent1',
      'EMAIL_parent1',
      'GOREM_KESHER_2_FULL_NAME',
      'GOREM_KESHER_2_ID',
      'NAYAD_1_parent2',
      'EMAIL_parent2',
      'TEUR_YISHUV1',
      'SHEM_RECHOV1',
      'MISPAR_BAYIT1',
      ...AUTHORITY_NAME_FIELDS,
    ],
  },
  {
    id: 'institutions',
    name: 'מוסדות חינוך',
    description: 'מיקוד במוסד החינוכי ובמאפייניו',
    defaultFields: [
      'MISPAR_ZEHUT',
      'SHEM_MISHPACHA',
      'SHEM_PRATI',
      'SEMEL_MOSAD',
      'SHEM_MOSAD',
      'SUG_CHINUCH_TEUR',
      'SUG_PIKUACH_TEUR',
      'SHLAV_HINUCH_TEUR',
      'SHICHVA',
      'KITA_MESHULEVET',
      ...AUTHORITY_NAME_FIELDS,
    ],
  },
  {
    id: 'special_ed',
    name: 'חינוך מיוחד',
    description: 'תלמידי משבצת — מוסד או כיתת חינוך מיוחד',
    defaultFields: [
      'MISPAR_ZEHUT',
      'SHEM_MISHPACHA',
      'SHEM_PRATI',
      'SEMEL_MOSAD',
      'SHEM_MOSAD',
      'SUG_CHINUCH_TEUR',
      'TEUR_SUG_KITA',
      'SHICHVA',
      'KITA_MESHULEVET',
      'STATUS_CHINUCH_MEYUCHAD',
      ...AUTHORITY_NAME_FIELDS,
      'TEUR_YISHUV1',
    ],
    // המסך נפתח כבר מסונן לתלמידי חינוך מיוחד — סבא: "אם אתה היית עושה לי
    // במסך הזה סינון לפי הפרמטרים האלו ישר, שמראש שם לי את זה".
    defaultFilters: [
      { field: 'STATUS_CHINUCH_MEYUCHAD', operator: 'not_empty' },
    ],
  },
  {
    id: 'megamot',
    name: 'מגמות',
    description: 'מגמות ומסגרות בתיכון — שכבות י׳ עד י״ב',
    defaultFields: [
      'MISPAR_ZEHUT',
      'SHEM_MISHPACHA',
      'SHEM_PRATI',
      'CODE_MIN',
      'SEMEL_MOSAD',
      'SHEM_MOSAD',
      'SHICHVA',
      'KITA_MESHULEVET',
      'SEMEL_MASLUL',
      'CODE_MASLUL',
      'CODE_NATIV',
      'CODE_HASMACHA',
      'SEMEL_MEGAMA_MISRAD_x',
      'TEUR_MEGAMA_MISRAD',
      'SEMEL_MEGAMA_MOSAD',
      'SHEM_MEGAMA_MOSAD',
      'TEUR_SUG_KITA',
      'TEUR_STATUS_ISHUR_MEGAMA',
      'MIN_TALMIDIM',
      'MAX_TALMIDIM',
      'TEUR_YISHUV1',
    ],
    // "רלוונטי אך ורק לתיכונים — רק שכבות י' ומעלה" (סבא, 13.8)
    defaultFilters: [
      { field: 'SHICHVA', operator: 'one_of', values: ['י', 'יא', 'יב'] },
    ],
  },
]

export const DEFAULT_PRESET = PRESETS[0]

/**
 * מצב הרישום שנחשב "תלמיד פעיל" — הערך שהטבלה מסוננת אליו כברירת מחדל.
 * הטבלה ב-DB מכילה גם תלמידים שעזבו / מועמדים / נרשמו, אבל הם לא מוצגים
 * עד שהמשתמש מסיר את הסינון בסרגל הסינון.
 */
export const ACTIVE_STATUS_FIELD = 'MATZAV_RISHUM_TEUR'
export const ACTIVE_STATUS_VALUE = 'משובץ'
