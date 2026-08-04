import 'dart:convert';

import 'package:flutter/services.dart';

class Syllables {
  static Map<String, String>? _map;
  static Map<String, String>? _audioMap;

  static Future<void> ensureLoaded() async {
    if (_map != null) return;
    final raw = await rootBundle.loadString('assets/data/syllables.json');
    final obj = jsonDecode(raw) as Map<String, dynamic>;
    _map = obj.map((k, v) => MapEntry(k, v.toString()));
    final rawAudio = await rootBundle.loadString('assets/data/audio-syllables.json');
    final objAudio = jsonDecode(rawAudio) as Map<String, dynamic>;
    _audioMap = objAudio.map((k, v) => MapEntry(k, v.toString()));
  }

  static List<String> split(String word) {
    final t = syllableText(word);
    if (t.contains('\u00B7')) return t.split('\u00B7').where((s) => s.isNotEmpty).toList();
    return [word];
  }

  static String syllableText(String word) {
    final key = word.toLowerCase();
    return _map?[key] ?? word;
  }

  static String? audioFile(String syllable) => _audioMap?[syllable.toLowerCase()];
}
