// שדות מחושבים — נגזרים מהנתונים בצד הלקוח, בלי לגעת ב-pipeline או במסד.
//
// למה בצד הלקוח: הכללים כאן הם *הגדרה עסקית* שסבא עוד מלטש (מה נחשב כיתת
// חינוך מיוחד, מי נחשב תלמיד חוץ). שינוי כלל בצד הלקוח הוא פריסה של האתר;
// שינוי ב-pipeline מחייב ריצה מחדש על השרת וטעינה מחדש של כל הרשויות.
// כשההגדרה תתייצב אפשר להעביר אותה למודול 7 ולחסוך את החישוב בכל טעינה.

import type { StudentRow } from './students'

// ─────────────────── חינוך מיוחד — משבצת ───────────────────
//
// סבא הדגים את הכלל על נתוני אמת בפגישת 13.8:
//   1. "סוג חינוך מוסד ≠ רגיל"  → תלמידי מוסדות חינוך מיוחד.
//   2. "סוג כיתה ≠ רגילה"       → תלמידי כיתות חינוך מיוחד בבית ספר רגיל.
//      מתוכם יש להוציא ערכים שאינם חינוך מיוחד כלל (מגמות לימוד), שאותם
//      זיהה בתצוגה והוציא בסינון "אינו מכיל".
//
// מי שלומד במוסד חינוך מיוחד לומד ממילא בכיתת חינוך מיוחד, ולכן קבוצה 2
// מכילה את קבוצה 1 — שתיהן נבדקות כדי לא לפספס רישום חלקי.

/** ערכי "סוג חינוך מוסד" שאינם חינוך מיוחד. */
export const REGULAR_EDUCATION_VALUES = ['רגיל']

/** ערכי "סוג כיתה" שאינם חינוך מיוחד. */
export const REGULAR_CLASS_VALUES = ['רגילה', 'רגיל', 'ריק']

/**
 * ביטויים בתוך "סוג כיתה" שמסמנים מסלול לימוד ולא חינוך מיוחד.
 * סבא זיהה אותם בתצוגה ("זה לא חינוך מיוחד") והוציא אותם בסינון.
 *
 * הערכים במצב"ת כתובים `ל"ב טכנולוגי` ו-`ל"ב עיוני`. ההשוואה נעשית אחרי
 * הסרת גרשיים, כי אותו ערך מופיע גם כ-`לב עיוני` וגם עם גרש עברי (״).
 */
export const NON_SPECIAL_CLASS_PATTERNS = ['לב טכנולוגי', 'לב עיוני']

/** מסיר גרשיים/גרשים ומכווץ רווחים, כדי שההשוואה לא תישבר על צורת הכתיב */
function normalizeClass(value: string): string {
  return value.replace(/["'״׳]/g, '').replace(/\s+/g, ' ').trim()
}

export const SPECIAL_ED_PLACEMENT = 'משבצת'

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

/** האם ערך "סוג חינוך מוסד" מסמן מוסד חינוך מיוחד. */
export function isSpecialEdInstitution(value: unknown): boolean {
  const v = text(value)
  return v !== '' && !REGULAR_EDUCATION_VALUES.includes(v)
}

/** האם ערך "סוג כיתה" מסמן כיתת חינוך מיוחד. */
export function isSpecialEdClass(value: unknown): boolean {
  const v = normalizeClass(text(value))
  if (v === '' || REGULAR_CLASS_VALUES.includes(v)) return false
  return !NON_SPECIAL_CLASS_PATTERNS.some((p) => v.includes(p))
}

/**
 * סטטוס חינוך מיוחד לשורה.
 *
 * כרגע מזוהה **משבצת** בלבד. "שילוב" (תלמיד עם זכאות שלומד בכיתה רגילה)
 * אינו ניתן לזיהוי מקבצי משרד החינוך — הרשימה מגיעה מהשירות הפסיכולוגי
 * ועדיין לא בידינו. כשתגיע, הערך יתווסף כאן.
 */
export function specialEdStatus(row: StudentRow): string {
  if (isSpecialEdInstitution(row['SUG_CHINUCH_TEUR'])) return SPECIAL_ED_PLACEMENT
  if (isSpecialEdClass(row['TEUR_SUG_KITA'])) return SPECIAL_ED_PLACEMENT
  return ''
}

// ─────────────────── סמל מסלול ───────────────────
//
// סבא ביקש אותו פעמיים ואמר "מאוד מאוד חשוב". הבעיה: מודול 7 מחליף את
// `CODE_MASLUL` בתיאור טקסטואלי, כך שהסמל המספרי אינו מגיע למסד כלל.
//
// אבל המיפוי שם הוא חד-חד-ערכי — לכל תיאור יש קוד אחד בדיוק — ולכן אפשר
// להפוך אותו כאן ולהחזיר את הסמל בלי לגעת ב-pipeline, בלי מיגרציה,
// ובלי לטעון מחדש נתונים. המקור:
// Itay_Modules/python_modules/modules/Field_handling_module_7.py
const MASLUL_CODE_BY_LABEL: Record<string, string> = {
  'ריק': '0',
  'בגרות (עיוני,מסמ"ת)': '1',
  'הכוון': '4',
  'מרכז חינוך': '5',
  'השלמה לבגרות עיוני': '6',
  'חינוך מיוחד על יסודי': '7',
  'גמר  (רפורמה)': '8',
  'בוגר לטכנולוגיה בהנדסה': '9',
}

/**
 * סמל המסלול לשורה.
 *
 * קוד שמשרד החינוך הוסיף ואינו במילון של מודול 7 נשאר מספרי בעמודה
 * (ה-replace מדלג עליו) — ואז הערך *הוא* הסמל, ומוחזר כמו שהוא.
 */
export function maslulCode(row: StudentRow): string {
  const value = text(row['CODE_MASLUL'])
  if (value === '') return ''
  if (/^\d+$/.test(value)) return value
  return MASLUL_CODE_BY_LABEL[value] ?? ''
}

// ─────────────────── סטטוס תלמיד ברשות ───────────────────
//
// השוואה בין הרשות שבה התלמיד *גר* לרשות שבה הוא *לומד*. שני השדות
// מכילים את קוד הרשות של **משרד החינוך**, שאינו בהכרח הקוד שלנו
// (כפר = 120 אצלנו, 5108 שם) — ולכן ההשוואה היא מול authorities.moe_code.

export const RESIDENT_AND_STUDENT = 'גר ולומד ברשות'
export const RESIDENT_STUDIES_OUTSIDE = 'גר ולומד מחוץ לרשות'
export const OUTSIDE_STUDENT = 'תלמיד חוץ — לומד ברשות'

export function authorityStatus(row: StudentRow, moeCode: string): string {
  if (!moeCode) return ''
  const livesHere = text(row['RASHUT_TALMID']) === moeCode
  const studiesHere = text(row['RASHUT_CHINUCH_MOSAD']) === moeCode

  if (livesHere && studiesHere) return RESIDENT_AND_STUDENT
  if (livesHere && !studiesHere) return RESIDENT_STUDIES_OUTSIDE
  if (!livesHere && studiesHere) return OUTSIDE_STUDENT
  return ''
}

// ─────────────────── החלה על כל השורות ───────────────────

/**
 * מוסיף את השדות המחושבים לכל שורה. מחזיר מערך חדש; אינו נוגע במקור.
 *
 * העמודות `STATUS_CHINUCH_MEYUCHAD` ו-`STATUS_TALMID_BARASHUT` קיימות
 * בטבלה אך ריקות — כאן הן מתמלאות בתצוגה, כך שהסינון, הייצוא והפיבוטים
 * כולם רואים אותן כשדה רגיל לכל דבר.
 */
export function withComputedFields(
  rows: StudentRow[],
  moeCode: string,
): StudentRow[] {
  return rows.map((row) => ({
    ...row,
    STATUS_CHINUCH_MEYUCHAD: specialEdStatus(row),
    STATUS_TALMID_BARASHUT: authorityStatus(row, moeCode),
    SEMEL_MASLUL: maslulCode(row),
  }))
}
