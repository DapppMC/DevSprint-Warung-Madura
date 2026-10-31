// The warung operates in WIB (UTC+7, no daylight saving). "Today" means the WIB calendar day,
// independent of the timezone of the machine running the server.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDayWib(date: Date): Date {
  const shifted = date.getTime() + WIB_OFFSET_MS;
  const startOfShiftedDay = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(startOfShiftedDay - WIB_OFFSET_MS);
}

export function endOfDayWib(date: Date): Date {
  return new Date(startOfDayWib(date).getTime() + DAY_MS);
}

// "20261007" for 7 October 2026 (WIB). Used in invoice numbers.
export function formatDateKeyWib(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10).replaceAll('-', '');
}
