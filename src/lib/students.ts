// שכבת הנתונים לטבלת התלמידים.
import { supabase, studentsTable } from './supabase'

export type StudentRow = Record<string, unknown>

const PAGE_SIZE = 1000 // Supabase מגביל ל-1000 שורות לבקשה

/**
 * טוען את *כל* תלמידי הרשות (אפיון: "הכל ואז מצמצמים").
 * מבצע דפדוף פנימי כדי לעקוף את מגבלת 1000 השורות של Supabase.
 */
export async function fetchAllStudents(authorityCode: string): Promise<StudentRow[]> {
  const table = studentsTable(authorityCode)
  const all: StudentRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...(data as StudentRow[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}
