export const TOKYO_TIMEZONE = 'Asia/Tokyo';

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TOKYO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const hourMinuteFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: TOKYO_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TOKYO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export type JapanTimeParts = {
  hour: number;
  minute: number;
  second: number;
  iso: string;
};

export const formatJapanDateTime = (date: Date = new Date()) => dateTimeFormatter.format(date);

export const formatJapanHourMinute = (date: Date = new Date()) => hourMinuteFormatter.format(date);

export const getJapanTimeParts = (date: Date = new Date()): JapanTimeParts => {
  const parts = isoFormatter.formatToParts(date);
  const valueByType: Record<string, string> = {};

  for (const part of parts) {
    if (part.type === 'literal') {
      continue;
    }
    valueByType[part.type] = part.value;
  }

  const hour = Number(valueByType.hour ?? '0');
  const minute = Number(valueByType.minute ?? '0');
  const second = Number(valueByType.second ?? '0');
  const iso = `${valueByType.year}-${valueByType.month}-${valueByType.day}T${valueByType.hour}:${valueByType.minute}:${valueByType.second}+09:00`;

  return { hour, minute, second, iso };
};

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
