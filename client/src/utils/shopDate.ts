/**
 * Shop calendar helpers. Timestamps are stored in UTC; the business day is
 * Africa/Nairobi (UTC+3). Slicing the ISO string or using browser midnight
 * puts early-morning sales on the wrong day.
 */

export const SHOP_TIME_ZONE = 'Africa/Nairobi';

const shopDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Business day of a timestamp, as YYYY-MM-DD in shop time. */
export const shopDateKey = (rawDate?: string | null): string | null => {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return shopDateFormatter.format(parsed);
};

/** Today's business date in Nairobi, as YYYY-MM-DD. */
export const shopTodayKey = (): string => shopDateKey(new Date().toISOString())!;

/**
 * Shift a YYYY-MM-DD key by N calendar days in shop time.
 * Used for week/month presets without depending on the browser's zone.
 */
export const shopDateKeyPlusDays = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  // Noon UTC avoids DST edge cases when shifting calendar days.
  const mid = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  mid.setUTCDate(mid.getUTCDate() + days);
  return shopDateFormatter.format(mid);
};

/** First day of the Nairobi calendar month that contains `key`. */
export const shopMonthStartKey = (key: string): string => `${key.slice(0, 7)}-01`;

/** First day of the Nairobi calendar year that contains `key`. */
export const shopYearStartKey = (key: string): string => `${key.slice(0, 4)}-01-01`;

/**
 * Sunday that starts the Nairobi week containing `key` (matches the previous
 * browser-local week start of Sunday).
 */
export const shopWeekStartKey = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  const mid = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // getUTCDay: 0 = Sunday
  const dow = mid.getUTCDay();
  mid.setUTCDate(mid.getUTCDate() - dow);
  return shopDateFormatter.format(mid);
};

/** True when the sale's shop-day is on or after `startKey` (inclusive). */
export const saleOnOrAfter = (saleDateTime: string | null | undefined, startKey: string): boolean => {
  const key = shopDateKey(saleDateTime);
  return !!key && key >= startKey;
};

/** True when the sale's shop-day is between start and end inclusive. */
export const saleInDateRange = (
  saleDateTime: string | null | undefined,
  startKey: string,
  endKey: string
): boolean => {
  const key = shopDateKey(saleDateTime);
  return !!key && key >= startKey && key <= endKey;
};

/** Units on a sale row, tolerating either column name. */
export const saleQuantity = (sale: any): number =>
  Number(sale?.quantity_sold ?? sale?.quantity ?? 0) || 0;

export const saleAmount = (sale: any): number =>
  Number(sale?.total_amount ?? 0) || 0;
