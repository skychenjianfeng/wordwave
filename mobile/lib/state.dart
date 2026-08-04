import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'models.dart';
import 'services/sm2.dart';
import 'services/ipa.dart';
import 'services/speech_service.dart';
import 'services/syllables.dart';

class AppState extends ChangeNotifier {
  // 非 late：避免页面在 init() 完成前访问到未初始化字段
  ApiClient api = ApiClient(baseUrl: 'http://127.0.0.1:3101');
  SpeechService speech =
      SpeechService(ApiClient(baseUrl: 'http://127.0.0.1:3101'));
  SharedPreferences? _prefs;

  // 设置
  bool dark = false;
  double rate = 1.0;
  String accent = 'us';
  ExampleStyle exampleStyle = ExampleStyle.exam;
  int dailyGoal = 20;
  Map<String, bool> switches = {
    'readMeaning': true,
    'aiExamples': false,
    'withTranslation': true,
    'syllables': true,
    'showMeaningCard': true,
  };

  // 账号
  String? token;
  AuthUser? user;

  // 词库
  List<DictMeta> dicts = [];
  String activeDictId = 'kaoyan';
  List<Word> words = [];
  bool loading = false;
  String? error;
  final Map<String, int> kaoyanIdByWord = {};

  // 学习进度
  Map<String, WordProgress> records = {};
  Map<String, List<String>> dailyWords = {};
  Map<String, ExampleData> exampleCache = {};

  // 学习方式（下次打开保持）
  int studyIndex = 0;
  String? quizMode; // meaning / listen / spelling
  String wordlistCategory = '全部';
  String wordlistStatus = '全部';
  String wordlistQuery = '';

  // 自动播放
  AutoplayConfig config = AutoplayConfig();
  String status = 'idle'; // idle / playing / paused / finished
  List<Word> queue = [];
  int index = 0;
  int repeatIndex = 0;
  int total = 0;
  int done = 0;
  Word? currentWord;
  ExampleData? exampleData;
  bool exampleLoading = false;
  bool exampleFromCache = false;
  String? exampleError;
  int _gen = 0;

  Timer? _saveTimer;

  String get serverUrl => api.baseUrl;

  void refresh() => notifyListeners();

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    final server = _prefs?.getString('serverUrl') ?? 'http://127.0.0.1:3101';
    api = ApiClient(baseUrl: server);
    token = _prefs?.getString('token');
    if (token != null && token!.isNotEmpty) api.token = token;
    final u = _prefs?.getString('userJson');
    if (u != null && u.isNotEmpty) {
      user = AuthUser.fromJson(jsonDecode(u) as Map<String, dynamic>);
    }
    dark = _prefs?.getBool('dark') ?? false;
    rate = _prefs?.getDouble('rate') ?? 1.0;
    accent = _prefs?.getString('accent') ?? 'us';
    exampleStyle = ExampleStyle.values.firstWhere(
      (e) => e.name == (_prefs?.getString('exampleStyle') ?? 'exam'),
      orElse: () => ExampleStyle.exam,
    );
    dailyGoal = _prefs?.getInt('dailyGoal') ?? 20;
    studyIndex = _prefs?.getInt('studyIndex') ?? 0;
    quizMode = _prefs?.getString('quizMode');
    if (quizMode != null && quizMode!.isEmpty) quizMode = null;
    wordlistCategory = _prefs?.getString('wordlistCategory') ?? '全部';
    wordlistStatus = _prefs?.getString('wordlistStatus') ?? '全部';
    wordlistQuery = _prefs?.getString('wordlistQuery') ?? '';
    final sw = _prefs?.getString('switches');
    if (sw != null) {
      final m = jsonDecode(sw) as Map<String, dynamic>;
      switches = {...switches, ...m.map((k, v) => MapEntry(k, v == true))};
    }
    activeDictId = _prefs?.getString('activeDictId') ?? 'kaoyan';
    final cfg = _prefs?.getString('autoplayConfig');
    if (cfg != null) {
      config = AutoplayConfig.fromJson(jsonDecode(cfg) as Map<String, dynamic>);
    }

    speech = SpeechService(api);
    speech.accent = accent;
    await speech.init();
    await Syllables.ensureLoaded();
    await Ipa.ensureLoaded();
    await _loadProgressFile();
    await loadDictIndex();
    await loadDict(activeDictId);
    notifyListeners();
  }

  // ---------- 持久化 ----------
  Future<void> _savePrefs() async {
    await _prefs?.setString('serverUrl', api.baseUrl);
    await _prefs?.setString('token', token ?? '');
    await _prefs?.setString(
        'userJson',
        user == null
            ? ''
            : jsonEncode({
                'id': user!.id,
                'username': user!.username,
                'createdAt': user!.createdAt,
              }));
    await _prefs?.setBool('dark', dark);
    await _prefs?.setDouble('rate', rate);
    await _prefs?.setString('accent', accent);
    await _prefs?.setString('exampleStyle', exampleStyle.name);
    await _prefs?.setInt('dailyGoal', dailyGoal);
    await _prefs?.setInt('studyIndex', studyIndex);
    await _prefs?.setString('quizMode', quizMode ?? '');
    await _prefs?.setString('wordlistCategory', wordlistCategory);
    await _prefs?.setString('wordlistStatus', wordlistStatus);
    await _prefs?.setString('wordlistQuery', wordlistQuery);
    await _prefs?.setString('switches', jsonEncode(switches));
    await _prefs?.setString('activeDictId', activeDictId);
    await _prefs?.setString('autoplayConfig', jsonEncode(config.toJson()));
  }

  void _scheduleSaveProgress() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 800), () async {
      await _saveProgressFile();
      await _savePrefs();
    });
  }

  Future<void> saveSettingsNow() => _savePrefs();

  // ---------- 学习方式记录 ----------
  void setStudyIndex(int index) {
    studyIndex = index < 0 ? 0 : index;
    _savePrefs();
  }

  void setQuizMode(String? mode) {
    quizMode = (mode == null || mode.isEmpty) ? null : mode;
    _savePrefs();
  }

  void setWordlistFilters({String? category, String? status, String? query}) {
    if (category != null) wordlistCategory = category;
    if (status != null) wordlistStatus = status;
    if (query != null) wordlistQuery = query;
    _savePrefs();
  }

  Future<File> _progressFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/wordwave_progress.json');
  }

  Future<void> _loadProgressFile() async {
    try {
      final f = await _progressFile();
      if (!await f.exists()) return;
      final j = jsonDecode(await f.readAsString()) as Map<String, dynamic>;
      records = ((j['records'] as Map<String, dynamic>?) ?? {}).map((k, v) =>
          MapEntry(k, WordProgress.fromJson(v as Map<String, dynamic>?)));
      dailyWords = ((j['dailyWords'] as Map<String, dynamic>?) ?? {}).map((k,
              v) =>
          MapEntry(k, ((v as List?) ?? []).map((e) => e.toString()).toList()));
      exampleCache = ((j['exampleCache'] as Map<String, dynamic>?) ?? {}).map(
          (k, v) =>
              MapEntry(k, ExampleData.fromJson(v as Map<String, dynamic>)));
    } catch (_) {}
  }

  Future<void> _saveProgressFile() async {
    try {
      final f = await _progressFile();
      await f.writeAsString(
          jsonEncode({
            'records': records.map((k, v) => MapEntry(k, v.toJson())),
            'dailyWords': dailyWords,
            'exampleCache': exampleCache.map((k, v) => MapEntry(k, v.toJson())),
          }),
          flush: true);
    } catch (_) {}
  }

  // ---------- 词库 ----------
  Future<void> loadDictIndex() async {
    final raw = await rootBundle.loadString('assets/data/dicts/index.json');
    final list = jsonDecode(raw) as List;
    dicts =
        list.map((e) => DictMeta.fromJson(e as Map<String, dynamic>)).toList();
    if (!dicts.any((d) => d.id == activeDictId)) activeDictId = dicts.first.id;
    // 考研词库 word -> id（用于本地音包定位）
    final kraw = await rootBundle.loadString('assets/data/dicts/kaoyan.json');
    for (final w in jsonDecode(kraw) as List) {
      final m = w as Map<String, dynamic>;
      final word = (m['word'] as String?)?.trim().toLowerCase() ?? '';
      if (word.isNotEmpty && !kaoyanIdByWord.containsKey(word)) {
        kaoyanIdByWord[word] = (m['id'] as num?)?.toInt() ?? 0;
      }
    }
  }

  Future<void> loadDict(String id) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final raw = await rootBundle.loadString('assets/data/dicts/$id.json');
      words = (jsonDecode(raw) as List)
          .map((e) => Word.fromJson(e as Map<String, dynamic>))
          .toList();
      activeDictId = id;
      if (config.rangeMax > words.length) {
        config.rangeMax = words.isEmpty ? 1 : words.length;
      }
      await _prefs?.setString('activeDictId', id);
    } catch (e) {
      error = '词库加载失败: $e';
    }
    loading = false;
    notifyListeners();
  }

  int? kaoyanIdOf(String word) => kaoyanIdByWord[word.trim().toLowerCase()];

  // ---------- 学习进度 ----------
  WordProgress _base() => WordProgress();

  void _addActivity(String word) {
    final key = todayKey();
    final list = dailyWords[key] ?? [];
    if (!list.contains(word)) dailyWords[key] = [...list, word];
  }

  void markKnown(Word word) {
    final prev = records[word.word] ?? _base();
    final known = prev.known + 1;
    final status = prev.unknown == 0 && known >= 3
        ? 'mastered'
        : prev.status == 'new'
            ? 'learning'
            : prev.status;
    final now = DateTime.now().toIso8601String();
    records[word.word] = WordProgress(
      status: status,
      known: known,
      unknown: prev.unknown,
      learnedAt: prev.learnedAt ?? now,
      lastSeen: now,
      wrongCount: prev.wrongCount,
      lastWrongAt: prev.lastWrongAt,
      review: prev.review,
      notes: prev.notes,
    );
    _addActivity(word.word);
    _scheduleSaveProgress();
    notifyListeners();
  }

  void markUnknown(Word word) {
    final prev = records[word.word] ?? _base();
    final now = DateTime.now().toIso8601String();
    records[word.word] = WordProgress(
      status: 'learning',
      known: prev.known,
      unknown: prev.unknown + 1,
      learnedAt: prev.learnedAt ?? now,
      lastSeen: now,
      wrongCount: prev.wrongCount + 1,
      lastWrongAt: now,
      review: applyReview(prev.review ?? createReview(), 0),
      notes: prev.notes,
    );
    _addActivity(word.word);
    _scheduleSaveProgress();
    notifyListeners();
  }

  void markSeen(Word word) {
    final prev = records[word.word] ?? _base();
    final now = DateTime.now().toIso8601String();
    records[word.word] = WordProgress(
      status: prev.status == 'new' ? 'learning' : prev.status,
      known: prev.known,
      unknown: prev.unknown,
      learnedAt: prev.learnedAt ?? now,
      lastSeen: now,
      wrongCount: prev.wrongCount,
      lastWrongAt: prev.lastWrongAt,
      review: prev.review,
      notes: prev.notes,
    );
    _addActivity(word.word);
    _scheduleSaveProgress();
    notifyListeners();
  }

  void reviewAnswer(Word word, int quality) {
    final prev = records[word.word] ?? _base();
    final review = applyReview(prev.review ?? createReview(), quality);
    final now = DateTime.now().toIso8601String();
    var status = prev.status == 'new' ? 'learning' : prev.status;
    var wrongCount = prev.wrongCount;
    String? lastWrongAt = prev.lastWrongAt;
    if (quality >= 3) {
      if (review.reps >= 2) status = 'mastered';
    } else {
      status = 'learning';
      wrongCount += 1;
      lastWrongAt = now;
    }
    records[word.word] = WordProgress(
      status: status,
      known: prev.known,
      unknown: prev.unknown,
      learnedAt: prev.learnedAt ?? now,
      lastSeen: now,
      wrongCount: wrongCount,
      lastWrongAt: lastWrongAt,
      review: review,
      notes: prev.notes,
    );
    _addActivity(word.word);
    _scheduleSaveProgress();
    notifyListeners();
  }

  void setWordNote(String wordKey, String note) {
    final prev = records[wordKey] ?? _base();
    final n =
        WordNotes(wordNote: note, syllableNotes: prev.notes.syllableNotes);
    records[wordKey] = WordProgress(
      status: prev.status,
      known: prev.known,
      unknown: prev.unknown,
      learnedAt: prev.learnedAt,
      lastSeen: prev.lastSeen,
      wrongCount: prev.wrongCount,
      lastWrongAt: prev.lastWrongAt,
      review: prev.review,
      notes: n,
    );
    _scheduleSaveProgress();
    notifyListeners();
  }

  void setSyllableNote(String wordKey, int index, String note) {
    final prev = records[wordKey] ?? _base();
    final list = [...prev.notes.syllableNotes];
    while (list.length <= index) {
      list.add('');
    }
    list[index] = note;
    records[wordKey] = WordProgress(
      status: prev.status,
      known: prev.known,
      unknown: prev.unknown,
      learnedAt: prev.learnedAt,
      lastSeen: prev.lastSeen,
      wrongCount: prev.wrongCount,
      lastWrongAt: prev.lastWrongAt,
      review: prev.review,
      notes: WordNotes(wordNote: prev.notes.wordNote, syllableNotes: list),
    );
    _scheduleSaveProgress();
    notifyListeners();
  }

  List<Word> dueWords() {
    final today = todayKey();
    return words.where((w) {
      final r = records[w.word]?.review;
      return r != null && isDue(r, today);
    }).toList();
  }

  List<Word> wrongWords() =>
      words.where((w) => (records[w.word]?.wrongCount ?? 0) > 0).toList();

  // ---------- 例句缓存 ----------
  String exampleKey(String word, bool withTranslation, ExampleStyle style) =>
      '${word.toLowerCase()}::${withTranslation ? 'zh' : 'en'}::${style.name}';

  Future<({ExampleData data, bool fromCache})> getExample(
      String word, String meaning, bool withTranslation, ExampleStyle style,
      {bool force = false}) async {
    final key = exampleKey(word, withTranslation, style);
    if (!force) {
      final hit = exampleCache[key];
      if (hit != null) return (data: hit, fromCache: true);
    }
    final data = await api.example(word, meaning, withTranslation, style);
    exampleCache[key] = data;
    _scheduleSaveProgress();
    return (data: data, fromCache: false);
  }

  void clearExampleCache() {
    exampleCache.clear();
    _scheduleSaveProgress();
    notifyListeners();
  }

  // ---------- 账号 ----------
  Future<void> setServerUrl(String url) async {
    api = ApiClient(baseUrl: url, token: token);
    speech = SpeechService(api);
    speech.accent = accent;
    await speech.init();
    await _savePrefs();
    notifyListeners();
  }

  Future<void> register(String username, String password) async {
    final r = await api.register(username, password);
    token = r.token;
    user = r.user;
    api.token = r.token;
    await _savePrefs();
    notifyListeners();
  }

  Future<void> login(String username, String password) async {
    final r = await api.login(username, password);
    token = r.token;
    user = r.user;
    api.token = r.token;
    await _savePrefs();
    await syncProgress();
    notifyListeners();
  }

  Future<void> logout() async {
    await api.logout();
    token = null;
    user = null;
    api.token = null;
    await _savePrefs();
    notifyListeners();
  }

  Future<void> syncProgress() async {
    if (token == null) return;
    try {
      final remote = await api.getProgress();
      final remoteRecords =
          ((remote['records'] as Map<String, dynamic>?) ?? {});
      if (remoteRecords.isNotEmpty) {
        records = remoteRecords.map((k, v) =>
            MapEntry(k, WordProgress.fromJson(v as Map<String, dynamic>?)));
        dailyWords = ((remote['dailyWords'] as Map<String, dynamic>?) ?? {})
            .map((k, v) => MapEntry(
                k, ((v as List?) ?? []).map((e) => e.toString()).toList()));
      } else {
        await api.putProgress(
            records.map((k, v) => MapEntry(k, v.toJson())), dailyWords);
      }
      await _saveProgressFile();
      notifyListeners();
    } catch (_) {}
  }

  // ---------- 导出/导入/重置 ----------
  String exportJson() => jsonEncode({
        'app': 'wordwave-mobile',
        'version': 1,
        'records': records.map((k, v) => MapEntry(k, v.toJson())),
        'dailyWords': dailyWords,
        'exampleCache': exampleCache.map((k, v) => MapEntry(k, v.toJson())),
      });

  bool importJson(String text) {
    try {
      final j = jsonDecode(text) as Map<String, dynamic>;
      records = ((j['records'] as Map<String, dynamic>?) ?? {}).map((k, v) =>
          MapEntry(k, WordProgress.fromJson(v as Map<String, dynamic>?)));
      dailyWords = ((j['dailyWords'] as Map<String, dynamic>?) ?? {}).map((k,
              v) =>
          MapEntry(k, ((v as List?) ?? []).map((e) => e.toString()).toList()));
      exampleCache = ((j['exampleCache'] as Map<String, dynamic>?) ?? {}).map(
          (k, v) =>
              MapEntry(k, ExampleData.fromJson(v as Map<String, dynamic>)));
      _scheduleSaveProgress();
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> resetAll() async {
    records = {};
    dailyWords = {};
    exampleCache = {};
    switches = {
      'readMeaning': true,
      'aiExamples': false,
      'withTranslation': true,
      'syllables': true,
      'showMeaningCard': true,
    };
    rate = 1.0;
    dark = false;
    await _saveProgressFile();
    await _savePrefs();
    notifyListeners();
  }

  // ---------- 统计（本地） ----------
  Map<String, int> localStats() {
    final today = todayKey();
    var learned = 0,
        mastered = 0,
        wrong = 0,
        due = 0,
        todayLearned = 0,
        streak = 0;
    records.forEach((_, r) {
      learned++;
      if (r.status == 'mastered') mastered++;
      if (r.wrongCount > 0) wrong++;
      if (r.review != null && isDue(r.review!, today)) due++;
    });
    todayLearned = dailyWords[today]?.length ?? 0;
    final days =
        dailyWords.keys.where((d) => (dailyWords[d]?.length ?? 0) > 0).toSet();
    var cursor = DateTime.now();
    if (!days.contains(todayKey()) &&
        days.contains(
            todayKey(DateTime.now().subtract(const Duration(days: 1))))) {
      cursor = cursor.subtract(const Duration(days: 1));
    }
    while (days.contains(todayKey(cursor))) {
      streak++;
      cursor = cursor.subtract(const Duration(days: 1));
    }
    return {
      'learned': learned,
      'mastered': mastered,
      'wrong': wrong,
      'due': due,
      'today': todayLearned,
      'streak': streak,
    };
  }

  // ---------- 自动播放 ----------
  List<Word> buildQueue(AutoplayConfig cfg) {
    List<Word> list;
    switch (cfg.order) {
      case AutoplayOrder.unknown:
        list = words.where((w) => records[w.word]?.learnedAt == null).toList();
        break;
      case AutoplayOrder.wrong:
        list =
            words.where((w) => (records[w.word]?.wrongCount ?? 0) > 0).toList();
        break;
      case AutoplayOrder.category:
        list = words.where((w) => w.category == cfg.category).toList();
        break;
      case AutoplayOrder.range:
        list = words
            .where((w) => w.id >= cfg.rangeMin && w.id <= cfg.rangeMax)
            .toList();
        break;
      default:
        list = [...words];
    }
    if (cfg.order == AutoplayOrder.random) list.shuffle();
    final n =
        cfg.count < 0 ? 0 : (cfg.count > list.length ? list.length : cfg.count);
    return list.sublist(0, n);
  }

  void autoplayStart() {
    final q = buildQueue(config);
    if (q.isEmpty) return;
    _gen++;
    final g = _gen;
    status = 'playing';
    queue = q;
    index = 0;
    repeatIndex = 0;
    total = q.length;
    done = 0;
    currentWord = q.first;
    exampleData = null;
    exampleLoading = false;
    exampleError = null;
    notifyListeners();
    unawaited(_run(g));
  }

  void autoplayToggle() {
    if (status == 'playing') {
      unawaited(speech.pause());
      status = 'paused';
      notifyListeners();
    } else if (status == 'paused') {
      status = 'playing';
      notifyListeners();
    } else if (status == 'finished') {
      autoplayStart();
    }
  }

  void autoplayNext() => autoplayJump(index + 1);
  void autoplayPrev() => autoplayJump(index - 1);

  void autoplayJump(int target) {
    if (queue.isEmpty) return;
    final clamped =
        target < 0 ? 0 : (target >= queue.length ? queue.length - 1 : target);
    _gen++;
    final g = _gen;
    unawaited(speech.stop());
    index = clamped;
    repeatIndex = 0;
    currentWord = queue[clamped];
    exampleData = null;
    exampleLoading = false;
    exampleError = null;
    if (status == 'finished') status = 'playing';
    notifyListeners();
    unawaited(_run(g));
  }

  void autoplayStop() {
    _gen++;
    unawaited(speech.stop());
    status = 'idle';
    queue = [];
    index = 0;
    repeatIndex = 0;
    total = 0;
    done = 0;
    currentWord = null;
    exampleData = null;
    exampleLoading = false;
    exampleError = null;
    notifyListeners();
  }

  Future<bool> _ensureActive(int g) async {
    while (_gen == g) {
      if (status == 'playing') return true;
      if (status == 'idle' || status == 'finished') return false;
      await Future.delayed(const Duration(milliseconds: 120));
    }
    return false;
  }

  Future<void> _speakGuarded(String text, String lang, SpeakKind kind,
      {String? wordText, int? wordId}) async {
    final g = _gen;
    final started = DateTime.now();
    var doneFlag = false;
    final p = speech
        .speak(
          text: text,
          lang: lang,
          rate: rate,
          kind: kind,
          wordText: wordText,
          wordId: wordId,
          kaoyanId: wordText == null ? null : kaoyanIdOf(wordText),
        )
        .then((_) => doneFlag = true);
    while (!doneFlag) {
      if (_gen != g) {
        unawaited(speech.stop());
        return;
      }
      if (status != 'playing') {
        if (status == 'idle' || status == 'finished') {
          unawaited(speech.stop());
          return;
        }
        await Future.delayed(const Duration(milliseconds: 150));
        continue;
      }
      if (DateTime.now().difference(started).inMilliseconds > 25000) {
        unawaited(speech.stop());
        return;
      }
      await Future.delayed(const Duration(milliseconds: 200));
    }
    await p;
  }

  Future<void> _run(int g) async {
    while (_gen == g) {
      if (status == 'idle' || status == 'finished') return;
      if (status == 'paused') {
        await Future.delayed(const Duration(milliseconds: 150));
        continue;
      }
      if (index < 0 || index >= queue.length) {
        status = 'finished';
        notifyListeners();
        return;
      }
      final word = queue[index];
      repeatIndex = 0;
      notifyListeners();
      try {
        await _playWord(word);
      } catch (_) {
        if (_gen != g) return;
      }
      if (_gen != g) return;
      markSeen(word);
      final next = index + 1;
      index = next;
      done = next;
      repeatIndex = 0;
      currentWord = next < queue.length ? queue[next] : null;
      if (next >= queue.length) {
        status = 'finished';
        currentWord = null;
        notifyListeners();
        return;
      }
      notifyListeners();
      await _waitInterval(g);
    }
  }

  Future<void> _waitInterval(int g) async {
    final ms = (config.interval * 1000).round();
    final start = DateTime.now();
    var pausedMs = 0;
    while (_gen == g) {
      if (status != 'playing') {
        if (status == 'idle' || status == 'finished') return;
        final pStart = DateTime.now();
        await Future.delayed(const Duration(milliseconds: 150));
        pausedMs += DateTime.now().difference(pStart).inMilliseconds;
        continue;
      }
      if (DateTime.now().difference(start).inMilliseconds - pausedMs >= ms)
        return;
      await Future.delayed(const Duration(milliseconds: 100));
    }
  }

  Future<void> _playWord(Word word) async {
    final g = _gen;
    final repeats = config.repeats.clamp(1, 10);
    Future<({ExampleData data, bool fromCache})>? exampleFuture;
    if (switches['aiExamples'] == true) {
      exampleLoading = true;
      exampleData = null;
      exampleError = null;
      notifyListeners();
      final f = getExample(word.word, word.meaning,
          switches['withTranslation'] == true, exampleStyle);
      f.catchError((_) => (data: ExampleData(english: ''), fromCache: false));
      exampleFuture = f;
    }

    // 逐音节慢读：每个词只做一次，不算在“重复次数”里
    if (switches['syllables'] == true) {
      final parts = Syllables.split(word.word);
      if (parts.length > 1) {
        for (final part in parts) {
          if (!await _ensureActive(g)) return;
          await _speakGuarded(part, 'en', SpeakKind.syllable,
              wordText: word.word);
        }
      }
    }
    // 整词按用户设定的重复次数朗读
    for (var r = 0; r < repeats; r++) {
      if (!await _ensureActive(g)) return;
      repeatIndex = r;
      notifyListeners();
      await _speakGuarded(word.word, 'en', SpeakKind.word, wordText: word.word);
    }
    if (!await _ensureActive(g)) return;

    if (switches['readMeaning'] == true) {
      await _speakGuarded(word.meaning, 'zh', SpeakKind.meaning,
          wordText: word.word);
      if (!await _ensureActive(g)) return;
    }

    if (exampleFuture != null) {
      try {
        final res = await exampleFuture;
        if (!await _ensureActive(g)) return;
        exampleData = res.data;
        exampleLoading = false;
        exampleFromCache = res.fromCache;
        exampleError = null;
        notifyListeners();
      } catch (e) {
        if (_gen != g) return;
        exampleLoading = false;
        exampleData = null;
        exampleError = '$e';
        notifyListeners();
        return;
      }
      if (!await _ensureActive(g)) return;
      await _speakGuarded(exampleData!.english, 'en', SpeakKind.example);
      if (switches['withTranslation'] == true &&
          exampleData!.chinese.isNotEmpty) {
        if (!await _ensureActive(g)) return;
        await _speakGuarded(exampleData!.chinese, 'zh', SpeakKind.example);
      }
    }
  }
}
