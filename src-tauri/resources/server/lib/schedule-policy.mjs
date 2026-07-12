export const MIN_SCHEDULE_INTERVAL_MS = 60 * 1000;
export const MAX_SCHEDULE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export function isValidDailyTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value) {
  if (!isValidDailyTime(value)) return null;
  const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

export function isValidRunWindow(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return startMinutes !== null && endMinutes !== null && startMinutes < endMinutes;
}

export function normalizeDayOfWeek(value, fallback = 1) {
  const day = Number(value);
  if (!Number.isFinite(day)) return fallback;
  return Math.max(0, Math.min(6, Math.floor(day)));
}

function isWeekday(date) {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

export function isScheduleAllowedAt(task, atMs = Date.now()) {
  const date = new Date(atMs);
  if (task.weekdaysOnly && !isWeekday(date)) return { ok: false, reason: "outside run window: weekdays only" };
  if (task.windowEnabled) {
    const start = timeToMinutes(task.windowStart);
    const end = timeToMinutes(task.windowEnd);
    if (start === null || end === null || start >= end) return { ok: false, reason: "invalid run window" };
    const current = date.getHours() * 60 + date.getMinutes();
    if (current < start || current >= end) return { ok: false, reason: `outside run window: ${task.windowStart}-${task.windowEnd}` };
  }
  return { ok: true, reason: null };
}

function nextScheduleWindowStart(task, fromMs) {
  const candidate = new Date(fromMs);
  candidate.setSeconds(0, 0);
  const start = timeToMinutes(task.windowEnabled ? task.windowStart : "00:00") ?? 0;
  for (let index = 0; index < 14; index++) {
    if (task.weekdaysOnly && !isWeekday(candidate)) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (task.windowEnabled) {
      const end = timeToMinutes(task.windowEnd);
      const current = candidate.getHours() * 60 + candidate.getMinutes();
      if (current < start) {
        candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
      } else if (end !== null && current >= end) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
        continue;
      }
    }
    if (isScheduleAllowedAt(task, candidate.getTime()).ok) return candidate.toISOString();
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
  }
  return null;
}

export function computeNextScheduleRun(task, fromMs = Date.now()) {
  if (!task?.enabled) return null;
  let nextIso;
  if (task.type === "daily" || task.type === "weekly") {
    if (!isValidDailyTime(task.timeOfDay)) return null;
    const [hours, minutes] = task.timeOfDay.split(":").map((part) => Number.parseInt(part, 10));
    const next = new Date(fromMs);
    next.setSeconds(0, 0);
    next.setHours(hours, minutes, 0, 0);
    if (task.type === "daily") {
      if (next.getTime() <= fromMs) next.setDate(next.getDate() + 1);
    } else {
      const targetDay = normalizeDayOfWeek(task.dayOfWeek, 1);
      let addDays = (targetDay - next.getDay() + 7) % 7;
      if (addDays === 0 && next.getTime() <= fromMs) addDays = 7;
      if (addDays > 0) next.setDate(next.getDate() + addDays);
    }
    nextIso = next.toISOString();
  } else {
    const intervalMs = Number(task.intervalMs);
    if (!Number.isFinite(intervalMs) || intervalMs < MIN_SCHEDULE_INTERVAL_MS || intervalMs > MAX_SCHEDULE_INTERVAL_MS) return null;
    nextIso = new Date(fromMs + intervalMs).toISOString();
  }
  return nextScheduleWindowStart(task, Date.parse(nextIso));
}
