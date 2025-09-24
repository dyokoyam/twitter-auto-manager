import { logger as log } from './logger.js';
import { getJapanTimeParts, type JapanTimeParts } from './time.js';

export type ScheduleWindow = {
  raw: string;
  hour: number;
  startMinute: number;
  endMinute: number;
  label: string;
  mode: 'hour' | 'minute';
};

export type ScheduleEvaluationReason = 'no_schedule' | 'outside_window';

export type ScheduleEvaluation = {
  shouldPost: boolean;
  matchedWindow?: ScheduleWindow;
  reason: ScheduleEvaluationReason | null;
  windows: ScheduleWindow[];
  now: JapanTimeParts;
  nextWindow?: ScheduleWindow;
};

const SCHEDULE_TOKEN_PATTERN = /^(\d{1,2})(?::(\d{2}))?$/;

const pad = (value: number) => value.toString().padStart(2, '0');

const createWindowLabel = (hour: number, startMinute: number, endMinute: number) =>
  `${pad(hour)}:${pad(startMinute)}-${pad(hour)}:${pad(endMinute)} JST`;

const parseToken = (token: string): ScheduleWindow | null => {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(SCHEDULE_TOKEN_PATTERN);
  if (!match) {
    log.warn(`[schedule] ignoring invalid token "${trimmed}"`);
    return null;
  }

  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    log.warn(`[schedule] ignoring token "${trimmed}" because hour is out of range (00-23)`);
    return null;
  }

  const rawMinute = match[2];
  const minute = rawMinute !== undefined ? Number(rawMinute) : null;
  if (minute !== null && (Number.isNaN(minute) || minute < 0 || minute > 59)) {
    log.warn(`[schedule] ignoring token "${trimmed}" because minute is out of range (00-59)`);
    return null;
  }

  if (minute === null) {
    log.debug(`[schedule] interpreting token "${trimmed}" as ${createWindowLabel(hour, 0, 59)}`);
    return {
      raw: trimmed,
      hour,
      startMinute: 0,
      endMinute: 59,
      label: createWindowLabel(hour, 0, 59),
      mode: 'hour',
    };
  }

  if (minute === 0) {
    log.debug(`[schedule] widening token "${trimmed}" to ${createWindowLabel(hour, 0, 59)} to allow GitHub Actions drift`);
    return {
      raw: trimmed,
      hour,
      startMinute: 0,
      endMinute: 59,
      label: createWindowLabel(hour, 0, 59),
      mode: 'hour',
    };
  }

  return {
    raw: trimmed,
    hour,
    startMinute: minute,
    endMinute: minute,
    label: createWindowLabel(hour, minute, minute),
    mode: 'minute',
  };
};

export const parseScheduledWindows = (input?: string | null): ScheduleWindow[] => {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((token) => parseToken(token))
    .filter((window): window is ScheduleWindow => Boolean(window));
};

const sortWindows = (windows: ScheduleWindow[]) =>
  [...windows].sort((a, b) => {
    if (a.hour !== b.hour) {
      return a.hour - b.hour;
    }
    return a.startMinute - b.startMinute;
  });

export const evaluateSchedule = (
  scheduledTimes?: string | null,
  date: Date = new Date(),
): ScheduleEvaluation => {
  const windows = parseScheduledWindows(scheduledTimes);
  const now = getJapanTimeParts(date);

  if (windows.length === 0) {
    return {
      shouldPost: false,
      reason: 'no_schedule',
      windows,
      now,
    };
  }

  const matchedWindow = windows.find(
    (window) =>
      now.hour === window.hour && now.minute >= window.startMinute && now.minute <= window.endMinute,
  );

  if (matchedWindow) {
    return {
      shouldPost: true,
      matchedWindow,
      reason: null,
      windows,
      now,
    };
  }

  const sorted = sortWindows(windows);
  const nowTotalMinutes = now.hour * 60 + now.minute;
  const nextWindow = sorted.find((window) => window.hour * 60 + window.startMinute > nowTotalMinutes) ?? sorted[0];

  return {
    shouldPost: false,
    reason: 'outside_window',
    windows,
    now,
    nextWindow,
  };
};
