import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../main.dart';
import '../state.dart';

class PersonalPage extends StatelessWidget {
  const PersonalPage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final st = s.localStats();
    final dictName = s.dicts
            .where((d) => d.id == s.activeDictId)
            .map((d) => d.name)
            .firstOrNull ??
        s.activeDictId;

    // 近 70 天热力图
    final days = List.generate(70, (i) {
      final d = DateTime.now().subtract(Duration(days: 69 - i));
      final key = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
      return (key, s.dailyWords[key]?.length ?? 0);
    });

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Text(s.user == null ? '个人学习中心（游客模式）' : '欢迎回来，${s.user!.username}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const Spacer(),
            OutlinedButton.icon(
              onPressed: () async {
                await s.syncProgress();
                if (context.mounted) toast(context, '同步完成');
              },
              icon: const Icon(Icons.sync, size: 16),
              label: const Text('同步'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _card(context, '已学', st['learned']!, Colors.green),
            _card(context, '掌握', st['mastered']!, Colors.blue),
            _card(context, '错词', st['wrong']!, Colors.red),
            _card(context, '待复习', st['due']!, Colors.amber),
            _card(context, '今日', st['today']!, Colors.purple),
            _card(context, '连续天数', st['streak']!, Colors.orange),
          ],
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('打卡热力图（近 70 天）',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                GridView.count(
                  crossAxisCount: 10,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 3,
                  crossAxisSpacing: 3,
                  children: days.map((e) {
                    final c = e.$2;
                    return Container(
                      decoration: BoxDecoration(
                        color: c == 0
                            ? Colors.grey.shade200
                            : c <= 2
                                ? Colors.green.shade200
                                : c <= 5
                                    ? Colors.green.shade400
                                    : c <= 10
                                        ? Colors.green.shade600
                                        : Colors.green.shade800,
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Tooltip(
                          message: '${e.$1}：${e.$2} 词',
                          child: const SizedBox()),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('每日目标',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const Spacer(),
                    Text('${s.dailyGoal} 词/天',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF10B981))),
                  ],
                ),
                Slider(
                  min: 5,
                  max: 200,
                  divisions: 39,
                  value: s.dailyGoal.toDouble(),
                  label: '${s.dailyGoal}',
                  onChanged: (v) {
                    s.dailyGoal = v.round();
                    s.saveSettingsNow();
                    s.refresh();
                  },
                ),
                Wrap(
                  spacing: 6,
                  children: [10, 20, 30, 50, 100].map((n) => ChoiceChip(
                        label: Text('$n'),
                        selected: s.dailyGoal == n,
                        onSelected: (_) {
                          s.dailyGoal = n;
                          s.saveSettingsNow();
                          s.refresh();
                        },
                      )).toList(),
                ),
              ],
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.library_books, color: Colors.purple),
            title: const Text('当前词库'),
            subtitle: Text('$dictName · ${s.words.length} 词 · 已学 ${st['learned']}'),
            trailing: const Icon(Icons.chevron_right),
          ),
        ),
      ],
    );
  }

  Widget _card(BuildContext context, String label, int value, Color color) => Container(
        width: (MediaQuery.of(context).size.width - 32 - 30) / 3,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Column(
          children: [
            Text('$value',
                style: TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w800, color: color)),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      );
}
