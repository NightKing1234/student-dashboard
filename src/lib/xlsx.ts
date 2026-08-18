// כותב קובצי אקסל מעוצבים — ללא ספרייה חיצונית.
//
// למה לא ספרייה: SheetJS בגרסה החופשית **אינו כותב עיצוב תאים** (הצבע,
// ההדגשה, הגבולות וההקפאה שסבא ביקש בהערה 14 שייכים למהדורה בתשלום),
// ומעבר ל-exceljs מוסיף ~300KB לבנדל ותלות שדורשת התקנה ברשת שמסננת
// את npm. קובץ xlsx הוא ZIP של XML, ושתי היכולות שנדרשות לכתיבתו —
// דחיסה (CompressionStream) וחישוב CRC — זמינות בדפדפן עצמו.
//
// מה נתמך: הקפאת שורת כותרת, כותרת מודגשת עם צבע רקע, גבולות לכל התאים,
// מרכוז אופקי ואנכי, גלישת טקסט בכותרת, רוחב עמודות אוטומטי, גיליון RTL,
// וסינון אוטומטי. הצביעה חלה על טווח הנתונים בלבד ולא על הגיליון כולו.

// ─────────────────────────── עיצוב ───────────────────────────
// ריכוז כל הצבעים במקום אחד — סבא ביקש "צבע יפה" בסגנון ERP ולא נקב
// בגוון מסוים. הערכים כאן תואמים לתכלת של האתר.
const HEADER_FILL = 'FFD6E9F8' // רקע הכותרת
const HEADER_TEXT = 'FF0C4A6E' // טקסט הכותרת
const BORDER_COLOR = 'FFB6C7D6'
const FONT_NAME = 'Arial'
const FONT_SIZE = 11

const MIN_COL_WIDTH = 10
const MAX_COL_WIDTH = 45
/** כמה שורות נדגמות לחישוב רוחב העמודה (מדידת הכל מיותרת ואיטית) */
const WIDTH_SAMPLE_ROWS = 400

export type CellValue = string | number | null | undefined

export interface SheetSpec {
  sheetName: string
  headers: string[]
  rows: CellValue[][]
  /** אינדקסים של עמודות שייכתבו כמספר ולא כטקסט */
  numericColumns?: Set<number>
}

// ─────────────────────────── XML ───────────────────────────

/**
 * בריחת תווים ל-XML.
 *
 * גם מסירה תווי בקרה שאינם חוקיים ב-XML 1.0. הם מגיעים מדי פעם מקובצי
 * משרד החינוך, ותו בודד כזה הופך את הקובץ לפגום — אקסל מסרב לפתוח אותו
 * בלי לומר למה.
 */
function esc(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    if (code < 0x20 && ch !== '\t' && ch !== '\n' && ch !== '\r') continue
    if (ch === '&') out += '&amp;'
    else if (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '"') out += '&quot;'
    else out += ch
  }
  return out
}

/** A, B, ... Z, AA, AB ... — שם עמודה באקסל לפי אינדקס מאפס */
export function colName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

/**
 * גיליונות הסגנון.
 *
 * שני המילויים הראשונים (none ו-gray125) חובה בסדר הזה — אקסל מניח
 * אותם, ובלעדיהם הצבעים מוזזים באינדקס אחד והכותרת יוצאת אפורה.
 *
 * סגנון 1 = כותרת, סגנון 2 = תא נתונים.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="${FONT_SIZE}"/><name val="${FONT_NAME}"/></font>
<font><b/><sz val="${FONT_SIZE}"/><color rgb="${HEADER_TEXT}"/><name val="${FONT_NAME}"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${HEADER_FILL}"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border>
<left style="thin"><color rgb="${BORDER_COLOR}"/></left>
<right style="thin"><color rgb="${BORDER_COLOR}"/></right>
<top style="thin"><color rgb="${BORDER_COLOR}"/></top>
<bottom style="thin"><color rgb="${BORDER_COLOR}"/></bottom>
<diagonal/>
</border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function workbookXml(sheetName: string): string {
  // אקסל מגביל שם גיליון ל-31 תווים ואוסר על \ / ? * [ ]
  const safe = esc(sheetName.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'גיליון1')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${safe}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
}

/** רוחב עמודה משוער לפי התוכן — "התאם אוטומטית רוחב עמודה" */
function columnWidths(spec: SheetSpec): number[] {
  const widths = spec.headers.map((h) => String(h ?? '').length + 4) // מקום לחץ הסינון
  const sample = Math.min(spec.rows.length, WIDTH_SAMPLE_ROWS)

  for (let r = 0; r < sample; r++) {
    const row = spec.rows[r]
    for (let c = 0; c < spec.headers.length; c++) {
      const len = String(row[c] ?? '').length
      if (len + 2 > widths[c]) widths[c] = len + 2
    }
  }

  return widths.map((w) => Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, w)))
}

function sheetXml(spec: SheetSpec): string {
  const cols = spec.headers.length
  const lastCol = colName(Math.max(0, cols - 1))
  const lastRow = spec.rows.length + 1
  const range = `A1:${lastCol}${lastRow}`
  const numeric = spec.numericColumns ?? new Set<number>()

  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
  parts.push(
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  )
  parts.push(`<dimension ref="${range}"/>`)
  // rightToLeft — הגיליון נפתח מימין לשמאל, כמו הממשק
  // pane/frozen — "הכי חשוב, עוד פעם הכי חשוב: שורת כותרת להקפיא"
  parts.push(
    '<sheetViews><sheetView rightToLeft="1" tabSelected="1" workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
      '</sheetView></sheetViews>',
  )
  parts.push('<sheetFormatPr defaultRowHeight="15"/>')

  const widths = columnWidths(spec)
  parts.push('<cols>')
  widths.forEach((w, i) => {
    parts.push(`<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`)
  })
  parts.push('</cols>')

  parts.push('<sheetData>')

  // שורת הכותרת — גובה כפול כדי שגלישת הטקסט תיראה
  parts.push('<row r="1" ht="30" customHeight="1">')
  spec.headers.forEach((h, c) => {
    parts.push(
      `<c r="${colName(c)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${esc(String(h ?? ''))}</t></is></c>`,
    )
  })
  parts.push('</row>')

  spec.rows.forEach((row, r) => {
    const rowNum = r + 2
    parts.push(`<row r="${rowNum}">`)
    for (let c = 0; c < cols; c++) {
      const ref = `${colName(c)}${rowNum}`
      const value = row[c]
      if (value === null || value === undefined || value === '') {
        // תא ריק במקור נשאר ריק — אבל עם גבול, כדי שהטבלה תיראה שלמה
        parts.push(`<c r="${ref}" s="2"/>`)
        continue
      }
      if (numeric.has(c) && typeof value === 'number' && Number.isFinite(value)) {
        parts.push(`<c r="${ref}" s="2"><v>${value}</v></c>`)
      } else {
        parts.push(
          `<c r="${ref}" s="2" t="inlineStr"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`,
        )
      }
    }
    parts.push('</row>')
  })

  parts.push('</sheetData>')
  // סינון אוטומטי — נותן בקובץ המיוצא בדיוק את חצי הסינון שסבא עובד איתם
  parts.push(`<autoFilter ref="${range}"/>`)
  parts.push('</worksheet>')

  return parts.join('')
}

// ─────────────────────────── ZIP ───────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** דחיסת DEFLATE דרך ה-API של הדפדפן; ללא תמיכה — נשמר ללא דחיסה. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(
      new CompressionStream('deflate-raw'),
    )
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** תאריך ושעה בפורמט DOS, כפי ש-ZIP דורש */
function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

async function makeZip(entries: ZipEntry[]): Promise<Blob> {
  const encoder = new TextEncoder()
  const { time, date } = dosDateTime(new Date())
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const deflated = await deflateRaw(entry.data)
    const stored = deflated ?? entry.data
    const method = deflated ? 8 : 0

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true) // שם הקובץ ב-UTF-8
    lv.setUint16(8, method, true)
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, stored.length, true)
    lv.setUint32(22, entry.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    chunks.push(local, stored)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, method, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, stored.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length + stored.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...chunks, ...central, end] as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ─────────────────────────── API ───────────────────────────

/** בונה את חבילת ה-xlsx ומחזיר Blob מוכן להורדה. */
export async function buildWorkbook(spec: SheetSpec): Promise<Blob> {
  const encoder = new TextEncoder()
  const file = (name: string, xml: string): ZipEntry => ({
    name,
    data: encoder.encode(xml),
  })

  return makeZip([
    file('[Content_Types].xml', CONTENT_TYPES),
    file('_rels/.rels', ROOT_RELS),
    file('xl/workbook.xml', workbookXml(spec.sheetName)),
    file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS),
    file('xl/styles.xml', STYLES),
    file('xl/worksheets/sheet1.xml', sheetXml(spec)),
  ])
}

/** בונה ומוריד את הקובץ בדפדפן. */
export async function downloadWorkbook(spec: SheetSpec, fileName: string): Promise<void> {
  const blob = await buildWorkbook(spec)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // שחרור מושהה — ברקע ההורדה עדיין קוראת מה-URL
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
