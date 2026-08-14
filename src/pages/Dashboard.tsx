import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { fetchAllStudents, type StudentRow } from '@/lib/students'
import { applyFilters, isConditionReady, type FilterCondition } from '@/lib/filters'
import { sortRows, paginateFields, type SortState } from '@/lib/table'
import { exportToExcel } from '@/lib/exportExcel'
import {
  PRESETS,
  DEFAULT_PRESET,
  ACTIVE_STATUS_FIELD,
  ACTIVE_STATUS_VALUE,
} from '@/config/presets'
import { PARENT_ID_FIELDS } from '@/config/fields'
import { fetchAuthorities, type Authority } from '@/lib/admin'
import FilterBar from '@/components/FilterBar'
import FieldPicker from '@/components/FieldPicker'
import StudentTable from '@/components/StudentTable'
import StudentCard from '@/components/StudentCard'

const COL_MIN_WIDTH = 96 // רוחב עמודה משוער לחישוב כמות עמודות לדף

/**
 * סינון ברירת המחדל — רק תלמידים "משובץ".
 * הטבלה ב-DB מכילה גם תלמידים שעזבו/מועמדים, אבל הם מוסתרים כברירת מחדל.
 * הסינון מוצג בסרגל הסינון וניתן להסרה בלחיצה — "הכל ואז מצמצמים" נשמר.
 */
function defaultFilters(): FilterCondition[] {
  return [
    {
      id: 'default-active-status',
      field: ACTIVE_STATUS_FIELD,
      operator: 'equals',
      value: ACTIVE_STATUS_VALUE,
    },
  ]
}

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  // קוד הרשות מגיע מהנתיב (/students/:code) כשמגיעים ממסך המנהל
  const { code: codeFromUrl } = useParams()
  const isSuperAdmin = profile?.role === 'super_admin'

  // הרשויות הזמינות: מנהל־על רואה את כולן, משתמש רגיל רק את שלו
  const [allAuthorities, setAllAuthorities] = useState<Authority[]>([])
  const authorities = isSuperAdmin
    ? allAuthorities.map((a) => a.code)
    : (profile?.authority_codes ?? [])

  const [authorityCode, setAuthorityCode] = useState<string>(codeFromUrl ?? '')

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchAuthorities().then(setAllAuthorities).catch(() => setAllAuthorities([]))
  }, [isSuperAdmin])

  // הפרופיל נטען אסינכרונית — נקבע את הרשות ברגע שהוא מגיע
  useEffect(() => {
    if (!authorityCode && authorities.length > 0) setAuthorityCode(authorities[0])
  }, [authorities, authorityCode])

  // שם הרשות לתצוגה — נעים יותר מקוד בן 7 ספרות
  const authorityName =
    allAuthorities.find((a) => a.code === authorityCode)?.name ?? ''

  const [allStudents, setAllStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activePreset, setActivePreset] = useState(DEFAULT_PRESET.id)
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_PRESET.defaultFields)
  const [filters, setFilters] = useState<FilterCondition[]>(defaultFilters)
  const [sort, setSort] = useState<SortState | null>(null)
  const [fieldPage, setFieldPage] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [cardIndex, setCardIndex] = useState<number | null>(null)
  const [siblingParentId, setSiblingParentId] = useState<string | null>(null)

  const tableWrapRef = useRef<HTMLDivElement>(null)
  const [perPage, setPerPage] = useState(8)

  // טעינת כל תלמידי הרשות (אפיון: "הכל ואז מצמצמים")
  useEffect(() => {
    if (!authorityCode) return
    setLoading(true)
    setError(null)
    fetchAllStudents(authorityCode)
      .then(setAllStudents)
      .catch((e) => setError(e.message ?? 'שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false))
  }, [authorityCode])

  // חישוב כמות עמודות לדף לפי רוחב המסך (דפדוף שדות, אפיון §6.2)
  useEffect(() => {
    const el = tableWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const cols = Math.max(1, Math.floor((el.clientWidth - 48) / COL_MIN_WIDTH))
      setPerPage(cols)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // סינון + מיון — קובע גם את הייצוא וגם את ניווט הכרטיס
  const activeFilters = useMemo(() => filters.filter(isConditionReady), [filters])
  const results = useMemo(() => {
    let rows = allStudents
    // זיהוי אחים — התאמת OR על שני שדות ההורה
    if (siblingParentId) {
      rows = rows.filter((r) =>
        PARENT_ID_FIELDS.some((f) => String(r[f] ?? '') === siblingParentId),
      )
    }
    return sortRows(applyFilters(rows, activeFilters), sort)
  }, [allStudents, activeFilters, sort, siblingParentId])

  // דפדוף שדות אופקי
  const fieldPages = useMemo(
    () => paginateFields(selectedFields, perPage),
    [selectedFields, perPage],
  )
  const safePage = Math.min(fieldPage, fieldPages.length - 1)
  const currentFields = fieldPages[safePage] ?? []

  function changePreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET
    setActivePreset(id)
    setSelectedFields(preset.defaultFields)
    setFieldPage(0)
  }

  function toggleField(key: string) {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  function handleSort(field: string) {
    setSort((prev) =>
      prev?.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    )
  }

  function handleExport() {
    const preset = PRESETS.find((p) => p.id === activePreset)
    const stamp = new Date().toISOString().slice(0, 10)
    exportToExcel(results, selectedFields, `תלמידים_${preset?.name ?? ''}_${stamp}`)
  }

  // זיהוי אחים — סינון על ת.ז. ההורה (אפיון §5, תצורה 2).
  // מציג את כל התלמידים שאחד מהוריהם הוא ת.ז. זו (התאמה על גורם קשר 1 או 2).
  function findSiblings(parentId: string) {
    setCardIndex(null)
    setSiblingParentId(parentId)
    setFilters([])
  }

  return (
    <div className="flex h-full flex-col">
      {/* פס עליון */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-sky-800">ניהול נתוני תלמידים</h1>
          {authorities.length > 1 ? (
            <select
              value={authorityCode}
              onChange={(e) => setAuthorityCode(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              {authorities.map((a) => {
                const name = allAuthorities.find((x) => x.code === a)?.name
                return (
                  <option key={a} value={a}>
                    {name ? `${name} (${a})` : `רשות ${a}`}
                  </option>
                )
              })}
            </select>
          ) : (
            <span className="text-sm text-slate-500">
              {authorityName ? `${authorityName} (${authorityCode})` : `רשות ${authorityCode || '—'}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {isSuperAdmin && (
            <Link
              to="/admin"
              className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-sky-50 hover:text-sky-700"
            >
              → ניהול לקוחות
            </Link>
          )}
          <span className="text-slate-500">{profile?.display_name ?? profile?.email}</span>
          <button onClick={signOut} className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-red-50 hover:text-red-600">
            יציאה
          </button>
        </div>
      </header>

      {/* טאבים של תצורות */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-4 pt-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => changePreset(p.id)}
            title={p.description}
            className={
              'rounded-t-lg px-4 py-2 text-sm font-medium transition ' +
              (activePreset === p.id
                ? 'border-b-2 border-sky-600 bg-sky-600 text-white shadow-sm'
                : 'border-b-2 border-transparent text-slate-600 hover:bg-sky-50 hover:text-sky-700')
            }
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* סרגל כלים */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
          >
            ⚙ בורר שדות ({selectedFields.length})
          </button>
          <button
            onClick={handleExport}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 hover:shadow"
          >
            ⬇ ייצוא לאקסל
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>
            <strong className="text-sky-700">{results.length.toLocaleString('he-IL')}</strong> תלמידים
            {activeFilters.length > 0 && ` (מתוך ${allStudents.length.toLocaleString('he-IL')})`}
          </span>

          {/* דפדוף שדות */}
          {fieldPages.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFieldPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="rounded-md border border-slate-300 px-2 py-0.5 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:bg-transparent"
              >
                →
              </button>
              <span>
                דף {safePage + 1}/{fieldPages.length}
              </span>
              <button
                onClick={() => setFieldPage((p) => Math.min(fieldPages.length - 1, p + 1))}
                disabled={safePage >= fieldPages.length - 1}
                className="rounded-md border border-slate-300 px-2 py-0.5 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:bg-transparent"
              >
                ←
              </button>
            </div>
          )}
        </div>
      </div>

      {/* באנר זיהוי אחים */}
      {siblingParentId && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>מציג אחים — כל התלמידים שההורה ת.ז. {siblingParentId} משויך אליהם</span>
          <button
            onClick={() => setSiblingParentId(null)}
            className="rounded border border-amber-300 px-2 py-0.5 hover:bg-amber-100"
          >
            ביטול
          </button>
        </div>
      )}

      {/* סינון */}
      <FilterBar conditions={filters} onChange={setFilters} />

      {/* הטבלה */}
      <div ref={tableWrapRef} className="min-h-0 flex-1 bg-white">
        {loading ? (
          <div className="p-8 text-center text-slate-400">טוען תלמידים…</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">שגיאה: {error}</div>
        ) : (
          <StudentTable
            rows={results}
            fields={currentFields}
            sort={sort}
            onSort={handleSort}
            onRowClick={setCardIndex}
          />
        )}
      </div>

      {pickerOpen && (
        <FieldPicker
          selected={selectedFields}
          onToggle={toggleField}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {cardIndex !== null && results[cardIndex] && (
        <StudentCard
          rows={results}
          index={cardIndex}
          onNavigate={setCardIndex}
          onClose={() => setCardIndex(null)}
          onFindSiblings={findSiblings}
        />
      )}
    </div>
  )
}
