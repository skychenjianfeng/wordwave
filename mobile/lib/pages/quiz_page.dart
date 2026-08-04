import 'dart:math';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/speech_service.dart';
import '../state.dart';

enum QuizMode { meaning, listen, spelling }

class QuizPage extends StatefulWidget {
  const QuizPage({super.key});

  @override
  State<QuizPage> createState() => _QuizPageState();
}

class _QuizPageState extends State<QuizPage> {
  QuizMode? _mode;
  bool _autoStarted = false;
  List<Word> _questions = [];
  int _index = 0;
  int _score = 0;
  int? _picked;
  bool _answered = false;
  final TextEditingController _input = TextEditingController();

  void _start(QuizMode mode) {
    final s = context.read<AppState>();
    s.setQuizMode(mode.name);
    final pool = [...s.words]..shuffle(Random());
    setState(() {
      _mode = mode;
      _questions = pool.take(10).toList();
      _index = 0;
      _score = 0;
      _picked = null;
      _answered = false;
      _input.clear();
    });
  }

  List<String> _choices(Word word) {
    final s = context.read<AppState>();
    final pool = [...s.words]..shuffle(Random());
    final set = <String>{word.meaning};
    for (final w in pool) {
      if (set.length >= 4) break;
      if (w.word != word.word) set.add(w.meaning);
    }
    final list = set.toList()..shuffle(Random());
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    // 恢复上次测验题型：词库加载完成后自动进入上次模式
    if (!_autoStarted && s.quizMode != null && s.words.isNotEmpty) {
      _autoStarted = true;
      final saved = QuizMode.values.where((m) => m.name == s.quizMode).firstOrNull;
      if (saved != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _start(saved);
        });
      }
    }
    if (_mode == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('选择测验题型', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => _start(QuizMode.meaning),
              icon: const Icon(Icons.quiz),
              label: const Text('看英文选释义'),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: Colors.blue),
              onPressed: () => _start(QuizMode.listen),
              icon: const Icon(Icons.hearing),
              label: const Text('听音辨词'),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: Colors.purple),
              onPressed: () => _start(QuizMode.spelling),
              icon: const Icon(Icons.keyboard),
              label: const Text('拼写默写'),
            ),
          ],
        ),
      );
    }
    if (_index >= _questions.length) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.emoji_events, size: 56, color: Colors.amber),
            const SizedBox(height: 12),
            Text('测验完成！得分 $_score/${_questions.length}',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => setState(() => _mode = null),
              child: const Text('返回题型选择'),
            ),
          ],
        ),
      );
    }
    final word = _questions[_index];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LinearProgressIndicator(value: _index / _questions.length),
        const SizedBox(height: 12),
        Text('${_index + 1} / ${_questions.length}  得分 $_score',
            style: TextStyle(color: Colors.grey.shade600)),
        const SizedBox(height: 20),
        if (_mode == QuizMode.meaning)
          Column(
            children: [
              Text(word.word,
                  style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800)),
              const SizedBox(height: 20),
              ..._choices(word).map((c) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: _choiceBtn(c, word.meaning),
                  )),
            ],
          )
        else if (_mode == QuizMode.listen) ...[
          IconButton(
            iconSize: 56,
            onPressed: () {
              s.speech.speak(
                text: word.word,
                lang: 'en',
                rate: s.rate,
                kind: SpeakKind.word,
                wordText: word.word,
                kaoyanId: s.kaoyanIdOf(word.word),
              );
            },
            icon: const Icon(Icons.volume_up),
          ),
          const Text('听发音，选出正确释义',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 16),
          ..._choices(word).map((c) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: _choiceBtn(c, word.meaning),
              )),
        ] else ...[
          Text(word.meaning,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
          const SizedBox(height: 20),
          TextField(
            controller: _input,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              labelText: '拼写单词',
            ),
            onSubmitted: (_) => _checkSpelling(word),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => _checkSpelling(word),
            child: const Text('提交'),
          ),
        ],
        if (_answered && _mode != QuizMode.spelling)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              _picked == word.meaning.hashCode ? '✅ 回答正确' : '❌ 正确答案：${word.meaning}',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: _picked == word.meaning.hashCode ? Colors.green : Colors.red),
            ),
          ),
        if (_answered)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: FilledButton(
              onPressed: () => setState(() {
                _index++;
                _answered = false;
                _picked = null;
                _input.clear();
              }),
              child: const Text('下一题'),
            ),
          ),
      ],
    );
  }

  Widget _choiceBtn(String text, String correct) {
    final isCorrect = text == correct;
    final highlight = _answered && isCorrect;
    final wrongPick = _answered && _picked == text.hashCode && !isCorrect;
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          backgroundColor: highlight
              ? Colors.green.withOpacity(0.15)
              : wrongPick
                  ? Colors.red.withOpacity(0.15)
                  : null,
          side: BorderSide(
              color: highlight
                  ? Colors.green
                  : wrongPick
                      ? Colors.red
                      : Colors.grey.shade400),
        ),
        onPressed: _answered
            ? null
            : () => setState(() {
                  _picked = text.hashCode;
                  _answered = true;
                  if (isCorrect) _score++;
                }),
        child: Text(text, textAlign: TextAlign.center),
      ),
    );
  }

  void _checkSpelling(Word word) {
    if (_answered) return;
    final ok = _input.text.trim().toLowerCase() == word.word.toLowerCase();
    setState(() {
      _answered = true;
      if (ok) _score++;
    });
  }
}
