// כלי עזר לטבלה — מיון ודפדוף שדות אופקי (אפיון §6.1, §6.2).
import type { FieldType } from '@/config/fields'
import { getField } from '@/config/fields'

type Row = Record<string, unknown>

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  field: string
  direction: SortDirection
}

function compareValues(a: unknown, b: unknown, type: FieldType): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1 // ריקים תמיד בסוף
  if (bEmpty) return -1

  if (type === 'number') return Number(a) - Number(b)
  if (type === 'date') return new Date(String(a)).getTime() - new Date(String(b)).getTime()
  return String(a).localeCompare(String(b), 'he')
}

/** ממיין שורות לפי שדה יחיד. לא משנה את המערך המקורי. */
export function sortRows(rows: Row[], sort: SortState | null): Row[] {
  if (!sort) return rows
  const type: FieldType = getField(sort.field)?.type ?? 'text'
  const factor = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => compareValues(a[sort.field], b[sort.field], type) * factor)
}

/**
 * מחלק את השדות שנבחרו לדפים אופקיים לפי רוחב המסך (אפיון §6.2).
 * דף 1 מכיל את שדות הליבה שנכנסים ברוחב; היתר עוברים לדפים הבאים.
 */
export function paginateFields(fields: string[], perPage: number): string[][] {
  if (perPage <= 0) return [fields]
  const pages: string[][] = []
  for (let i = 0; i < fields.length; i += perPage) {
    pages.push(fields.slice(i, i + perPage))
  }
  return pages.length ? pages : [[]]
}
