/**
 * הלוגו של מאיר יפה — שלוש דמויות בירוק, כחול-כהה ותכלת.
 *
 * הקובץ המקורי (`public/logo.png`) הומר מ-JPEG ל-PNG עם רקע שקוף, כדי
 * שיישב נכון גם על רקע כהה וגם על רקע בהיר. הוקטן ל-320px — פי חמישה
 * מגודל התצוגה הגדול ביותר באתר, כך שהוא חד גם במסכי רטינה.
 *
 * הצבעים מיוצאים לשימוש בגרפיקה אחרת באתר, כדי שהעיצוב יישאר מלוכד.
 */

export const LOGO_GREEN = '#6EB94A'
export const LOGO_BLUE = '#2FA3DB'
export const LOGO_INDIGO = '#2E3192'

export default function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="מאיר יפה — ייעוץ אסטרטגי למערכות חינוך"
      className={`${className} object-contain`}
      // הלוגו מופיע בכל דף ציבורי; טעינה מיידית מונעת קפיצה בפריסה
      loading="eager"
      decoding="async"
    />
  )
}
