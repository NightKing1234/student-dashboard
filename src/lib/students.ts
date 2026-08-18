// שכבת הנתונים לטבלת התלמידים.
import { supabase, studentsTable } from './supabase'

export type StudentRow = Record<string, unknown>

const PAGE_SIZE = 1000 // Supabase מגביל ל-1000 שורות לבקשה
const MAX_PARALLEL = 4 // כמה עמודים לבקש במקביל

/**
 * מטמון בזיכרון לפי קוד רשות.
 *
 * בלעדיו כל חזרה למסך הטבלה (מעבר לניהול וחזרה, כפתור "הקודם" בדפדפן)
 * טענה מחדש 8,000+ שורות ו-165 עמודות — 20-30 שניות שסבא נתקל בהן בפועל.
 * המטמון חי כל עוד הלשונית פתוחה; רענון הדף או "רענון נתונים" מנקים אותו.
 */
const cache = new Map<string, StudentRow[]>()
/** בקשות שכבר בדרך — שני רכיבים שמבקשים במקביל לא יפתחו שתי טעינות */
const inFlight = new Map<string, Promise<StudentRow[]>>()

/** מנקה את המטמון — לרשות מסוימת או לכולן. */
export function clearStudentsCache(authorityCode?: string): void {
  if (authorityCode) {
    cache.delete(authorityCode)
    inFlight.delete(authorityCode)
  } else {
    cache.clear()
    inFlight.clear()
  }
}

export function isStudentsCached(authorityCode: string): boolean {
  return cache.has(authorityCode)
}

async function fetchPage(table: string, from: number): Promise<StudentRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return (data ?? []) as StudentRow[]
}

/**
 * טוען את *כל* תלמידי הרשות (אפיון: "הכל ואז מצמצמים").
 *
 * שתי בקשות ראשונות קובעות את הגודל, והשאר נמשכות במקביל: ספירה מדויקת
 * מראש מאפשרת לדעת כמה עמודים יש במקום לגשש עמוד-אחר-עמוד. עם 9 עמודים,
 * זה ההבדל בין 9 סבבים סדרתיים לשלושה גלים.
 */
async function loadAll(authorityCode: string): Promise<StudentRow[]> {
  const table = studentsTable(authorityCode)

  // ספירה בלבד (head) — זולה, ומאפשרת לתכנן את הבקשות מראש
  const { count, error: countError } = await supabase
    .from(table)
    .select('MISPAR_ZEHUT', { count: 'exact', head: true })
  if (countError) throw countError

  const total = count ?? 0
  if (total === 0) return []

  const pages = Math.ceil(total / PAGE_SIZE)
  const all: StudentRow[] = []

  // גלים של MAX_PARALLEL בקשות; שומר על סדר השורות לפי מספר העמוד
  for (let start = 0; start < pages; start += MAX_PARALLEL) {
    const wave = []
    for (let p = start; p < Math.min(start + MAX_PARALLEL, pages); p++) {
      wave.push(fetchPage(table, p * PAGE_SIZE))
    }
    const results = await Promise.all(wave)
    for (const rows of results) all.push(...rows)
  }

  return all
}

export async function fetchAllStudents(
  authorityCode: string,
  options: { force?: boolean } = {},
): Promise<StudentRow[]> {
  if (!options.force) {
    const hit = cache.get(authorityCode)
    if (hit) return hit

    const pending = inFlight.get(authorityCode)
    if (pending) return pending
  }

  const promise = loadAll(authorityCode)
    .then((rows) => {
      cache.set(authorityCode, rows)
      return rows
    })
    .finally(() => {
      inFlight.delete(authorityCode)
    })

  inFlight.set(authorityCode, promise)
  return promise
}
