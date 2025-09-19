export const TOKYO_TIMEZONE = 'Asia/Tokyo';

export const formatJapanDateTime = () =>
  new Date().toLocaleString('ja-JP', {
    timeZone: TOKYO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export const formatJapanHourMinute = () =>
  new Date().toLocaleTimeString('ja-JP', {
    timeZone: TOKYO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
