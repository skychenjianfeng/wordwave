import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:just_audio/just_audio.dart';

import 'package:wordwave/services/offline_tts.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'offline sherpa-onnx TTS synthesize and play',
    (tester) async {
      final tts = OfflineTtsService();
      final player = AudioPlayer();

      final started = DateTime.now();
      final us =
          await tts.synthesize(text: 'important', accent: 'us', rate: 1.0);
      debugPrint('OFFLINE_US_FILE=${us?.path} '
          'elapsed=${DateTime.now().difference(started).inMilliseconds}ms '
          'error=${tts.lastError}');
      expect(us, isNotNull, reason: 'US synthesis should produce a wav');
      expect(await us!.length(), greaterThan(1000));

      await player.setFilePath(us.path);
      await player.play();
      await player.processingStateStream
          .firstWhere((s) =>
              s == ProcessingState.completed || s == ProcessingState.idle)
          .timeout(const Duration(seconds: 30));
      debugPrint('OFFLINE_US_PLAYED_OK');

      final uk =
          await tts.synthesize(text: 'schedule', accent: 'uk', rate: 0.75);
      debugPrint('OFFLINE_UK_FILE=${uk?.path} error=${tts.lastError}');
      expect(uk, isNotNull, reason: 'UK synthesis should produce a wav');
      expect(await uk!.length(), greaterThan(1000));

      await player.setFilePath(uk.path);
      await player.play();
      await player.processingStateStream
          .firstWhere((s) =>
              s == ProcessingState.completed || s == ProcessingState.idle)
          .timeout(const Duration(seconds: 30));
      debugPrint('OFFLINE_UK_PLAYED_OK');

      final zh = await tts.synthesize(
        text: '重要的；要紧的',
        accent: 'zh',
        rate: 1.0,
      );
      debugPrint('OFFLINE_ZH_FILE=${zh?.path} error=${tts.lastError}');
      expect(zh, isNotNull, reason: 'ZH synthesis should produce a wav');
      expect(await zh!.length(), greaterThan(1000));

      await player.setFilePath(zh.path);
      await player.play();
      await player.processingStateStream
          .firstWhere((s) =>
              s == ProcessingState.completed || s == ProcessingState.idle)
          .timeout(const Duration(seconds: 30));
      debugPrint('OFFLINE_ZH_PLAYED_OK');

      tts.dispose();
      await player.dispose();
    },
    timeout: const Timeout(Duration(minutes: 6)),
  );
}
