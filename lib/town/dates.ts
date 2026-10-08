// Dates are plain "YYYY-MM-DD" strings in the viewer's calendar, never Date
// objects in UTC, so a memory never slides into the wrong month.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthKey(day: string) {
  return day.slice(0, 7);
}

export function monthIndex(key: string) {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function monthName(key: string) {
  return MONTHS[Number(key.slice(5, 7)) - 1];
}

// "JUL 2026"
export function shortMonthLabel(key: string) {
  return `${monthName(key).slice(0, 3).toUpperCase()} ${key.slice(0, 4)}`;
}

// "July 2026"
export function longMonthLabel(key: string) {
  return `${monthName(key)} ${key.slice(0, 4)}`;
}

// "Jul 14"
export function shortDay(day: string) {
  return `${MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3)} ${Number(day.slice(8, 10))}`;
}

// "Oct 8, 2026"
export function fullDay(day: string) {
  return `${shortDay(day)}, ${day.slice(0, 4)}`;
}

export function toDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toDay(new Date());
}
