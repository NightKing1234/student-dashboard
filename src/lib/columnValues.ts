// חישוב הערכים הייחודיים של עמודה — הבסיס לסינון בבחירה מרובה.
//
// זה מה שסבא מכיר מאקסס ומאקסל: לחיצה על כותרת העמודה פותחת את *כל*
// הערכים שקיימים בה, לפי א"ב, וכל אחד עם צ'קבוקס. במקום שלושה סינונים
// נפרדים כדי לראות שלושה יישובים — סימון של שלוש שורות.

type Row = Record<string, unknown>

export interface ColumnValue {
  /** הערך כפי שהוא בשורה (מחרוזת ריקה = תא ריק) */
  value: string
  /** תווית לתצוגה — תא ריק מוצג כ-(ריק) */
  label: string
  /** כמה שורות מכילות את הערך */
  count: number
}

export const BLANK_LABEL = '(ריק)'

/**
 * מחזיר את הערכים הייחודיים בעמודה, ממוינים לפי א"ב, עם ספירה לכל ערך.
 *
 * תאים ריקים מקובצים לערך אחד בסוף הרשימה — כך אפשר לבודד "מי חסר לי
 * מייל" בלחיצה אחת, בלי לחפש את האופרטור "ריק".
 */
export function columnValues(rows: Row[], field: string): ColumnValue[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const raw = row[field]
    const value = raw === null || raw === undefined ? '' : String(raw).trim()
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  const out: ColumnValue[] = []
  let blanks = 0

  for (const [value, count] of counts) {
    if (value === '') {
      blanks = count
      continue
    }
    out.push({ value, label: value, count })
  }

  out.sort((a, b) => a.label.localeCompare(b.label, 'he', { numeric: true }))

  // הריקים תמיד אחרונים — כמו (Blanks) באקסל
  if (blanks > 0) {
    out.push({ value: '', label: BLANK_LABEL, count: blanks })
  }

  return out
}
