import '../models.dart';

ReviewRecord createReview() => ReviewRecord(nextReview: todayKey());

ReviewRecord applyReview(ReviewRecord record, int quality) {
  final q = quality.clamp(0, 5);
  final next = ReviewRecord(
    reps: record.reps,
    ef: record.ef,
    intervalDays: record.intervalDays,
    nextReview: record.nextReview,
    lastReviewed: record.lastReviewed,
    history: [...record.history, q],
  );
  if (q >= 3) {
    if (next.reps == 0) {
      next.intervalDays = 1;
    } else if (next.reps == 1) {
      next.intervalDays = 6;
    } else {
      next.intervalDays = (next.intervalDays * next.ef).round().clamp(1, 3650);
    }
    next.reps += 1;
  } else {
    next.reps = 0;
    next.intervalDays = 1;
  }
  next.ef = (next.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).clamp(1.3, 3.0);
  next.nextReview = addDays(todayKey(), next.intervalDays);
  next.lastReviewed = DateTime.now().toIso8601String();
  return next;
}

bool isDue(ReviewRecord record, String today) => record.nextReview.compareTo(today) <= 0;
