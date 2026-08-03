// ייצוא לאקסל — אפיון §6.5. "הדרך היחידה להפיק דוחות בשלב א'".
// מייצא את *כל* השדות שנבחרו (מכל הדפים), משקף את הסינון והמיון הנוכחיים.
import * as XLSX from 'xlsx'
import { fieldLabel } from '@/config/fields'

type Row = Record<string, unknown>

/**
 * מייצא שורות לקובץ אקסל.
 * @param rows השורות אחרי סינון ומיון
 * @param fields מפתחות השדות שנבחרו, לפי הסדר (כולל שדות מכל הדפים)
 * @param fileName שם הקובץ (בלי סיומת)
 */
export function exportToExcel(rows: Row[], fields: string[], fileName: string): void {
  // בונים מערך אובייקטים עם כותרות בעברית לפי סדר השדות שנבחר
  const data = rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const key of fields) {
      out[fieldLabel(key)] = row[key] ?? ''
    }
    return out
  })

  const headers = fields.map((k) => fieldLabel(k))
  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers })
  const workbook = XLSX.utils.book_new()

  // RTL בגיליון
  worksheet['!cols'] = headers.map(() => ({ wch: 18 }))
  workbook.Workbook = { Views: [{ RTL: true }] }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'תלמידים')
  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}
