import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state.dart';
import '../widgets/cards.dart';

class StudyPage extends StatefulWidget {
  const StudyPage({super.key});

  @override
  State<StudyPage> createState() => _StudyPageState();
}

class _StudyPageState extends State<StudyPage> {
  int _index = 0;
  bool _flipped = false;
  bool _restored = false;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final words = s.words;
    if (s.loading && words.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (words.isEmpty) {
      return Center(
        child: Text(s.error ?? '词库为空', style: const TextStyle(color: Colors.red)),
      );
    }
    // 词库就绪后恢复上次学习位置（init 异步完成后再读取）
    if (!_restored) {
      _restored = true;
      _index = s.studyIndex;
    }
    if (_index >= words.length) _index = words.length - 1;
    if (_index < 0) _index = 0;
    final word = words[_index];
    final learned = s.records.length;

    void next() {
      setState(() {
        _index = (_index + 1) % words.length;
        _flipped = false;
      });
      context.read<AppState>().setStudyIndex(_index);
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('全部 ${words.length}',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            Text('已学 $learned',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            Text('${_index + 1} / ${words.length}',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ],
        ),
        const SizedBox(height: 12),
        WordCard(
          word: word,
          flipped: _flipped,
          onFlip: (v) => setState(() => _flipped = v),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                    backgroundColor: Colors.green, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () {
                  s.markKnown(word);
                  next();
                },
                icon: const Icon(Icons.check),
                label: const Text('认识'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                    backgroundColor: Colors.red.shade400,
                    padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () {
                  s.markUnknown(word);
                  next();
                },
                icon: const Icon(Icons.close),
                label: const Text('不认识'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
