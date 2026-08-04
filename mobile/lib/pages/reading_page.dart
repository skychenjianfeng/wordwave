import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'dart:convert';
import 'package:provider/provider.dart';

import '../state.dart';
import 'article_reader_page.dart';

class ReadingPage extends StatefulWidget {
  const ReadingPage({super.key});

  @override
  State<ReadingPage> createState() => _ReadingPageState();
}

class _ReadingPageState extends State<ReadingPage> {
  bool _newsMode = false;
  String _level = '全部';
  String _source = 'xinhua';
  List<Map<String, dynamic>> _articles = [];
  List<Map<String, dynamic>> _news = [];
  List<Map<String, dynamic>> _sources = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadArticles();
    _loadSources();
  }

  Future<void> _loadArticles() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // 分级文章已内置在 App 中，完全离线可用
      final raw = await rootBundle.loadString('assets/data/articles.json');
      final list = (jsonDecode(raw) as List)
          .map((e) => e as Map<String, dynamic>)
          .toList();
      if (!mounted) return;
      setState(() {
        _articles = _level == '全部'
            ? list
            : list.where((a) => a['level'] == _level).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  Future<void> _loadSources() async {
    final api = context.read<AppState>().api;
    try {
      final r = await api.get('/api/articles/rss/sources');
      if (!mounted) return;
      setState(() {
        _sources = ((r['data'] as List?) ?? [])
            .map((e) => e as Map<String, dynamic>)
            .toList();
      });
    } catch (_) {}
  }

  Future<void> _loadNews() async {
    final api = context.read<AppState>().api;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await api.get('/api/articles/rss',
          query: {'source': _source, 'limit': '15'});
      if (!mounted) return;
      setState(() {
        _news = ((r['data'] as Map<String, dynamic>?)?['items'] as List? ?? [])
            .map((e) => e as Map<String, dynamic>)
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
          child: SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('分级文章'), icon: Icon(Icons.article_outlined, size: 16)),
              ButtonSegment(value: true, label: Text('实时新闻'), icon: Icon(Icons.newspaper, size: 16)),
            ],
            selected: {_newsMode},
            onSelectionChanged: (v) {
              setState(() {
                _newsMode = v.first;
                _error = null;
              });
              if (_newsMode && _news.isEmpty) _loadNews();
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: SizedBox(
            height: 38,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _newsMode
                  ? _sources.map((src) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          visualDensity: VisualDensity.compact,
                          label: Text(src['name'].toString()),
                          selected: _source == src['id'],
                          onSelected: (_) {
                            setState(() => _source = src['id'].toString());
                            _loadNews();
                          },
                        ),
                      )).toList()
                  : ['全部', '初中', '高中', '四级', '六级', '考研', '雅思']
                      .map((l) => Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: ChoiceChip(
                              visualDensity: VisualDensity.compact,
                              label: Text(l),
                              selected: _level == l,
                              onSelected: (_) {
                                setState(() => _level = l);
                                _loadArticles();
                              },
                            ),
                          ))
                      .toList(),
            ),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                Expanded(
                  child: Text('加载失败：$_error',
                      style: const TextStyle(color: Colors.red, fontSize: 12)),
                ),
                TextButton(
                  onPressed: _newsMode ? _loadNews : _loadArticles,
                  child: const Text('重试'),
                ),
              ],
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _newsMode ? _loadNews : _loadArticles,
            child: _loading && (_newsMode ? _news : _articles).isEmpty
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: (_newsMode ? _news : _articles).length,
                    itemBuilder: (context, i) {
                      final item = (_newsMode ? _news : _articles)[i];
                      final title = (item['title'] as String?) ?? '';
                      final summary = (item['summary'] as String?) ?? '';
                      final sub = _newsMode
                          ? '${item['sourceName']} · ${(item['pubDate'] as String? ?? '').split('T').first}'
                          : '${item['level']} · 约 ${item['wordCount']} 词';
                      return ListTile(
                        title: Text(title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(summary,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12)),
                        trailing: Text(sub,
                            style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                        onTap: () {
                          if (_newsMode) {
                            Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => Scaffold(
                                appBar: AppBar(title: const Text('新闻原文')),
                                body: ArticleReaderPage(
                                  title: title,
                                  content: summary,
                                  meta: sub,
                                  link: (item['link'] as String?) ?? '',
                                ),
                              ),
                            ));
                          } else {
                            Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => Scaffold(
                                appBar: AppBar(title: const Text('阅读')),
                                body: ArticleReaderPage(
                                  title: title,
                                  content: (item['content'] as String?) ?? '',
                                  meta: sub,
                                  articleId: (item['id'] as String?) ?? '',
                                ),
                              ),
                            ));
                          }
                        },
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
