import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:wordwave/services/speech_service.dart';
import 'package:wordwave/state.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('手机离线 TTS 测试', (tester) async {
    final state = AppState();
    await state.init();
    // 故意指向不可达地址，强制走设备 TTS
    await state.setServerUrl('http://127.0.0.1:1');
    debugPrint('PHONE_TTS_START');
    await state.speech.speak(
      text: 'Hello, this is an offline speech test.',
      lang: 'en',
      rate: 1.0,
      kind: SpeakKind.example,
    );
    debugPrint('PHONE_TTS_DONE');
    await Future<void>.delayed(const Duration(seconds: 2));
  });
}
