import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/syllables.dart';
import '../state.dart';

class ReviewPage extends StatefulWidget {
  const ReviewPage({super.key});

  @override
  State<ReviewPage> createState() => _ReviewPageState();
}

class _ReviewPageState extends State<ReviewPage> {
  List<Word> _queue = [];
  int _index = 0;
  bool _flipped = false;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (_queue.isEmpty || _index >= _queue.length) {
      _queue = s.dueWords();
      _index = 0;
    }
    if (_queue.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.celebration, size: 56, color: Color(0xFF10B981)),
              SizedBox(height: 12),
              Text('今日复习完成，太棒了！',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      );
    }
    final word = _queue[_index];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Text('今日待复习 ${_queue.length} 词',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const Spacer(),
            Text('${_index + 1}/${_queue.length}',
                style: TextStyle(color: Colors.grey.shade600)),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: InkWell(
            onTap: () => setState(() => _flipped = !_flipped),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(word.word,
                      style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(Syllables.syllableText(word.word),
                      style: const TextStyle(
                          fontSize: 16, color: Color(0xFF10B981))),
                  if (_flipped) ...[
                    const Divider(height: 24),
                    Text(word.meaning,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                  ] else
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text('点击翻面查看释义',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _quality('忘记', 1, Colors.red, () => _answer(s, word, 1)),
            _quality('困难', 3, Colors.orange, () => _answer(s, word, 3)),
            _quality('良好', 4, Colors.blue, () => _answer(s, word, 4)),
            _quality('轻松', 5, Colors.green, () => _answer(s, word, 5)),
          ],
        ),
      ],
    );
  }

  Widget _quality(String label, int q, Color color, VoidCallback onTap) =>
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: color),
        onPressed: onTap,
        child: Text(label),
      );

  void _answer(AppState s, Word word, int q) {
    s.reviewAnswer(word, q);
    setState(() {
      _index++;
      _flipped = false;
      if (_index >= _queue.length) _queue = [];
    });
  }
}
