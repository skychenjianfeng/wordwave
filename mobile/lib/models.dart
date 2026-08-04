enum ExampleStyle { exam, daily, funny, business, story, tiktok, twitter }

enum AutoplayOrder { freq, random, unknown, wrong, category, range }

class Word {
  final int id;
  final int freq;
  final String word;
  final String meaning;
  final String? alt;
  final String category;
  final String? subcategory;
  final String? ipa;

  const Word({
    required this.id,
    required this.freq,
    required this.word,
    required this.meaning,
    this.alt,
    required this.category,
    this.subcategory,
    this.ipa,
  });

  factory Word.fromJson(Map<String, dynamic> j) => Word(
        id: (j['id'] as num?)?.toInt() ?? 0,
        freq: (j['freq'] as num?)?.toInt() ?? 0,
        word: (j['word'] as String?) ?? '',
        meaning: (j['meaning'] as String?) ?? '',
        alt: j['alt'] as String?,
        category: (j['category'] as String?) ?? '',
        subcategory: j['subcategory'] as String?,
        ipa: j['ipa'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'freq': freq,
        'word': word,
        'meaning': meaning,
        'alt': alt,
        'category': category,
        'subcategory': subcategory,
        'ipa': ipa,
      };
}

class DictMeta {
  final String id;
  final String name;
  final String description;
  final int count;
  final String difficulty;
  final String category;
  final List<String> tags;
  final String source;

  const DictMeta({
    required this.id,
    required this.name,
    required this.description,
    required this.count,
    required this.difficulty,
    required this.category,
    required this.tags,
    required this.source,
  });

  factory DictMeta.fromJson(Map<String, dynamic> j) => DictMeta(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        description: j['description'] as String? ?? '',
        count: (j['count'] as num?)?.toInt() ?? 0,
        difficulty: j['difficulty'] as String? ?? '',
        category: j['category'] as String? ?? '',
        tags: ((j['tags'] as List?) ?? []).map((e) => e.toString()).toList(),
        source: j['source'] as String? ?? '',
      );
}

class ReviewRecord {
  int reps;
  double ef;
  int intervalDays;
  String nextReview;
  String? lastReviewed;
  List<int> history;

  ReviewRecord({
    this.reps = 0,
    this.ef = 2.5,
    this.intervalDays = 0,
    required this.nextReview,
    this.lastReviewed,
    List<int>? history,
  }) : history = history ?? [];

  factory ReviewRecord.fromJson(Map<String, dynamic>? j) => ReviewRecord(
        reps: (j?['reps'] as num?)?.toInt() ?? 0,
        ef: (j?['ef'] as num?)?.toDouble() ?? 2.5,
        intervalDays: (j?['intervalDays'] as num?)?.toInt() ?? 0,
        nextReview: j?['nextReview'] as String? ?? todayKey(),
        lastReviewed: j?['lastReviewed'] as String?,
        history: ((j?['history'] as List?) ?? [])
            .map((e) => (e as num).toInt())
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'reps': reps,
        'ef': ef,
        'intervalDays': intervalDays,
        'nextReview': nextReview,
        'lastReviewed': lastReviewed,
        'history': history,
      };
}

class WordProgress {
  String status; // new / learning / mastered
  int known;
  int unknown;
  String? learnedAt;
  String? lastSeen;
  int wrongCount;
  String? lastWrongAt;
  ReviewRecord? review;
  WordNotes notes;

  WordProgress({
    this.status = 'new',
    this.known = 0,
    this.unknown = 0,
    this.learnedAt,
    this.lastSeen,
    this.wrongCount = 0,
    this.lastWrongAt,
    this.review,
    WordNotes? notes,
  }) : notes = notes ?? WordNotes();

  factory WordProgress.fromJson(Map<String, dynamic>? j) => WordProgress(
        status: (j?['status'] as String?) ?? 'new',
        known: (j?['known'] as num?)?.toInt() ?? 0,
        unknown: (j?['unknown'] as num?)?.toInt() ?? 0,
        learnedAt: j?['learnedAt'] as String?,
        lastSeen: j?['lastSeen'] as String?,
        wrongCount: (j?['wrongCount'] as num?)?.toInt() ?? 0,
        lastWrongAt: j?['lastWrongAt'] as String?,
        review: ReviewRecord.fromJson(j?['review'] as Map<String, dynamic>?),
        notes: WordNotes.fromJson(j?['notes'] as Map<String, dynamic>?),
      );

  Map<String, dynamic> toJson() => {
        'status': status,
        'known': known,
        'unknown': unknown,
        'learnedAt': learnedAt,
        'lastSeen': lastSeen,
        'wrongCount': wrongCount,
        'lastWrongAt': lastWrongAt,
        'review': review?.toJson(),
        'notes': notes.toJson(),
      };
}

class WordNotes {
  String wordNote;
  List<String> syllableNotes;

  WordNotes({this.wordNote = '', List<String>? syllableNotes})
      : syllableNotes = syllableNotes ?? [];

  factory WordNotes.fromJson(Map<String, dynamic>? j) => WordNotes(
        wordNote: (j?['wordNote'] as String?) ?? '',
        syllableNotes: ((j?['syllableNotes'] as List?) ?? [])
            .map((e) => e.toString())
            .toList(),
      );

  Map<String, dynamic> toJson() =>
      {'wordNote': wordNote, 'syllableNotes': syllableNotes};
}

class ExampleData {
  final String english;
  final String chinese;
  final String distinction;
  final bool withTranslation;

  const ExampleData({
    required this.english,
    this.chinese = '',
    this.distinction = '',
    this.withTranslation = false,
  });

  factory ExampleData.fromJson(Map<String, dynamic> j) => ExampleData(
        english: (j['english'] as String?) ?? '',
        chinese: (j['chinese'] as String?) ?? '',
        distinction: (j['distinction'] as String?) ?? '',
        withTranslation: (j['withTranslation'] as bool?) ?? false,
      );

  Map<String, dynamic> toJson() => {
        'english': english,
        'chinese': chinese,
        'distinction': distinction,
        'withTranslation': withTranslation,
      };
}

class AuthUser {
  final String id;
  final String username;
  final String? createdAt;

  const AuthUser({required this.id, required this.username, this.createdAt});

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: (j['id'] as String?) ?? '',
        username: (j['username'] as String?) ?? '',
        createdAt: j['createdAt'] as String?,
      );
}

class UserProfile {
  final String nickname;
  final String bio;
  final int dailyGoal;
  final String avatarColor;

  const UserProfile({
    required this.nickname,
    required this.bio,
    required this.dailyGoal,
    required this.avatarColor,
  });

  factory UserProfile.fromJson(Map<String, dynamic> j) => UserProfile(
        nickname: (j['nickname'] as String?) ?? '',
        bio: (j['bio'] as String?) ?? '',
        dailyGoal: (j['dailyGoal'] as num?)?.toInt() ?? 20,
        avatarColor: (j['avatarColor'] as String?) ?? 'emerald',
      );
}

class UserStats {
  final int learned;
  final int mastered;
  final int wrong;
  final int dueToday;
  final int todayLearned;
  final int streak;
  final int dailyGoal;
  final List<MapEntry<String, int>> last30;

  const UserStats({
    required this.learned,
    required this.mastered,
    required this.wrong,
    required this.dueToday,
    required this.todayLearned,
    required this.streak,
    required this.dailyGoal,
    required this.last30,
  });

  factory UserStats.fromJson(Map<String, dynamic> j) {
    final l30 = ((j['last30'] as List?) ?? []).map((e) {
      final m = e as Map<String, dynamic>;
      return MapEntry(
        m['date'] as String? ?? '',
        (m['count'] as num?)?.toInt() ?? 0,
      );
    }).toList();
    return UserStats(
      learned: (j['learned'] as num?)?.toInt() ?? 0,
      mastered: (j['mastered'] as num?)?.toInt() ?? 0,
      wrong: (j['wrong'] as num?)?.toInt() ?? 0,
      dueToday: (j['dueToday'] as num?)?.toInt() ?? 0,
      todayLearned: (j['todayLearned'] as num?)?.toInt() ?? 0,
      streak: (j['streak'] as num?)?.toInt() ?? 0,
      dailyGoal: (j['dailyGoal'] as num?)?.toInt() ?? 20,
      last30: l30,
    );
  }
}

class AutoplayConfig {
  AutoplayOrder order;
  String category;
  int rangeMin;
  int rangeMax;
  int count;
  int repeats;
  double interval;

  AutoplayConfig({
    this.order = AutoplayOrder.freq,
    this.category = '',
    this.rangeMin = 1,
    this.rangeMax = 5530,
    this.count = 20,
    this.repeats = 1,
    this.interval = 2,
  });

  Map<String, dynamic> toJson() => {
        'order': order.name,
        'category': category,
        'rangeMin': rangeMin,
        'rangeMax': rangeMax,
        'count': count,
        'repeats': repeats,
        'interval': interval,
      };

  factory AutoplayConfig.fromJson(Map<String, dynamic>? j) {
    final orderName = (j?['order'] as String?) ?? 'freq';
    return AutoplayConfig(
      order: AutoplayOrder.values.firstWhere(
        (e) => e.name == orderName,
        orElse: () => AutoplayOrder.freq,
      ),
      category: (j?['category'] as String?) ?? '',
      rangeMin: (j?['rangeMin'] as num?)?.toInt() ?? 1,
      rangeMax: (j?['rangeMax'] as num?)?.toInt() ?? 5530,
      count: (j?['count'] as num?)?.toInt() ?? 20,
      repeats: (j?['repeats'] as num?)?.toInt() ?? 1,
      interval: (j?['interval'] as num?)?.toDouble() ?? 2,
    );
  }
}

String todayKey([DateTime? d]) {
  final dt = d ?? DateTime.now();
  String p(int n) => n < 10 ? '0$n' : '$n';
  return '${dt.year}-${p(dt.month)}-${p(dt.day)}';
}

String addDays(String dateStr, int days) {
  final parts = dateStr.split('-').map(int.parse).toList();
  final dt = DateTime(parts[0], parts[1], parts[2]).add(Duration(days: days));
  return todayKey(dt);
}
