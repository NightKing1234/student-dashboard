import { useState } from 'react'
import {
  createUser,
  ROLE_LABELS,
  SCOPE_LABELS,
  type ScopeLevel,
  type ScopeOption,
  type UserRole,
} from '@/lib/admin'

interface Props {
  authorityCode: string
  /** אפשרויות ההיקף לרשות זו — נטענות ברכיב האב לפי הרמה שנבחרה */
  options: ScopeOption[]
  optionsLoading: boolean
  onScopeLevelChange: (level: ScopeLevel) => void
  onCreated: () => void
  onCancel: () => void
}

/** סיסמה זמנית קריאה — סבא מוסר אותה למשתמש והוא יכול לשנותה בהמשך. */
function suggestPassword() {
  const words = ['shomron', 'menashe', 'talmid', 'mosad', 'kita', 'rashut']
  const word = words[Math.floor(Math.random() * words.length)]
  return `${word}${Math.floor(1000 + Math.random() * 9000)}`
}

export default function NewUserForm({
  authorityCode,
  options,
  optionsLoading,
  onScopeLevelChange,
  onCreated,
  onCancel,
}: Props) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState(suggestPassword)
  const [role, setRole] = useState<UserRole>('viewer')
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>('council')
  const [scopeValues, setScopeValues] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase()) ||
          o.value.includes(query.trim()),
      )
    : options

  function changeLevel(level: ScopeLevel) {
    setScopeLevel(level)
    setScopeValues([])
    onScopeLevelChange(level)
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await createUser({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
        role,
        authority_codes: [authorityCode],
        scope_level: scopeLevel,
        scope_values: scopeLevel === 'council' ? [] : scopeValues,
      })
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300'

  return (
    <div className="rounded-xl border-2 border-sky-200 bg-sky-50/50 p-5">
      <h4 className="mb-4 font-bold text-sky-800">משתמש חדש</h4>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">כתובת מייל</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">שם לתצוגה</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">
            סיסמה <span className="text-xs text-slate-400">(8 תווים לפחות)</span>
          </span>
          <div className="flex gap-2">
            <input
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass + ' font-mono'}
            />
            <button
              type="button"
              onClick={() => setPassword(suggestPassword())}
              title="הצע סיסמה אחרת"
              className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm transition hover:bg-white"
            >
              🎲
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">תפקיד</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={inputClass}
          >
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm text-slate-600">היקף הצפייה</span>
        <select
          value={scopeLevel}
          onChange={(e) => changeLevel(e.target.value as ScopeLevel)}
          className={inputClass}
        >
          {Object.entries(SCOPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      {scopeLevel !== 'council' && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm text-slate-600">
              {scopeLevel === 'locality' ? 'יישובים מותרים' : 'מוסדות מותרים'}
              {scopeValues.length > 0 && (
                <strong className="mr-1 text-sky-700">({scopeValues.length})</strong>
              )}
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש…"
              className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none"
            />
          </div>

          {optionsLoading ? (
            <p className="text-sm text-slate-400">טוען רשימה…</p>
          ) : (
            <div className="thin-scrollbar max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {filtered.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-sm last:border-0 hover:bg-sky-50"
                >
                  <input
                    type="checkbox"
                    checked={scopeValues.includes(o.value)}
                    onChange={() =>
                      setScopeValues((v) =>
                        v.includes(o.value) ? v.filter((x) => x !== o.value) : [...v, o.value],
                      )
                    }
                    className="accent-sky-600"
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="text-xs text-slate-400">{o.count}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || !email.trim() || password.length < 8}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? 'יוצר…' : 'יצירת משתמש'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100"
        >
          ביטול
        </button>
        <span className="mr-auto text-xs text-slate-500">
          רשום את הסיסמה — היא לא תוצג שוב
        </span>
      </div>
    </div>
  )
}
