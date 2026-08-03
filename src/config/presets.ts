// 4 תצורות שדות (Presets) — אפיון §5.
// כל תצורה היא נקודת פתיחה על אותה טבלה מרכזית: קבוצת שדות ברירת מחדל שממנה
// המשתמש מוסיף/מסיר שדות בחופשיות. לכל תצורה כרטיס תואם (StudentCard).

export interface Preset {
  id: string
  /** שם התצורה (טאב) */
  name: string
  /** תיאור קצר / מיקוד */
  description: string
  /** שדות ברירת המחדל, לפי הסדר */
  defaultFields: string[]
}

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
      'RASHUT_CHINUCH_TEUR',
      'RASHUT_TALMID',
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
      'EMAIL_parent1',
      'GOREM_KESHER_2_FULL_NAME',
      'GOREM_KESHER_2_ID',
      'TEUR_YISHUV1',
      'SHEM_RECHOV1',
      'MISPAR_BAYIT1',
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
      'RASHUT_CHINUCH_TEUR',
      'SHICHVA',
      'KITA_MESHULEVET',
    ],
  },
  {
    id: 'special_ed',
    name: 'חינוך מיוחד',
    description: 'זיהוי תלמידי משבצת וזכאות',
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
      'RASHUT_CHINUCH_TEUR',
      'RASHUT_TALMID',
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
