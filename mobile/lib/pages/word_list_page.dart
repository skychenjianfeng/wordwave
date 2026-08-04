import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/ipa.dart';
import '../services/speech_service.dart';
import '../services/syllables.dart';
import '../state.dart';

class WordListPage extends StatefulWidget {
  const WordListPage({super.key});

  @override
  State<WordListPage> createState() => _WordListPageState();
}

class _WordListPageState extends State<WordListPage> {
  String _q = '';
  String _category = '全部';
  String _status = '全部';
  bool _restored = false;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    // 词库就绪后恢复上次筛选设置（init 异步完成后再读取）
    if (!_restored && s.words.isNotEmpty) {
      _restored = true;
      _q = s.wordlistQuery;
      _category = s.wordlistCategory;
      _status = s.wordlistStatus;
    }
    if (_category != '全部' && !s.words.any((w) => w.category == _category)) {
      _category = '全部';
    }
    if (_status != '全部' &&
        !['全部', '生词', '学习中', '已掌握', '错词'].contains(_status)) {
      _status = '全部';
    }
    final cats = {'全部', ...s.words.map((w) => w.category)};
    final filtered = s.words.where((w) {
      if (_q.isNotEmpty &&
          !w.word.toLowerCase().contains(_q.toLowerCase()) &&
          !w.meaning.contains(_q)) {
        return false;
      }
      if (_category != '全部' && w.category != _category) return false;
      final r = s.records[w.word];
      if (_status == '生词' && r?.learnedAt != null) return false;
      if (_status == '学习中' && r?.status != 'learning') return false;
      if (_status == '已掌握' && r?.status != 'mastered') return false;
      if (_status == '错词' && (r?.wrongCount ?? 0) == 0) return false;
      return true;
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: s.activeDictId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(),
                      labelText: '词库'),
                  items: s.dicts
                      .map((d) => DropdownMenuItem(
                          value: d.id,
                          child: Text('${d.name}（${d.count}）',
                              overflow: TextOverflow.ellipsis)))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) s.loadDict(v);
                  },
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TextField(
            decoration: const InputDecoration(
              isDense: true,
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.search, size: 20),
              hintText: '搜索单词或释义',
            ),
            onChanged: (v) {
              setState(() => _q = v);
              s.setWordlistFilters(query: v);
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _category,
                  isExpanded: true,
                  decoration: const InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(),
                      labelText: '分类'),
                  items: cats
                      .map((c) => DropdownMenuItem(
                          value: c,
                          child: Text(c, overflow: TextOverflow.ellipsis)))
                      .toList(),
                  onChanged: (v) {
                    setState(() => _category = v ?? '全部');
                    s.setWordlistFilters(category: _category);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _status,
                  isExpanded: true,
                  decoration: const InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(),
                      labelText: '状态'),
                  items: ['全部', '生词', '学习中', '已掌握', '错词']
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) {
                    setState(() => _status = v ?? '全部');
                    s.setWordlistFilters(status: _status);
                  },
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text('当前词库共 ${s.words.length} 词 · 筛选 ${filtered.length} 词',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        ),
        const SizedBox(height: 4),
        Expanded(
          child: ListView.builder(
            itemCount: filtered.length,
            itemBuilder: (context, i) {
              final w = filtered[i];
              final r = s.records[w.word];
              final Color badgeColor;
              final String badge;
              if (r?.learnedAt == null) {
                badge = '生词';
                badgeColor = Colors.grey;
              } else if (r?.status == 'mastered') {
                badge = '已掌握';
                badgeColor = Colors.green;
              } else if ((r?.wrongCount ?? 0) > 0) {
                badge = '错词';
                badgeColor = Colors.red;
              } else {
                badge = '学习中';
                badgeColor = Colors.blue;
              }
              return ListTile(
                dense: true,
                leading: Text('#${w.id}',
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                title: Text(w.word,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(
                  '${Syllables.syllableText(w.word)}  ${w.meaning}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12),
                ),
                trailing: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: badgeColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(badge,
                      style: TextStyle(fontSize: 11, color: badgeColor)),
                ),
                onTap: () => showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => WordDetailSheet(word: w),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class WordDetailSheet extends StatefulWidget {
  final Word word;
  const WordDetailSheet({super.key, required this.word});

  @override
  State<WordDetailSheet> createState() => _WordDetailSheetState();
}

class _WordDetailSheetState extends State<WordDetailSheet> {
  ExampleData? _example;
  bool _exampleLoading = false;
  String? _exampleError;
  bool _fromCache = false;
  late TextEditingController _noteCtrl;

  @override
  void initState() {
    super.initState();
    _noteCtrl = TextEditingController(
        text: context
                .read<AppState>()
                .records[widget.word.word]
                ?.notes
                .wordNote ??
            '');
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadExample({bool force = false}) async {
    final s = context.read<AppState>();
    setState(() {
      _exampleLoading = true;
      _exampleError = null;
    });
    try {
      final r = await s.getExample(widget.word.word, widget.word.meaning,
          s.switches['withTranslation'] == true, s.exampleStyle,
          force: force);
      if (!mounted) return;
      setState(() {
        _example = r.data;
        _fromCache = r.fromCache;
        _exampleLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _exampleLoading = false;
        _exampleError = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final w = widget.word;
    final notes = s.records[w.word]?.notes;
    final ipa = Ipa.lookup(w.word) ?? w.ipa;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(4)),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(w.word,
                        style: const TextStyle(
                            fontSize: 30, fontWeight: FontWeight.w800)),
                    Text(Syllables.syllableText(w.word),
                        style: const TextStyle(
                            fontSize: 16, color: Color(0xFF10B981))),
                    if (ipa != null && ipa.isNotEmpty)
                      Text(ipa.startsWith('/') ? ipa : '/$ipa/',
                          style: TextStyle(color: Colors.grey.shade600)),
                  ],
                ),
              ),
              IconButton(
                iconSize: 36,
                onPressed: () {
                  s.speech.speak(
                    text: w.word,
                    lang: 'en',
                    rate: s.rate,
                    kind: SpeakKind.word,
                    wordText: w.word,
                    kaoyanId: s.kaoyanIdOf(w.word),
                  );
                },
                icon: const Icon(Icons.volume_up),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(w.meaning,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          if (w.alt != null && w.alt!.isNotEmpty)
            Text('其他拼写：${w.alt}',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          const Divider(height: 28),
          Text('音节笔记', style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          ...Syllables.split(w.word).asMap().entries.map((e) {
            final note = (notes?.syllableNotes.length ?? 0) > e.key
                ? notes!.syllableNotes[e.key]
                : '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: TextField(
                controller: TextEditingController(text: note),
                decoration: InputDecoration(
                  isDense: true,
                  border: const OutlineInputBorder(),
                  labelText: '${e.value} 联想/词根',
                ),
                onChanged: (v) => s.setSyllableNote(w.word, e.key, v),
              ),
            );
          }),
          TextField(
            controller: _noteCtrl,
            maxLines: 2,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              labelText: '整词笔记（联想、词根词缀分析）',
            ),
            onChanged: (v) => s.setWordNote(w.word, v),
          ),
          const Divider(height: 28),
          Row(
            children: [
              const Text('AI 例句',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              if (_example != null)
                Text(_fromCache ? '（缓存）' : '（新生成）',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              IconButton(
                tooltip: '重新生成',
                onPressed:
                    _exampleLoading ? null : () => _loadExample(force: true),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          if (_exampleLoading)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator()))
          else if (_exampleError != null)
            Text('例句生成失败：$_exampleError',
                style: const TextStyle(color: Colors.red))
          else if (_example != null) ...[
            Card(
              color: Colors.blue.withOpacity(0.06),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_example!.english,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600)),
                    if (_example!.chinese.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(_example!.chinese,
                          style: TextStyle(color: Colors.grey.shade700)),
                    ],
                    if (_example!.distinction.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text('🔍 ${_example!.distinction}',
                          style: const TextStyle(fontSize: 12)),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: () {
                s.speech.speak(
                  text: _example!.english,
                  lang: 'en',
                  rate: s.rate,
                  kind: SpeakKind.example,
                );
              },
              icon: const Icon(Icons.volume_up),
              label: const Text('朗读例句'),
            ),
          ] else
            FilledButton(
              onPressed: _loadExample,
              child: const Text('生成例句'),
            ),
        ],
      ),
    );
  }
}
