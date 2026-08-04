import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa_onnx;

/// 完全离线的 TTS 引擎（sherpa-onnx + Piper 模型）。
///
/// 不依赖系统 TextToSpeech 服务，也不依赖网络：
/// 模型（ONNX + tokens + espeak-ng-data）全部打进 App 资源，
/// 首次使用时复制到应用支持目录，之后在 App 进程内直接推理合成 wav。
/// 这可以绕开小米 MIUI 上系统 TTS 引擎被杀/不可用的问题。
class OfflineTtsService {
  static const MethodChannel _channel = MethodChannel('wordwave/offline_tts');
  sherpa_onnx.OfflineTts? _usTts;
  sherpa_onnx.OfflineTts? _ukTts;
  sherpa_onnx.OfflineTts? _usMaleTts;
  sherpa_onnx.OfflineTts? _albaTts;
  sherpa_onnx.OfflineTts? _zhTts;
  Future<void>? _initFuture;
  String? _dataDir;
  String? _lastError;
  bool _androidChannelReady = false;

  bool get isReady => _dataDir != null && _lastError == null;
  String? get lastError => _lastError;

  Future<void> init() {
    _initFuture ??= _doInit();
    return _initFuture!;
  }

  Future<void> _doInit() async {
    try {
      sherpa_onnx.initBindings();
      // Android 优先走 JNI 通道（与 sherpa 官方 TTS 引擎同一条经过验证的路径），
      // 数据复制由 Kotlin 侧完成，避免在 Dart 侧重复拷贝 145MB。
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        try {
          final ok = await _channel.invokeMethod<bool>('probe') ?? false;
          if (ok) {
            _androidChannelReady = true;
            debugPrint('[offline-tts] android JNI channel ready');
            return;
          }
        } catch (e) {
          debugPrint('[offline-tts] android JNI channel unavailable: $e');
        }
      }
      final dir = await getApplicationSupportDirectory();
      _dataDir = p.join(dir.path, 'tts_v2');
      await _ensureFfiData();
      debugPrint('[offline-tts] ready at $_dataDir');
    } catch (e) {
      _lastError = '$e';
      debugPrint('[offline-tts] init FAILED: $e');
    }
  }

  /// FFI 回退路径使用的资源复制（仅当 JNI 通道不可用时执行）。
  Future<void> _ensureFfiData() async {
    if (_dataDir != null && await Directory(_dataDir!).exists()) return;
    await _copyAssets();
  }

  /// 把 assets/tts 下所有文件复制到应用支持目录（只复制一次）。
  Future<void> _copyAssets() async {
    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    final files = manifest
        .listAssets()
        .where((a) => a.startsWith('assets/tts/'))
        .toList();
    for (final src in files) {
      final rel = src.substring('assets/tts/'.length);
      final target = p.join(_dataDir!, rel);
      final targetFile = File(target);
      if (await targetFile.exists() &&
          await targetFile.length() ==
              (await rootBundle.load(src)).lengthInBytes) {
        continue;
      }
      final data = await rootBundle.load(src);
      final bytes =
          data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      await targetFile.create(recursive: true);
      await targetFile.writeAsBytes(bytes, flush: true);
    }
  }

  sherpa_onnx.OfflineTts _create(String accent) {
    final base = _dataDir!;
    String model;
    String tokens;
    switch (accent) {
      case 'uk':
        model = 'en_GB-cori-medium.onnx';
        tokens = 'en_GB-cori-medium.tokens.txt';
      case 'us-male':
        model = 'en_US-danny-low.onnx';
        tokens = 'en_US-danny-low.tokens.txt';
      case 'uk-alba':
        model = 'en_GB-alba-medium.onnx';
        tokens = 'en_GB-alba-medium.tokens.txt';
      case 'zh':
        model = 'zh_CN-huayan-medium.onnx';
        tokens = 'zh_CN-huayan-medium.tokens.txt';
      default:
        model = 'en_US-lessac-medium.onnx';
        tokens = 'en_US-lessac-medium.tokens.txt';
    }
    final vits = sherpa_onnx.OfflineTtsVitsModelConfig(
      model: p.join(base, model),
      tokens: p.join(base, tokens),
      dataDir: p.join(base, 'espeak-ng-data'),
    );
    final modelConfig = sherpa_onnx.OfflineTtsModelConfig(
      vits: vits,
      numThreads: 2,
      debug: true,
      provider: 'cpu',
    );
    final config = sherpa_onnx.OfflineTtsConfig(
      model: modelConfig,
      maxNumSenetences: 1,
    );
    final tts = sherpa_onnx.OfflineTts(config);
    debugPrint('[offline-tts] created $accent engine');
    return tts;
  }

  /// 本地合成指定文本，返回生成的 wav 文件；失败返回 null。
  Future<File?> synthesize({
    required String text,
    required String accent,
    required double rate,
  }) async {
    final clean = text.trim();
    if (clean.isEmpty) return null;
    await init();
    if (_androidChannelReady) {
      try {
        final path = await _channel.invokeMethod<String>('synthesize', {
          'text': clean,
          'accent': accent,
          'speed': rate.clamp(0.1, 5.0),
        });
        if (path != null && path.isNotEmpty) {
          final f = File(path);
          if (await f.exists()) {
            debugPrint('[offline-tts] android JNI synthesized $clean -> $path');
            return f;
          }
        }
      } catch (e) {
        debugPrint('[offline-tts] android JNI synthesize FAILED: $e');
      }
    }
    await _ensureFfiData();
    if (_dataDir == null || _lastError != null) return null;
    try {
      final tts = switch (accent) {
        'uk' => _ukTts ??= _create('uk'),
        'us-male' => _usMaleTts ??= _create('us-male'),
        'uk-alba' => _albaTts ??= _create('uk-alba'),
        'zh' => _zhTts ??= _create('zh'),
        _ => _usTts ??= _create('us'),
      };
      final speed = rate.clamp(0.1, 5.0);
      final audio = tts.generate(text: clean, sid: 0, speed: speed);
      if (audio.samples.isEmpty) {
        debugPrint('[offline-tts] empty audio for: $clean');
        return null;
      }
      final dir = Directory(p.join(_dataDir!, 'tts_out'));
      await dir.create(recursive: true);
      _cleanOld(dir);
      final file = File(p.join(
          dir.path,
          'tts_${DateTime.now().microsecondsSinceEpoch}_${accent}_'
          '${clean.hashCode}.wav'));
      final ok = sherpa_onnx.writeWave(
        filename: file.path,
        samples: audio.samples,
        sampleRate: audio.sampleRate,
      );
      debugPrint('[offline-tts] synthesized $clean -> ${file.path} '
          'samples=${audio.samples.length} rate=${audio.sampleRate} ok=$ok');
      return ok ? file : null;
    } catch (e) {
      debugPrint('[offline-tts] synthesize FAILED: $e');
      return null;
    }
  }

  void _cleanOld(Directory dir) {
    try {
      final files = dir.listSync().whereType<File>().toList()
        ..sort((a, b) => b.path.compareTo(a.path));
      while (files.length > 40) {
        final f = files.removeLast();
        try {
          f.deleteSync();
        } catch (_) {}
      }
    } catch (_) {}
  }

  void dispose() {
    try {
      _usTts?.free();
      _ukTts?.free();
      _usMaleTts?.free();
      _albaTts?.free();
      _zhTts?.free();
    } catch (_) {}
    _usTts = null;
    _ukTts = null;
    _usMaleTts = null;
    _albaTts = null;
    _zhTts = null;
  }
}
