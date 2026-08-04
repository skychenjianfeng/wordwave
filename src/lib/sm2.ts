import { addDays, todayKey } from './dates';
import type { ReviewRecord } from '../types';

export function createReview(): ReviewRecord {
  return {
    reps: 0,
    ef: 2.5,
    intervalDays: 0,
    nextReview: todayKey(),
    lastReviewed: null,
    history: [],
  };
}

export function applyReview(record: ReviewRecord, quality: number): ReviewRecord {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const next: ReviewRecord = {
    ...record,
    history: [...record.history, q],
  };

  if (q >= 3) {
    if (next.reps === 0) {
      next.intervalDays = 1;
    } else if (next.reps === 1) {
      next.intervalDays = 6;
    } else {
      next.intervalDays = Math.max(1, Math.round(next.intervalDays * next.ef));
    }
    next.reps += 1;
  } else {
    next.reps = 0;
    next.intervalDays = 1;
  }

  next.ef = Math.max(1.3, next.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  next.nextReview = addDays(todayKey(), next.intervalDays);
  next.lastReviewed = new Date().toISOString();
  return next;
}

export function isDue(record: ReviewRecord, today: string): boolean {
  return record.nextReview <= today;
}
