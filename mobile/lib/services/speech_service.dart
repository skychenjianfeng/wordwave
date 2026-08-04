import 'dart:io';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

import '../api.dart';
import 'offline_tts.dart';
import 'syllables.dart';

enum SpeakKind { word, syllable, meaning, example }

class SpeechService {
  final ApiClient api;
  final FlutterTts _tts = FlutterTts();
  final AudioPlayer _player = AudioPlayer();
  final OfflineTtsService _offlineTts = OfflineTtsService();
  bool _ttsReady = false;

  SpeechService(this.api);

  Future<void> init() async {
    try {
      // 自动选择可用的系统 TTS 引擎（优先 Google / 小米，其次任意引擎）
      final engines = await _tts.getEngines;
      if (engines != null && engines.isNotEmpty) {
        String? preferred;
        String? fallback;
        for (final e in engines) {
          final name = (e.name ?? e.toString()).toLowerCase();
          if (name.contains('google') ||
              name.contains('clone') ||
              name.contains('espeak') ||
              name.contains('hayai')) {
            preferred = e.name;
            break;
          }
          // 小米 mibrain 不是标准 TTS 引擎（初始化会失败），仅在没有其它引擎时兜底
          if (!name.contains('mibrain') && !name.contains('voiceassist')) {
            fallback ??= e.name;
          }
        }
        preferred ??= fallback ?? engines.first.name;
        if (preferred != null) {
          await _tts.setEngine(preferred);
        }
      }
      await _tts.setLanguage('en-US');
      await _tts.setSpeechRate(0.5);
      await _tts.setVolume(1.0);
      await _tts.setPitch(1.0);
      _ttsReady = true;
    } catch (e) {
      debugPrint('TTS init failed: $e');
    }
    // 本地离线 TTS 在后台初始化（首次会复制约 145MB 模型，之后很快）
    unawaited(_offlineTts.init());
  }

  static double _mapRate(double rate) {
    if (defaultTargetPlatform == TargetPlatform.iOS)
      return (rate / 5).clamp(0.05, 1.0);
    return rate.clamp(0.1, 5.0);
  }

  Future<void> _speakTts(String text, String lang, double rate) async {
    if (!_ttsReady || text.trim().isEmpty) return;
    try {
      final completer = Completer<void>();
      _tts.setCompletionHandler(() {
        if (!completer.isCompleted) completer.complete();
      });
      _tts.setErrorHandler((_) {
        if (!completer.isCompleted) completer.complete();
      });
      final langOk = await _tts.setLanguage(lang == 'zh'
          ? 'zh-CN'
          : accent == 'uk'
              ? 'en-GB'
              : 'en-US');
      debugPrint('[speech] TTS setLanguage ok=$langOk');
      await _tts.setSpeechRate(_mapRate(rate));
      await _tts.stop();
      final result = await _tts.speak(text);
      debugPrint('[speech] TTS speak result=$result');
      await completer.future
          .timeout(const Duration(seconds: 30), onTimeout: () {});
    } catch (e) {
      debugPrint('[speech] TTS speak FAILED: $e');
    }
  }

  Future<File> _cacheFile(String name, Uint8List bytes) async {
    final f = await _cachePath(name);
    if (!await f.exists()) await f.writeAsBytes(bytes, flush: true);
    return f;
  }

  Future<File> _cachePath(String name) async {
    final dir = await getApplicationDocumentsDirectory();
    final folder = Directory('${dir.path}/audio_cache');
    if (!await folder.exists()) await folder.create(recursive: true);
    return File('${folder.path}/$name');
  }

  Future<File?> _fetchAudio(String urlPath, String cacheName) async {
    // 本地缓存优先：在线听过的音频，离线也能播放
    final cached = await _cachePath(cacheName);
    if (await cached.exists() && await cached.length() > 0) {
      debugPrint('[speech] audio cache hit: $cacheName');
      return cached;
    }
    // 未命中：后台预取到缓存，不阻塞本次播放（本次直接走本地合成，避免网络超时卡顿）
    unawaited(_prefetchAudio(urlPath, cacheName));
    return null;
  }

  Future<void> _prefetchAudio(String urlPath, String cacheName) async {
    try {
      final bytes = await api.audio(urlPath);
      final f = await _cacheFile(cacheName, bytes);
      debugPrint('[speech] audio prefetched: $urlPath (${bytes.length}B)');
    } catch (e) {
      debugPrint('[speech] audio prefetch FAILED: $urlPath -> $e');
    }
  }

  Future<bool> _playFile(File file, double rate) async {
    try {
      await _player.stop();
      await _player.setFilePath(file.path);
      await _player.setSpeed(rate.clamp(0.1, 5.0));
      await _player.play();
      debugPrint('[speech] playing file: ${file.path}');
      // 等待播放完成，避免音节/例句/释义互相打断
      await _player.processingStateStream
          .firstWhere((s) =>
              s == ProcessingState.completed || s == ProcessingState.idle)
          .timeout(const Duration(seconds: 60), onTimeout: () {
        debugPrint('[speech] play timeout, force stop');
        return ProcessingState.idle;
      });
      return true;
    } catch (e) {
      debugPrint('[speech] playFile FAILED: ${file.path} -> $e');
      return false;
    }
  }

  /// 发音入口：优先本地缓存音频（从服务器按需下载），其次服务器 Piper，最后设备离线 TTS。
  Future<void> speak({
    required String text,
    required String lang,
    required double rate,
    required SpeakKind kind,
    String? wordText,
    int? wordId,
    int? kaoyanId,
  }) async {
    final clean = text.trim();
    if (clean.isEmpty) return;
    final accent = this.accent; // us / uk
    final hasServerAudio = accent == 'us' || accent == 'uk';
    debugPrint('[speech] speak kind=${kind.name} lang=$lang text=$clean');

    if (lang == 'en' &&
        kind != SpeakKind.example &&
        wordText != null &&
        kaoyanId != null &&
        hasServerAudio) {
      // 考研词库预生成音包（与网页版同一批文件，按需下载并本地缓存）
      final prefix = accent == 'uk' ? '/audio/uk/words/' : '/audio/words/';
      final file = await _fetchAudio(
          '$prefix$kaoyanId.mp3', '${accent}_w_$kaoyanId.mp3');
      if (file != null) {
        final ok = await _playFile(file, rate);
        debugPrint('[speech] local word audio ok=$ok');
        if (ok) return;
      }
    }
    if (lang == 'en' && kind == SpeakKind.syllable) {
      final f = Syllables.audioFile(clean.toLowerCase());
      if (f != null && hasServerAudio) {
        final prefix =
            accent == 'uk' ? '/audio/uk/syllables/' : '/audio/syllables/';
        final file = await _fetchAudio('$prefix$f.mp3', '${accent}_s_$f.mp3');
        if (file != null && await _playFile(file, rate)) return;
      }
    }
    if (lang == 'zh' &&
        kind == SpeakKind.meaning &&
        wordText != null &&
        kaoyanId != null &&
        hasServerAudio) {
      final file = await _fetchAudio(
          '/audio/meanings/$kaoyanId.mp3', 'zh_m_$kaoyanId.mp3');
      if (file != null && await _playFile(file, rate)) return;
    }
    // 中文离线合成（本地 Piper 中文模型，不联网、不依赖系统 TTS）
    if (lang == 'zh') {
      final file = await _offlineTts.synthesize(
        text: clean,
        accent: 'zh',
        rate: rate,
      );
      if (file != null && await _playFile(file, 1.0)) {
        debugPrint('[speech] offline zh TTS ok');
        return;
      }
    }
    // 服务器本地 Piper（动态英文文本：AI 例句等）
    // 完全离线的本地 Piper 合成（sherpa-onnx）：不联网、不依赖系统 TTS
    if (lang == 'en') {
      final file = await _offlineTts.synthesize(
        text: clean,
        accent: accent,
        rate: rate,
      );
      if (file != null && await _playFile(file, 1.0)) {
        debugPrint('[speech] offline local TTS ok');
        return;
      }
      debugPrint('[speech] offline local TTS unavailable, fallback');
    }
    if (lang == 'en') {
      try {
        final bytes = await api.speech(clean, 'en', accent);
        final file =
            await _cacheFile('piper_${accent}_${clean.hashCode}.wav', bytes);
        debugPrint('[speech] server piper fetched ${bytes.length}B');
        final ok = await _playFile(file, rate);
        debugPrint('[speech] server piper ok=$ok');
        if (ok) return;
      } catch (e) {
        debugPrint('[speech] server piper FAILED: $e');
      }
    }
    debugPrint('[speech] -> device TTS fallback');
    await _speakTts(clean, lang, rate);
  }

  String accent = 'us';

  Future<void> stop() async {
    try {
      await _player.stop();
      await _tts.stop();
    } catch (_) {}
  }

  Future<void> pause() async {
    try {
      if (_player.playing) await _player.pause();
      await _tts.stop();
    } catch (_) {}
  }

  Future<void> dispose() async {
    await _player.dispose();
  }
}
