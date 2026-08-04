import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/ipa.dart';
import '../services/speech_service.dart';
import '../services/syllables.dart';
import '../state.dart';

class WordCard extends StatefulWidget {
  final Word word;
  final bool flipped;
  final ValueChanged<bool> onFlip;

  const WordCard({
    super.key,
    required this.word,
    required this.flipped,
    required this.onFlip,
  });

  @override
  State<WordCard> createState() => _WordCardState();
}

class _WordCardState extends State<WordCard> {
  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    return GestureDetector(
      onTap: () => widget.onFlip(!widget.flipped),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: widget.flipped ? _back(s) : _front(s),
      ),
    );
  }

  Widget _front(AppState s) {
    final w = widget.word;
    final ipa = Ipa.lookup(w.word) ?? w.ipa;
    return Container(
      key: const ValueKey('front'),
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade300),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12)
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Wrap(
            spacing: 6,
            children: [
              _chip('No.${w.id}', Colors.blue),
              _chip('词频 ${w.freq}', Colors.amber.shade700),
              _chip(w.category, Colors.purple),
            ],
          ),
          const SizedBox(height: 18),
          Text(w.word,
              style:
                  const TextStyle(fontSize: 42, fontWeight: FontWeight.w800)),
          if (ipa != null && ipa.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(ipa.startsWith('/') ? ipa : '/$ipa/',
                  style: TextStyle(fontSize: 16, color: Colors.grey.shade600)),
            ),
          const SizedBox(height: 8),
          Text(
            Syllables.syllableText(w.word),
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w500,
                color: Color(0xFF10B981)),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FilledButton.icon(
                onPressed: () {
                  s.speech.accent = s.accent;
                  s.speech.speak(
                    text: w.word,
                    lang: 'en',
                    rate: s.rate,
                    kind: SpeakKind.word,
                    wordText: w.word,
                    kaoyanId: s.kaoyanIdOf(w.word),
                  );
                },
                icon: const Icon(Icons.volume_up, size: 18),
                label: const Text('播放'),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: () {
                  s.speech.accent = s.accent;
                  for (final p in Syllables.split(w.word)) {
                    s.speech.speak(
                      text: p,
                      lang: 'en',
                      rate: s.rate,
                      kind: SpeakKind.syllable,
                      wordText: w.word,
                    );
                  }
                },
                icon: const Icon(Icons.music_note, size: 18),
                label: const Text('逐音节'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('点击卡片翻面查看释义',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
        ],
      ),
    );
  }

  Widget _back(AppState s) {
    final w = widget.word;
    return Container(
      key: const ValueKey('back'),
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12)
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(w.word,
              style:
                  const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Text(w.meaning,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
          if (w.alt != null && w.alt!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('其他拼写：${w.alt}',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
            ),
          const SizedBox(height: 14),
          Text('点击卡片返回正面',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
        ],
      ),
    );
  }

  Widget _chip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text, style: TextStyle(fontSize: 11, color: color)),
      );
}

class SwitchPanel extends StatelessWidget {
  const SwitchPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final defs = [
      ('readMeaning', '朗读中文释义', '每个单词播完英文后朗读中文释义', false),
      ('aiExamples', 'AI 例句（总开关）', '开启后每播完一个单词自动生成例句；关闭后零 API 调用', false),
      (
        'withTranslation',
        '例句包含中文翻译',
        '开：英文+中文翻译+近义词辨析；关：只返回英文，节省 token',
        !(s.switches['aiExamples'] ?? false)
      ),
      ('syllables', '逐音节朗读', '自动播放时先逐音节慢读，再整词朗读', false),
      ('showMeaningCard', '显示中文释义卡片', '自动播放界面显示中文释义；关闭可纯听英文自测', false),
    ];
    return Column(
      children: defs.map((d) {
        final key = d.$1;
        final on = s.switches[key] ?? false;
        return Opacity(
          opacity: d.$4 ? 0.45 : 1,
          child: Card(
            margin: const EdgeInsets.symmetric(vertical: 4),
            child: ListTile(
              title: Text(d.$2,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(d.$3, style: const TextStyle(fontSize: 12)),
              trailing: Switch(
                value: on && !d.$4,
                onChanged: d.$4
                    ? null
                    : (v) {
                        s.switches[key] = v;
                        s.saveSettingsNow();
                        s.refresh();
                      },
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class RateControl extends StatelessWidget {
  const RateControl({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('播放语速',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                const Spacer(),
                Text('${s.rate.toStringAsFixed(2)}x',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
              ],
            ),
            Slider(
              min: 0.1,
              max: 5.0,
              divisions: 49,
              value: s.rate,
              label: '${s.rate.toStringAsFixed(2)}x',
              onChanged: (v) {
                s.rate = v;
                s.saveSettingsNow();
                s.refresh();
              },
            ),
            Wrap(
              spacing: 6,
              children: [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]
                  .map((v) {
                final active = (s.rate - v).abs() < 0.001;
                return ChoiceChip(
                  label:
                      Text(v == v.roundToDouble() ? '${v.toInt()}x' : '${v}x'),
                  selected: active,
                  onSelected: (_) {
                    s.rate = v;
                    s.saveSettingsNow();
                    s.refresh();
                  },
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class AccentControl extends StatelessWidget {
  const AccentControl({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('发音口音', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('🇺🇸 美式女声'),
                  selected: s.accent == 'us',
                  onSelected: (_) {
                    s.accent = 'us';
                    s.speech.accent = 'us';
                    s.saveSettingsNow();
                    s.refresh();
                  },
                ),
                ChoiceChip(
                  label: const Text('🇺🇸 美式男声'),
                  selected: s.accent == 'us-male',
                  onSelected: (_) {
                    s.accent = 'us-male';
                    s.speech.accent = 'us-male';
                    s.saveSettingsNow();
                    s.refresh();
                  },
                ),
                ChoiceChip(
                  label: const Text('🇬🇧 伦敦腔'),
                  selected: s.accent == 'uk',
                  onSelected: (_) {
                    s.accent = 'uk';
                    s.speech.accent = 'uk';
                    s.saveSettingsNow();
                    s.refresh();
                  },
                ),
                ChoiceChip(
                  label: const Text('🇬🇧 英式女声'),
                  selected: s.accent == 'uk-alba',
                  onSelected: (_) {
                    s.accent = 'uk-alba';
                    s.speech.accent = 'uk-alba';
                    s.saveSettingsNow();
                    s.refresh();
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
