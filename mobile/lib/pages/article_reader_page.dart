import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../main.dart';
import '../services/speech_service.dart';
import '../state.dart';

class ArticleReaderPage extends StatefulWidget {
  final String title;
  final String content;
  final String meta;
  final String link;
  final String articleId;

  const ArticleReaderPage({
    super.key,
    required this.title,
    required this.content,
    required this.meta,
    this.link = '',
    this.articleId = '',
  });

  @override
  State<ArticleReaderPage> createState() => _ArticleReaderPageState();
}

class _ArticleReaderPageState extends State<ArticleReaderPage> {
  String _content = '';
  bool _loading = false;
  String? _translation;
  bool _translating = false;
  bool _showTranslation = false;
  String? _transError;

  @override
  void initState() {
    super.initState();
    _content = widget.content;
    // 内置文章已带全文；只有内容为空时才从服务器拉取（离线不影响）
    if (widget.articleId.isNotEmpty && _content.isEmpty) _loadDetail();
  }

  Future<void> _loadDetail() async {
    final api = context.read<AppState>().api;
    setState(() => _loading = true);
    try {
      final r = await api.get('/api/articles/${widget.articleId}');
      if (!mounted) return;
      setState(() {
        _content = (r['data'] as Map<String, dynamic>?)?['content'] as String? ?? _content;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _speak() async {
    final s = context.read<AppState>();
    await s.speech.speak(text: widget.title, lang: 'en', rate: s.rate, kind: SpeakKind.example);
    // 分句朗读正文
    final sentences = _content
        .split(RegExp(r'(?<=[.!?])\s+'))
        .where((x) => x.trim().isNotEmpty)
        .take(20);
    for (final sentence in sentences) {
      await s.speech.speak(text: sentence, lang: 'en', rate: s.rate, kind: SpeakKind.example);
    }
  }

  Future<void> _translate() async {
    if (_translating) return;
    if (_translation != null) {
      setState(() => _showTranslation = !_showTranslation);
      return;
    }
    final api = context.read<AppState>().api;
    setState(() {
      _translating = true;
      _transError = null;
    });
    try {
      final r = await api.post('/api/translate', {'text': _content});
      if (!mounted) return;
      setState(() {
        _translation = (r['data'] as Map<String, dynamic>?)?['translation'] as String? ?? '';
        _translating = false;
        _showTranslation = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _translating = false;
        _transError = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(widget.title,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, height: 1.3)),
        const SizedBox(height: 8),
        Row(
          children: [
            Text(widget.meta,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
            const Spacer(),
            IconButton(
              tooltip: '朗读全文',
              icon: const Icon(Icons.volume_up),
              onPressed: _speak,
            ),
            if (_translating)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: SizedBox(
                    width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else
              TextButton.icon(
                onPressed: _content.isEmpty ? null : _translate,
                icon: Icon(_showTranslation ? Icons.visibility_off : Icons.translate, size: 18),
                label: Text(_showTranslation ? '隐藏翻译' : '一键翻译'),
              ),
          ],
        ),
        if (_transError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text('翻译失败：$_transError',
                style: const TextStyle(color: Colors.red, fontSize: 12)),
          ),
        const Divider(),
        if (_loading)
          const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
        else
          _BilingualView(
            original: _content,
            translation: _showTranslation ? _translation : null,
          ),
        if (widget.link.isNotEmpty) ...[
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () async {
              final uri = Uri.parse(widget.link);
              final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
              if (!ok && context.mounted) toast(context, '无法打开链接');
            },
            icon: const Icon(Icons.open_in_new),
            label: const Text('打开原文'),
          ),
        ],
      ],
    );
  }
}

class _BilingualView extends StatelessWidget {
  final String original;
  final String? translation;

  const _BilingualView({required this.original, this.translation});

  @override
  Widget build(BuildContext context) {
    if (translation == null || translation!.isEmpty) {
      return Text(original, style: const TextStyle(fontSize: 16, height: 1.75));
    }
    final enParts =
        original.split(RegExp(r'\n\s*\n')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    final zhParts = translation!
        .split(RegExp(r'\n\s*\n'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    final paired = enParts.length == zhParts.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (paired)
          for (var i = 0; i < enParts.length; i++) ...[
            Text(enParts[i], style: const TextStyle(fontSize: 16, height: 1.75)),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(zhParts[i],
                  style: TextStyle(
                      fontSize: 14.5,
                      height: 1.7,
                      color: Colors.grey.shade800)),
            ),
            const SizedBox(height: 14),
          ]
        else ...[
          Text(original, style: const TextStyle(fontSize: 16, height: 1.75)),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.blue.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(translation!,
                style: TextStyle(
                    fontSize: 14.5,
                    height: 1.7,
                    color: Colors.grey.shade800)),
          ),
        ],
      ],
    );
  }
}
