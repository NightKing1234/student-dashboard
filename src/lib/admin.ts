// שכבת הנתונים של ממשק המנהל — לקוחות, מסמכים, הרשאות והעלאות.
// כל הגישה מוגנת ב-RLS: רק משתמש עם role='super_admin' רואה את הטבלאות האלה.
import { supabase } from './supabase'

export const DOCUMENTS_BUCKET = 'client-documents'
export const UPLOADS_BUCKET = 'moe-uploads'

// ─────────────────────────── טיפוסים ───────────────────────────

export interface Authority {
  code: string
  name: string
  is_active: boolean
}

export interface Client {
  authority_code: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  last_payment_date: string | null
  next_payment_date: string | null
  contract_renewal: string | null
  annual_fee: number | null
  notes: string | null
}

export interface ClientDocument {
  id: string
  authority_code: string
  title: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string
}

/** רמת ההיקף של משתמש בתוך הרשות (מיגרציה 004). */
export type ScopeLevel = 'council' | 'locality' | 'school'

export const SCOPE_LABELS: Record<ScopeLevel, string> = {
  council: 'מועצתי — כל תלמידי הרשות',
  locality: 'יישובי — יישובים נבחרים בלבד',
  school: 'בית-ספרי — מוסדות נבחרים בלבד',
}

export type UserRole = 'viewer' | 'admin' | 'super_admin'

export const ROLE_LABELS: Record<UserRole, string> = {
  viewer: 'צפייה בלבד',
  admin: 'מנהל רשות',
  super_admin: 'מנהל־על',
}

export interface ManagedUser {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  authority_codes: string[]
  scope_level: ScopeLevel
  scope_values: string[]
}

export interface MoeUpload {
  id: string
  authority_code: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  file_count: number
  storage_prefix: string
  uploaded_at: string
  processed_at: string | null
  rows_loaded: number | null
  error_message: string | null
}

/** ערך אפשרי לבחירת היקף — סמל + שם לתצוגה. */
export interface ScopeOption {
  value: string
  label: string
  count: number
}

// ─────────────────────────── לקוחות ───────────────────────────

export async function fetchAuthorities(): Promise<Authority[]> {
  const { data, error } = await supabase
    .from('authorities')
    .select('code, name, is_active')
    .order('name')
  if (error) throw error
  return (data ?? []) as Authority[]
}

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from('clients').select('*')
  if (error) throw error
  return (data ?? []) as Client[]
}

export async function fetchClient(code: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('authority_code', code)
    .maybeSingle()
  if (error) throw error
  return data as Client | null
}

export async function saveClient(client: Partial<Client> & { authority_code: string }) {
  const { error } = await supabase
    .from('clients')
    .upsert({ ...client, updated_at: new Date().toISOString() })
  if (error) throw error
}

/** כמה תלמידים בכל רשות — למספר על כרטיס הלקוח. */
export async function countStudents(code: string): Promise<number> {
  const { count, error } = await supabase
    .from(`students_${code}`)
    .select('MISPAR_ZEHUT', { count: 'exact', head: true })
  if (error) return 0 // אין טבלה לרשות הזו עדיין
  return count ?? 0
}

// ─────────────────────────── מסמכים ───────────────────────────

export async function fetchDocuments(code: string): Promise<ClientDocument[]> {
  const { data, error } = await supabase
    .from('client_documents')
    .select('*')
    .eq('authority_code', code)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ClientDocument[]
}

export async function uploadDocument(code: string, file: File, title: string) {
  const path = `${code}/${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file)
  if (upErr) throw upErr

  const { error } = await supabase.from('client_documents').insert({
    authority_code: code,
    title: title || file.name,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  })
  if (error) throw error
}

export async function deleteDocument(doc: ClientDocument) {
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path])
  const { error } = await supabase.from('client_documents').delete().eq('id', doc.id)
  if (error) throw error
}

/** קישור זמני לצפייה במסמך (הבאקט פרטי). */
export async function documentUrl(doc: ClientDocument): Promise<string | null> {
  const { data } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 10)
  return data?.signedUrl ?? null
}

// ─────────────────────────── הרשאות ───────────────────────────

export async function fetchUsers(): Promise<ManagedUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name, role, authority_codes, scope_level, scope_values')
    .order('email')
  if (error) throw error
  return (data ?? []) as ManagedUser[]
}

/**
 * קורא ל-Edge Function `admin-users`. יצירת משתמש וקביעת סיסמה מחייבות את
 * מפתח ה-service_role, שאסור שיגיע לדפדפן — לכן הן רצות בצד שרת.
 * הפונקציה מאמתת בעצמה שהקורא הוא מנהל־על.
 */
async function callAdminFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // גוף התשובה מכיל הודעה בעברית; error.message לבדו הוא גנרי
    const detail = (data as { error?: string } | null)?.error
    throw new Error(detail || error.message)
  }
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error)
  }
  return data
}

export interface NewUserInput {
  email: string
  password: string
  display_name: string
  role: UserRole
  authority_codes: string[]
  scope_level: ScopeLevel
  scope_values: string[]
}

export async function createUser(input: NewUserInput) {
  return callAdminFunction({ action: 'create', ...input })
}

export async function setUserPassword(id: string, password: string) {
  return callAdminFunction({ action: 'set_password', id, password })
}

export async function deleteUser(id: string) {
  return callAdminFunction({ action: 'delete', id })
}

export async function updateUserPermissions(
  id: string,
  patch: Partial<Pick<ManagedUser, 'role' | 'authority_codes' | 'scope_level' | 'scope_values'>>,
) {
  const { error } = await supabase.from('users').update(patch).eq('id', id)
  if (error) throw error
}

/**
 * הערכים הזמינים לבחירת היקף — נגזרים מהנתונים עצמם.
 * יישובים: סמל + תיאור. מוסדות: סמל + שם.
 */
export async function fetchScopeOptions(
  code: string,
  level: Exclude<ScopeLevel, 'council'>,
): Promise<ScopeOption[]> {
  const [valueCol, labelCol] =
    level === 'locality'
      ? ['SEMEL_YISHUV1', 'TEUR_YISHUV1']
      : ['SEMEL_MOSAD', 'SHEM_MOSAD']

  // select דינמי — supabase-js לא יכול להסיק את הטיפוס, ולכן unknown ואז המרה
  const { data, error } = await supabase
    .from(`students_${code}`)
    .select(`${valueCol}, ${labelCol}`)
  if (error) throw error

  const map = new Map<string, ScopeOption>()
  for (const row of ((data ?? []) as unknown) as Record<string, unknown>[]) {
    const value = String(row[valueCol] ?? '').trim()
    if (!value) continue
    const existing = map.get(value)
    if (existing) {
      existing.count++
    } else {
      map.set(value, {
        value,
        label: String(row[labelCol] ?? '').trim() || value,
        count: 1,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'he'))
}

// ─────────────────────── העלאת קבצי מצב"ת ───────────────────────

/** ששת קבצי המצב"ת הנדרשים, לפי הקידומת בשם הקובץ. */
export const MOE_FILE_PREFIXES = [
  'TALMIDIM',
  'PIRTEY_KESHER',
  'GORMEY_KESHER',
  'MEGAMOT',
  'MOSDOT',
  'KITOT',
] as const

/** מזהה לאיזה קובץ מצב"ת שייך קובץ שנבחר, לפי הקידומת. */
export function classifyMoeFile(name: string): string | null {
  const upper = name.toUpperCase()
  return MOE_FILE_PREFIXES.find((p) => upper.startsWith(p)) ?? null
}

export async function fetchUploads(code: string): Promise<MoeUpload[]> {
  const { data, error } = await supabase
    .from('moe_uploads')
    .select('*')
    .eq('authority_code', code)
    .order('uploaded_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as MoeUpload[]
}

/**
 * מעלה את קבצי המצב"ת ל-Storage ורושם רשומת המתנה.
 * העיבוד עצמו (pandas) רץ מחוץ לענן — update_from_moe.py מוריד ומעבד.
 */
export async function uploadMoeFiles(code: string, files: File[]) {
  const prefix = `${code}/${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`

  for (const file of files) {
    const { error } = await supabase.storage
      .from(UPLOADS_BUCKET)
      .upload(`${prefix}/${file.name}`, file)
    if (error) throw error
  }

  const { error } = await supabase.from('moe_uploads').insert({
    authority_code: code,
    storage_prefix: prefix,
    file_count: files.length,
    status: 'pending',
  })
  if (error) throw error
  return prefix
}
