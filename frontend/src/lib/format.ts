const EN_DASH = '\u2013';
// U+2212 MINUS SIGN for negative numbers
const MINUS = '\u2212';

/**
 * Format generation in MW with thousands separators (e.g. 1,234 or 15,169).
 * Negative values use U+2212 MINUS SIGN.
 * Returns en-dash for null, undefined, or NaN.
 */
export function fmtMW(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return EN_DASH;
  }
  const abs = Math.abs(Math.round(val));
  const formatted = abs.toLocaleString('en-GB');
  return val < 0 ? `${MINUS}${formatted}` : formatted;
}

/**
 * Format generation in GW with 1 decimal place (e.g. 1.2 or 15.2).
 * Does NOT append " GW" – caller adds unit for StatTile.
 * Returns en-dash for null, undefined, or NaN.
 */
export function fmtGW(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return EN_DASH;
  }
  const gw = val / 1000;
  const abs = Math.abs(gw);
  const str = abs.toFixed(1);
  return val < 0 ? `${MINUS}${str}` : str;
}

/**
 * Format a number as GW with " GW" suffix, suitable for prose/headings.
 */
export function fmtGWLabel(val: number | null | undefined): string {
  const v = fmtGW(val);
  return v === EN_DASH ? EN_DASH : `${v} GW`;
}

/**
 * Format generation in GWh with 1 decimal place (from MWh/MWh-equivalent).
 * Does NOT append " GWh" – caller adds unit.
 * Returns en-dash for null, undefined, or NaN.
 */
export function fmtGWh(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return EN_DASH;
  }
  // val is in MWh (from total_forecast_mwh), convert to GWh
  const gwh = val / 1000;
  const abs = Math.abs(gwh);
  const str = abs.toFixed(1);
  return val < 0 ? `${MINUS}${str}` : str;
}

/**
 * Format percentage with 1 decimal place (e.g. 18.1% or +18.1%).
 * Returns en-dash for null, undefined, or NaN.
 */
export function fmtPct(val: number | null | undefined, signed: boolean = false): string {
  if (val === null || val === undefined || isNaN(val)) {
    return EN_DASH;
  }
  const abs = Math.abs(val);
  const str = `${abs.toFixed(1)}%`;
  if (val < 0) return `${MINUS}${str}`;
  if (signed && val > 0) return `+${str}`;
  return str;
}

/**
 * Format signed number with explicit + or real minus, e.g. +1,234 or −1,748.
 * Returns en-dash for null, undefined, or NaN.
 */
export function fmtSigned(val: number | null | undefined, unit: string = ''): string {
  if (val === null || val === undefined || isNaN(val)) {
    return EN_DASH;
  }
  const rounded = Math.round(val);
  const abs = Math.abs(rounded).toLocaleString('en-GB');
  const unitSuffix = unit ? ` ${unit}` : '';
  if (rounded < 0) return `${MINUS}${abs}${unitSuffix}`;
  if (rounded > 0) return `+${abs}${unitSuffix}`;
  return `0${unitSuffix}`;
}

/**
 * Format signed GW with explicit + or real minus (e.g. −1.8 GW).
 */
export function fmtSignedGW(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return EN_DASH;
  }
  const gw = val / 1000;
  const abs = Math.abs(gw).toFixed(1);
  if (val < 0) return `${MINUS}${abs} GW`;
  if (val > 0) return `+${abs} GW`;
  return '0.0 GW';
}

/**
 * Format UTC timestamp into clock representation (e.g. "07:30 UTC").
 * Returns en-dash for null, undefined, or invalid inputs.
 */
export function fmtUtcTime(isoOrTime: string | null | undefined): string {
  if (!isoOrTime) {
    return EN_DASH;
  }
  // If it's an ISO string like 2026-01-06T07:30:00Z
  if (isoOrTime.includes('T')) {
    const timePart = isoOrTime.split('T')[1]?.replace('Z', '') || '';
    const [hh, mm] = timePart.split(':');
    if (hh !== undefined && mm !== undefined) {
      return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')} UTC`;
    }
  }
  // If it's already HH:MM
  if (/^\d{1,2}:\d{2}/.test(isoOrTime)) {
    const [hh, mm] = isoOrTime.split(':');
    if (hh !== undefined && mm !== undefined) {
      return `${hh.padStart(2, '0')}:${mm.substring(0, 2)} UTC`;
    }
  }
  return isoOrTime;
}

/**
 * Format a full ISO UTC timestamp to "29 Oct 2026, 05:23 UTC".
 * Returns en-dash for null, undefined, or invalid.
 */
export function fmtFullUtcDateTime(iso: string | null | undefined): string {
  if (!iso) return EN_DASH;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return EN_DASH;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = dt.getUTCDate();
  const mo = months[dt.getUTCMonth()];
  const y = dt.getUTCFullYear();
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${d} ${mo} ${y}, ${hh}:${mm} UTC`;
}

/**
 * Format date string "YYYY-MM-DD" to UK short format "Wed 7 Jan 2026".
 * Returns en-dash for null, undefined, or invalid strings.
 */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return EN_DASH;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  // UTC date to avoid local timezone off-by-one shifts
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (isNaN(dt.getTime())) {
    return EN_DASH;
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayOfWeek = days[dt.getUTCDay()];
  const dayOfMonth = dt.getUTCDate();
  const monthName = months[dt.getUTCMonth()];
  const year = dt.getUTCFullYear();

  return `${dayOfWeek} ${dayOfMonth} ${monthName} ${year}`;
}

/**
 * Format date as short day+date (e.g. "Tue 6 Jan") without year.
 */
export function fmtDateShort(dateStr: string | null | undefined): string {
  const full = fmtDate(dateStr);
  if (full === EN_DASH) return EN_DASH;
  // Strip the year (last 5 chars: " YYYY")
  const parts = full.split(' ');
  return parts.slice(0, 3).join(' ');
}

/**
 * Parse an ISO datetime string to extract "Tue 6 Jan, 07:30 UTC" from publish_time.
 */
export function fmtPublishTime(iso: string | null | undefined): string {
  if (!iso) return EN_DASH;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dow = days[dt.getUTCDay()];
  const d = dt.getUTCDate();
  const mo = months[dt.getUTCMonth()];
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${dow} ${d} ${mo}, ${hh}:${mm} UTC`;
}
