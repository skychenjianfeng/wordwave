export interface Word {
  id: number;
  freq: number;
  word: string;
  meaning: string;
  alt: string | null;
  category: string;
  subcategory: string | null;
  ipa?: string | null;
}

export interface DictMeta {
  id: string;
  name: string;
  description: string;
  count: number;
  difficulty: string;
  category: string;
  tags: string[];
  source: string;
}

export interface ReviewRecord {
  reps: number;
  ef: number;
  intervalDays: number;
  nextReview: string; // YYYY-MM-DD
  lastReviewed: string | null; // ISO string
  history: number[];
}

export interface WordNotes {
  wordNote: string;
  syllableNotes: string[];
}

export type WordStatus = 'new' | 'learning' | 'mastered';

export interface WordProgress {
  status: WordStatus;
  known: number;
  unknown: number;
  learnedAt: string | null;
  lastSeen: string | null;
  wrongCount: number;
  lastWrongAt: string | null;
  review: ReviewRecord | null;
  notes: WordNotes;
}

export interface ExampleData {
  english: string;
  chinese?: string;
  distinction?: string;
  withTranslation: boolean;
}

export type ExampleStyle =
  | 'exam'
  | 'daily'
  | 'funny'
  | 'business'
  | 'story'
  | 'tiktok'
  | 'twitter';

export type PageId =
  | 'study'
  | 'autoplay'
  | 'review'
  | 'quiz'
  | 'stats'
  | 'list'
  | 'data'
  | 'personal'
  | 'settings';

export type SwitchKey =
  | 'readMeaning'
  | 'aiExamples'
  | 'withTranslation'
  | 'syllables'
  | 'showMeaningCard';
