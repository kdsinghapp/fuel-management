// src/lib/pgtTime.ts
/**
 * Papua New Guinea Time (PGT) Utility
 * Time Zone: Pacific/Port_Moresby (UTC+10:00, no Daylight Saving Time)
 */

export const PGT_TIMEZONE = 'Pacific/Port_Moresby';

export interface PGTTimeInfo {
  timeStr: string;        // "HH:mm" (e.g. "08:00")
  dateStr: string;        // "YYYY-MM-DD" (e.g. "2026-09-10")
  hour: number;           // 0 - 23
  minute: number;         // 0 - 59
  dayOfWeek: number;      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayOfMonth: number;     // 1 - 31
  formattedDateTime: string; // e.g. "10 Sep 2026, 08:00 AM PGT (UTC+10)"
  isoWithOffset: string;  // e.g. "2026-09-10T08:00:00+10:00"
  pgtDateObject: Date;    // Date constructed from PGT year, month, day, hour, min
}

/**
 * Returns complete date and time information in Papua New Guinea Time (PGT, UTC+10)
 */
export function getPGTTimeInfo(baseDate: Date = new Date()): PGTTimeInfo {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PGT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(baseDate);
  const find = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = find('year');
  const month = find('month');
  const day = find('day');
  let hourStr = find('hour');
  if (hourStr === '24') hourStr = '00';
  const minuteStr = find('minute');
  const secondStr = find('second');

  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const dayOfMonth = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  const pgtDateObject = new Date(yearNum, monthNum - 1, dayOfMonth, hour, minute, parseInt(secondStr, 10));
  const dayOfWeek = pgtDateObject.getDay();

  // Format 12-hour display string
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDateTime = `${day} ${monthNames[monthNum - 1]} ${year}, ${String(h12).padStart(2, '0')}:${minuteStr} ${ampm} PGT (UTC+10)`;

  return {
    timeStr: `${hourStr}:${minuteStr}`,
    dateStr: `${year}-${month}-${day}`,
    hour,
    minute,
    dayOfWeek,
    dayOfMonth,
    formattedDateTime,
    isoWithOffset: `${year}-${month}-${day}T${hourStr}:${minuteStr}:${secondStr}+10:00`,
    pgtDateObject,
  };
}

/**
 * Returns current PGT "YYYY-MM-DD" string
 */
export function getPGTDateString(baseDate: Date = new Date()): string {
  return getPGTTimeInfo(baseDate).dateStr;
}

/**
 * Returns current PGT "HH:mm" string
 */
export function getPGTTimeString(baseDate: Date = new Date()): string {
  return getPGTTimeInfo(baseDate).timeStr;
}
