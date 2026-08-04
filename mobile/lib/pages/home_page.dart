import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../main.dart';
import '../state.dart';
import 'autoplay_page.dart';
import 'data_page.dart';
import 'personal_page.dart';
import 'quiz_page.dart';
import 'review_page.dart';
import 'settings_page.dart';
import 'stats_page.dart';
import 'study_page.dart';
import 'word_list_page.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final st = s.localStats();
    final features = [
      ('学习', Icons.menu_book, Colors.green, const StudyPage()),
      ('自动播放', Icons.play_circle, Colors.teal, const AutoplayPage()),
      ('复习', Icons.replay, Colors.blue, const ReviewPage()),
      ('测验', Icons.edit_note, Colors.purple, const QuizPage()),
      ('统计', Icons.bar_chart, Colors.orange, const StatsPage()),
      ('词库', Icons.library_books, Colors.indigo, const WordListPage()),
      ('个人', Icons.school, Colors.pink, const PersonalPage()),
      ('数据', Icons.save, Colors.brown, const DataPage()),
      ('设置', Icons.settings, Colors.blueGrey, const SettingsPage()),
    ];
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Card(
          color: Colors.green.withValues(alpha: 0.08),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.user == null ? '你好，继续学习吧' : '你好，${s.user!.username}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  '今日已学 ${st['today']} 词 · 连续 ${st['streak']} 天 · 已掌握 ${st['mastered']} 词',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text('功能入口',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.grey.shade600)),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.05,
          children: features.map((f) {
            return InkWell(
              onTap: () => openFeature(context, f.$1, f.$4),
              borderRadius: BorderRadius.circular(18),
              child: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(f.$2, size: 30, color: f.$3),
                    const SizedBox(height: 6),
                    Text(f.$1, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
