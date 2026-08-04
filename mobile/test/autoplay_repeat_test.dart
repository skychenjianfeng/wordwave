import 'package:flutter_test/flutter_test.dart';

import 'package:wordwave/models.dart';
import 'package:wordwave/state.dart';
import 'package:wordwave/services/speech_service.dart';
import 'package:wordwave/services/syllables.dart';

class CountingSpeech extends SpeechService {
  CountingSpeech(super.api);

  int syllables = 0;
  int words = 0;

  @override
  Future<void> speak({
    required String text,
    required String lang,
    required double rate,
    required SpeakKind kind,
    String? wordText,
    int? wordId,
    int? kaoyanId,
  }) async {
    if (kind == SpeakKind.syllable) syllables++;
    if (kind == SpeakKind.word) words++;
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('autoplay repeats whole word N times, syllables only once', () async {
    await Syllables.ensureLoaded();

    final state = AppState();
    final counting = CountingSpeech(state.api);
    state.speech = counting;
    state.words = [
      const Word(
        id: 1,
        freq: 1,
        word: 'important',
        meaning: '重要的',
        category: '考研',
      ),
      const Word(
        id: 2,
        freq: 2,
        word: 'the',
        meaning: '这个',
        category: '考研',
      ),
    ];
    state.config.repeats = 3;
    state.config.count = 2;
    state.config.interval = 0.05;
    state.switches['syllables'] = true;
    state.switches['readMeaning'] = false;
    state.switches['aiExamples'] = false;

    state.autoplayStart();

    final deadline = DateTime.now().add(const Duration(seconds: 15));
    while (state.status != 'finished' && DateTime.now().isBefore(deadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }

    expect(state.status, 'finished');
    // important 有 3 个音节：只慢读一遍
    expect(counting.syllables, 3);
    // 两个词各按 repeats=3 读整词
    expect(counting.words, 6);
  });
}
