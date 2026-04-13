const EASTERN_TIME_ZONE = "America/New_York";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseLocalDateTimeValue(value: string): DateTimeParts | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

function partsToLocalValue(parts: DateTimeParts) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(
    parts.minute
  )}`;
}

function getTimeZoneParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getEasternOffsetMs(timestamp: number) {
  const date = new Date(timestamp);
  const parts = getTimeZoneParts(date);
  const zoneAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return zoneAsUtc - timestamp;
}

export function formatEasternDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)} ET`;
}

export function formatEasternDateTimeShort(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)} ET`;
}

export function toEasternDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return partsToLocalValue(getTimeZoneParts(date));
}

export function fromEasternDateTimeLocalValue(value: string) {
  const parts = parseLocalDateTimeValue(value);
  if (!parts) return "";

  const roundedHour = parts.minute >= 30 ? parts.hour + 1 : parts.hour;
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    roundedHour,
    0
  );

  let utc = utcGuess - getEasternOffsetMs(utcGuess);

  for (let i = 0; i < 2; i += 1) {
    const offset = getEasternOffsetMs(utc);
    const nextUtc = utcGuess - offset;
    if (nextUtc === utc) break;
    utc = nextUtc;
  }

  return new Date(utc).toISOString();
}

export function normalizeEasternDateTimeLocalValue(value: string) {
  const parts = parseLocalDateTimeValue(value);
  if (!parts) return value;

  return partsToLocalValue({
    ...parts,
    minute: 0,
  });
}

export function shiftEasternDateTimeLocalValue(
  value: string,
  days: number
) {
  const parts = parseLocalDateTimeValue(value);
  if (!parts) return "";

  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  );
  date.setUTCDate(date.getUTCDate() + days);

  return partsToLocalValue({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  });
}
