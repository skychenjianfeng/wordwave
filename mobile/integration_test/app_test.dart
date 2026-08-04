import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';

import 'package:wordwave/main.dart';
import 'package:wordwave/state.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('阅读页一键翻译', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);

    final state = AppState();
    await state.init();
    await state.setServerUrl('http://10.0.2.2:3101');
    await tester.pumpWidget(
      ChangeNotifierProvider.value(value: state, child: const WordWaveApp()),
    );
    await tester.pump(const Duration(milliseconds: 500));
    await Future<void>.delayed(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 400));

    // 进入阅读 Tab
    await tester.tap(find.text('阅读').hitTestable().first);
    await tester.pump(const Duration(milliseconds: 400));
    // 等待文章列表加载（真实网络请求）
    for (var i = 0; i < 12; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 1000));
      await tester.pump(const Duration(milliseconds: 300));
      if (find.textContaining('The Fox and the Grapes').evaluate().isNotEmpty) break;
    }
    expect(find.textContaining('The Fox and the Grapes'), findsWidgets);
    await tester.tap(find.textContaining('The Fox and the Grapes').first);
    await tester.pump(const Duration(milliseconds: 500));
    await Future<void>.delayed(const Duration(seconds: 1));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.textContaining('一键翻译'), findsOneWidget);

    // 一键翻译（真实调用 DeepSeek，轮询等待译文）
    await tester.tap(find.textContaining('一键翻译').first);
    await tester.pump(const Duration(milliseconds: 400));
    var translated = false;
    for (var i = 0; i < 30; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 1000));
      await tester.pump(const Duration(milliseconds: 300));
      if (find.textContaining('狐狸').evaluate().isNotEmpty ||
          find.textContaining('葡萄').evaluate().isNotEmpty) {
        translated = true;
        break;
      }
    }
    expect(translated, true);
    debugPrint('SNAP 09c-translate');
    await Future<void>.delayed(const Duration(seconds: 2));
  });

  testWidgets('学习方式持久化（重开 App 恢复）', (tester) async {
    final s = AppState();
    await s.init();
    // 设置各种学习方式
    s.setStudyIndex(7);
    s.setQuizMode('listen');
    s.setWordlistFilters(category: '抽象概念', status: '错词', query: 'important');
    await Future<void>.delayed(const Duration(seconds: 1)); // 等待异步写盘

    // 模拟重新打开 App：新的 AppState 从同一存储读取
    final s2 = AppState();
    await s2.init();
    expect(s2.studyIndex, 7);
    expect(s2.quizMode, 'listen');
    expect(s2.wordlistCategory, '抽象概念');
    expect(s2.wordlistStatus, '错词');
    expect(s2.wordlistQuery, 'important');

    // 恢复为干净状态，避免影响其它测试
    s2.setStudyIndex(0);
    s2.setQuizMode(null);
    s2.setWordlistFilters(category: '全部', status: '全部', query: '');
    await Future<void>.delayed(const Duration(seconds: 1));
  });

  testWidgets('WordWave 全页面遍历', (tester) async {
    // 手机分辨率视口（1080x2400 @ 2.625 = Pixel 7）
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);

    Future<void> snap(String name) async {
      debugPrint('SNAP $name');
      await Future<void>.delayed(const Duration(seconds: 3));
    }

    final state = AppState();
    await state.init();
    // 使用本机开发后端（含阅读接口），模拟器经 10.0.2.2 访问
    await state.setServerUrl('http://10.0.2.2:8010');
    await tester.pumpWidget(
      ChangeNotifierProvider.value(value: state, child: const WordWaveApp()),
    );
    await tester.pump(const Duration(milliseconds: 500));
    await Future<void>.delayed(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 500));
    // 学习页
    expect(find.textContaining('WordWave'), findsWidgets);
    expect(find.textContaining('功能入口'), findsWidgets);
    await snap('01-home');

    Future<void> goto(String label) async {
      await tester.ensureVisible(find.text(label).hitTestable().first);
      await tester.tap(find.text(label).hitTestable().first, warnIfMissed: false);
      await tester.pump(const Duration(milliseconds: 400));
      await Future<void>.delayed(const Duration(milliseconds: 600));
      await tester.pump(const Duration(milliseconds: 400));
    }

    Future<void> back() async {
      await tester.pageBack();
      await tester.pump(const Duration(milliseconds: 500));
      await Future<void>.delayed(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 300));
    }

    await goto('自动播放');
    expect(find.textContaining('自动播放设置'), findsWidgets);
    await snap('02-autoplay-config');
    await back();

    await goto('词库');
    expect(find.textContaining('搜索单词或释义'), findsOneWidget);
    await snap('03-wordlist');
    await back();

    await goto('个人');
    expect(find.textContaining('个人学习中心'), findsOneWidget);
    await snap('04-personal');
    await back();

    await goto('统计');
    expect(find.textContaining('近 30 天学习量'), findsOneWidget);
    await snap('05-stats');
    await back();

    await goto('设置');
    expect(find.textContaining('服务器地址'), findsOneWidget);
    await snap('06-settings');
    await back();

    await goto('复习');
    await snap('07-review');
    await back();

    // 学习页翻面
    await goto('学习');
    await tester.tap(find.text('the').first, warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.textContaining('这个、这些'), findsWidgets);
    await snap('08-study-flipped');
    await back();

    // 底部导航：阅读 / AI对话 / 我的
    await tester.tap(find.text('阅读').hitTestable().first);
    await tester.pump(const Duration(milliseconds: 600));
    await Future<void>.delayed(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.textContaining('分级文章'), findsWidgets);
    if (find.text('重试').evaluate().isNotEmpty) {
      await tester.tap(find.text('重试').first);
      await tester.pump(const Duration(milliseconds: 400));
      await Future<void>.delayed(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 300));
    }
    await snap('09-reading');

    await tester.tap(find.text('AI对话').hitTestable().first);
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.textContaining('功能开发中'), findsWidgets);
    await snap('10-ai-chat');

    await tester.tap(find.text('我的').hitTestable().first);
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.textContaining('个人学习中心'), findsWidgets);
    await snap('11-me');
  });
}
