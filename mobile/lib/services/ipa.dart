import 'dart:convert';

import 'package:flutter/services.dart';

/// 本地音标查询（词表子集，来自 CMU/ipa-dict）。
class Ipa {
  static Map<String, String>? _map;

  static Future<void> ensureLoaded() async {
    if (_map != null) return;
    final raw = await rootBundle.loadString('assets/data/ipa.json');
    _map = (jsonDecode(raw) as Map<String, dynamic>)
        .map((k, v) => MapEntry(k, v.toString()));
  }

  static String? lookup(String word) {
    final m = _map;
    if (m == null) return null;
    return m[word] ?? m[word.toLowerCase()];
  }
}
