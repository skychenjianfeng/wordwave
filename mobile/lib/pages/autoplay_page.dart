import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/ipa.dart';
import '../services/syllables.dart';
import '../state.dart';
import '../widgets/cards.dart';

class AutoplayPage extends StatelessWidget {
  const AutoplayPage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (s.status == 'idle') return const _ConfigView();
    return _PlayerView();
  }
}

class _ConfigView extends StatefulWidget {
  const _ConfigView();

  @override
  State<_ConfigView> createState() => _ConfigViewState();
}

class _ConfigViewState extends State<_ConfigView> {
  final _countCtrl = TextEditingController(text: '20');

  @override
  void dispose() {
    _countCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final cfg = s.config;
    final cats = s.words.map((w) => w.category).toSet().toList();
    final available = s.buildQueue(cfg).length;

    void setCfg(AutoplayConfig c) {
      s.config = c;
      s.saveSettingsNow();
      s.refresh();
    }

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            children: [
              const Text('自动播放设置',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text('可高度自定义的听力播放器，播放过的单词自动记为「已学」',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('选择词库',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: s.activeDictId,
                        isExpanded: true,
                        decoration: const InputDecoration(
                            isDense: true, border: OutlineInputBorder()),
                        items: s.dicts
                            .map((d) => DropdownMenuItem(
                                value: d.id,
                                child: Text('${d.name}（${d.count} 词）',
                                    overflow: TextOverflow.ellipsis)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) s.loadDict(v);
                        },
                      ),
                      const Divider(height: 22),
                      const Text('播放顺序',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<AutoplayOrder>(
                        value: cfg.order,
                        isExpanded: true,
                        decoration: const InputDecoration(
                            isDense: true, border: OutlineInputBorder()),
                        items: AutoplayOrder.values.map((o) {
                          final labels = {
                            AutoplayOrder.freq: '按词频顺序',
                            AutoplayOrder.random: '随机',
                            AutoplayOrder.unknown: '只播生词',
                            AutoplayOrder.wrong: '只播错词',
                            AutoplayOrder.category: '按分类筛选',
                            AutoplayOrder.range: '按词频区间筛选',
                          };
                          return DropdownMenuItem(
                              value: o,
                              child: Text(labels[o]!,
                                  overflow: TextOverflow.ellipsis));
                        }).toList(),
                        onChanged: (o) {
                          if (o == null) return;
                          setCfg(AutoplayConfig(
                            order: o,
                            category: cfg.category,
                            rangeMin: cfg.rangeMin,
                            rangeMax: cfg.rangeMax,
                            count: cfg.count,
                            repeats: cfg.repeats,
                            interval: cfg.interval,
                          ));
                        },
                      ),
                      if (cfg.order == AutoplayOrder.category) ...[
                        const SizedBox(height: 8),
                        DropdownButtonFormField<String>(
                          value: cfg.category.isEmpty && cats.isNotEmpty
                              ? cats.first
                              : cfg.category,
                          decoration: const InputDecoration(
                              isDense: true,
                              border: OutlineInputBorder(),
                              labelText: '分类'),
                          items: cats
                              .map((c) =>
                                  DropdownMenuItem(value: c, child: Text(c)))
                              .toList(),
                          onChanged: (v) => setCfg(AutoplayConfig(
                            order: cfg.order,
                            category: v ?? '',
                            rangeMin: cfg.rangeMin,
                            rangeMax: cfg.rangeMax,
                            count: cfg.count,
                            repeats: cfg.repeats,
                            interval: cfg.interval,
                          )),
                        ),
                      ],
                      if (cfg.order == AutoplayOrder.range) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    isDense: true,
                                    border: OutlineInputBorder(),
                                    labelText: '起始序号'),
                                onChanged: (v) => setCfg(AutoplayConfig(
                                  order: cfg.order,
                                  category: cfg.category,
                                  rangeMin: int.tryParse(v) ?? cfg.rangeMin,
                                  rangeMax: cfg.rangeMax,
                                  count: cfg.count,
                                  repeats: cfg.repeats,
                                  interval: cfg.interval,
                                )),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    isDense: true,
                                    border: OutlineInputBorder(),
                                    labelText: '结束序号'),
                                onChanged: (v) => setCfg(AutoplayConfig(
                                  order: cfg.order,
                                  category: cfg.category,
                                  rangeMin: cfg.rangeMin,
                                  rangeMax: int.tryParse(v) ?? cfg.rangeMax,
                                  count: cfg.count,
                                  repeats: cfg.repeats,
                                  interval: cfg.interval,
                                )),
                              ),
                            ),
                          ],
                        ),
                      ],
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
                          const Text('本次播放数量',
                              style: TextStyle(fontWeight: FontWeight.bold)),
                          const Spacer(),
                          SizedBox(
                            width: 80,
                            child: TextField(
                              controller: _countCtrl,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                  isDense: true, border: OutlineInputBorder()),
                              onChanged: (v) => setCfg(AutoplayConfig(
                                order: cfg.order,
                                category: cfg.category,
                                rangeMin: cfg.rangeMin,
                                rangeMax: cfg.rangeMax,
                                count: int.tryParse(v) ?? cfg.count,
                                repeats: cfg.repeats,
                                interval: cfg.interval,
                              )),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('当前筛选可播 $available 个',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                      const Divider(height: 18),
                      Row(
                        children: [
                          const Text('发音重复',
                              style: TextStyle(fontWeight: FontWeight.bold)),
                          const Spacer(),
                          DropdownButton<int>(
                            value: cfg.repeats,
                            items: List.generate(
                                10,
                                (i) => DropdownMenuItem(
                                    value: i + 1, child: Text('${i + 1} 遍'))),
                            onChanged: (v) => setCfg(AutoplayConfig(
                              order: cfg.order,
                              category: cfg.category,
                              rangeMin: cfg.rangeMin,
                              rangeMax: cfg.rangeMax,
                              count: cfg.count,
                              repeats: v ?? cfg.repeats,
                              interval: cfg.interval,
                            )),
                          ),
                        ],
                      ),
                      const Divider(height: 18),
                      Row(
                        children: [
                          const Text('单词间隔',
                              style: TextStyle(fontWeight: FontWeight.bold)),
                          const Spacer(),
                          Text('${cfg.interval.toStringAsFixed(1)} 秒',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF10B981))),
                        ],
                      ),
                      Slider(
                        min: 0,
                        max: 10,
                        divisions: 20,
                        value: cfg.interval,
                        label: '${cfg.interval.toStringAsFixed(1)} 秒',
                        onChanged: (v) => setCfg(AutoplayConfig(
                          order: cfg.order,
                          category: cfg.category,
                          rangeMin: cfg.rangeMin,
                          rangeMax: cfg.rangeMax,
                          count: cfg.count,
                          repeats: cfg.repeats,
                          interval: v,
                        )),
                      ),
                    ],
                  ),
                ),
              ),
              const RateControl(),
              const SizedBox(height: 10),
              const AccentControl(),
              const SizedBox(height: 10),
              const Text('开关区（全部持久化保存）',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SwitchPanel(),
              const SizedBox(height: 10),
              Card(
                color: Colors.blue.withOpacity(0.06),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('🤖 AI 例句风格',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<ExampleStyle>(
                        value: s.exampleStyle,
                        isExpanded: true,
                        decoration: const InputDecoration(
                            isDense: true, border: OutlineInputBorder()),
                        items: ExampleStyle.values.map((st) {
                          final labels = {
                            ExampleStyle.exam: '考研真题风',
                            ExampleStyle.daily: '日常简单风',
                            ExampleStyle.funny: '搞笑幽默风',
                            ExampleStyle.business: '商务职场风',
                            ExampleStyle.story: '故事叙述风',
                            ExampleStyle.tiktok: 'TikTok 短视频风',
                            ExampleStyle.twitter: '推特发文/评论风',
                          };
                          return DropdownMenuItem(
                              value: st,
                              child: Text(labels[st]!,
                                  overflow: TextOverflow.ellipsis));
                        }).toList(),
                        onChanged: s.switches['aiExamples'] == true
                            ? (st) {
                                if (st == null) return;
                                s.exampleStyle = st;
                                s.saveSettingsNow();
                                s.refresh();
                              }
                            : null,
                      ),
                      const SizedBox(height: 6),
                      Text('例句缓存本地 ${s.exampleCache.length} 条',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                  backgroundColor: Colors.green,
                  padding: const EdgeInsets.symmetric(vertical: 14)),
              onPressed: available == 0 ? null : s.autoplayStart,
              icon: const Icon(Icons.play_arrow),
              label: Text('开始自动播放（${available.clamp(0, cfg.count)} 个单词）'),
            ),
          ),
        ),
      ],
    );
  }
}

class _PlayerView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final word = s.currentWord;
    final example = s.exampleData;
    final wordIpa = word == null ? null : (Ipa.lookup(word.word) ?? word.ipa);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: s.status == 'playing'
                    ? Colors.green.withOpacity(0.12)
                    : Colors.amber.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(s.status == 'playing' ? '▶ 播放中' : '⏸ 已暂停',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: s.status == 'playing'
                          ? Colors.green
                          : Colors.amber.shade800)),
            ),
            const Spacer(),
            Text('第 ${s.index + 1} / ${s.total} 个',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            if (s.config.repeats > 1)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Text('发音 第 ${s.repeatIndex + 1}/${s.config.repeats} 遍',
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ),
          ],
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: s.total == 0 ? 0 : s.done / s.total),
        const SizedBox(height: 16),
        if (word != null) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text(word.word,
                      style: const TextStyle(
                          fontSize: 36, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(Syllables.syllableText(word.word),
                      style: const TextStyle(
                          fontSize: 18, color: Color(0xFF10B981))),
                  if (wordIpa != null && wordIpa.isNotEmpty)
                    Text(wordIpa.startsWith('/') ? wordIpa : '/$wordIpa/',
                        style: TextStyle(
                            fontSize: 14, color: Colors.grey.shade600)),
                  if (s.switches['showMeaningCard'] == true) ...[
                    const Divider(height: 20),
                    Text(word.meaning,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w600)),
                  ],
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        if (s.exampleLoading)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            ),
          )
        else if (example != null)
          Card(
            color: Colors.blue.withOpacity(0.06),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(example.english,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
                  if (example.chinese.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(example.chinese,
                        style: TextStyle(color: Colors.grey.shade700)),
                  ],
                  if (example.distinction.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('🔍 ${example.distinction}',
                        style: const TextStyle(fontSize: 12)),
                  ],
                ],
              ),
            ),
          )
        else if (s.exampleError != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text('AI 例句生成失败，已自动跳过：${s.exampleError}',
                  style: const TextStyle(color: Colors.red, fontSize: 12)),
            ),
          ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            IconButton.filledTonal(
              iconSize: 30,
              onPressed: s.autoplayPrev,
              icon: const Icon(Icons.skip_previous),
              tooltip: '上一个',
            ),
            IconButton.filled(
              iconSize: 34,
              style: IconButton.styleFrom(
                  backgroundColor: Colors.green,
                  padding: const EdgeInsets.all(14)),
              onPressed: s.autoplayToggle,
              icon:
                  Icon(s.status == 'playing' ? Icons.pause : Icons.play_arrow),
              tooltip: '暂停/继续',
            ),
            IconButton.filledTonal(
              iconSize: 30,
              onPressed: s.autoplayNext,
              icon: const Icon(Icons.skip_next),
              tooltip: '下一个',
            ),
          ],
        ),
        const SizedBox(height: 6),
        Center(
          child: TextButton.icon(
            onPressed: s.autoplayStop,
            icon: const Icon(Icons.stop),
            label: const Text('停止并返回配置'),
          ),
        ),
        if (s.status == 'finished')
          Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text('🎉 播放完成',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text('本次共播放 ${s.total} 个单词，已自动记为「已学」',
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: s.autoplayStart,
                    child: const Text('🔁 再播一遍'),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
