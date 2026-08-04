import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'pages/ai_chat_page.dart';
import 'pages/home_page.dart';
import 'pages/me_page.dart';
import 'pages/reading_page.dart';
import 'state.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => AppState()..init(),
      child: const WordWaveApp(),
    ),
  );
}

void toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red.shade400 : null,
      duration: const Duration(seconds: 2),
    ));
}

/// 打开某个功能页（全屏推入，带返回键）
void openFeature(BuildContext context, String title, Widget page) {
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(title: Text(title)),
        body: page,
      ),
    ),
  );
}

class WordWaveApp extends StatelessWidget {
  const WordWaveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, s, _) => MaterialApp(
        title: 'WordWave 词浪',
        debugShowCheckedModeBanner: false,
        themeMode: s.dark ? ThemeMode.dark : ThemeMode.light,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF10B981)),
          useMaterial3: true,
        ),
        darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF10B981),
            brightness: Brightness.dark,
          ),
          useMaterial3: true,
        ),
        builder: (context, child) => ScrollConfiguration(
          // 全局隐藏滚动条（上下/左右都不显示，滚动功能保留）
          behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
          child: child!,
        ),
        home: const HomeShell(),
      ),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final tabs = [
      const HomePage(),
      const ReadingPage(),
      const AiChatPage(),
      const MePage(),
    ];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 8,
        title: Row(
          children: [
            const Text('🌊', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 6),
            const Text('WordWave',
                style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.5)),
            const Spacer(),
            Text('${s.rate.toStringAsFixed(2)}x',
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
            const SizedBox(width: 6),
            IconButton(
              tooltip: '切换主题',
              visualDensity: VisualDensity.compact,
              icon: Icon(s.dark ? Icons.light_mode : Icons.dark_mode, size: 20),
              onPressed: () {
                s.dark = !s.dark;
                s.refresh();
                s.saveSettingsNow();
              },
            ),
          ],
        ),
        automaticallyImplyLeading: false,
      ),
      body: IndexedStack(index: _tab, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: '当前',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book),
            label: '阅读',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble),
            label: 'AI对话',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: '我的',
          ),
        ],
      ),
    );
  }
}
