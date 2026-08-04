import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';

import 'package:wordwave/main.dart';
import 'package:wordwave/state.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('手机发音链路测试', (tester) async {
    tester.view.physicalSize = const Size(1440, 3200);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);

    final state = AppState();
    await state.init();
    await state.setServerUrl('http://127.0.0.1:3101');
    await tester.pumpWidget(
      ChangeNotifierProvider.value(value: state, child: const WordWaveApp()),
    );
    await tester.pump(const Duration(milliseconds: 500));
    await Future<void>.delayed(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));

    // 进入学习页并点播放
    await tester.tap(find.text('学习').hitTestable().first);
    await tester.pump(const Duration(milliseconds: 500));
    await Future<void>.delayed(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('播放'), findsOneWidget);
    await tester.tap(find.text('播放').first);
    debugPrint('PHONE_PLAY_TAPPED');
    await Future<void>.delayed(const Duration(seconds: 8));
    await tester.pump(const Duration(milliseconds: 300));
    debugPrint('PHONE_SPEECH_DONE');
  });
}
