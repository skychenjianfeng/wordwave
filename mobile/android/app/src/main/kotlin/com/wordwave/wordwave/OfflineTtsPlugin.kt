package com.wordwave.wordwave

import android.content.Context
import android.content.res.AssetManager
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.util.concurrent.Executors

/**
 * 完全离线的本地 TTS（sherpa-onnx JNI + Piper 模型）。
 *
 * 走官方 Android TTS 引擎同一条经过验证的 JNI + asset manager 路径，
 * 绕开 Flutter FFI 版本在 Android 上 espeak-ng 语音解析失败的 bug。
 */
class OfflineTtsPlugin {
    companion object {
        const val CHANNEL = "wordwave/offline_tts"
        private const val ASSET_PREFIX = "flutter_assets/assets/tts"

        private val executor = Executors.newSingleThreadExecutor()
        private var dataDir: String? = null
        private var usTts: OfflineTts? = null
        private var ukTts: OfflineTts? = null
        private var usMaleTts: OfflineTts? = null
        private var albaTts: OfflineTts? = null
        private var zhTts: OfflineTts? = null

        fun register(engine: FlutterEngine, context: Context) {
            MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL)
                .setMethodCallHandler { call, result ->
                    when (call.method) {
                        "probe" -> result.success(true)
                        "synthesize" -> {
                            val text = call.argument<String>("text") ?: ""
                            val accent = call.argument<String>("accent") ?: "us"
                            val speed =
                                (call.argument<Number>("speed")?.toFloat() ?: 1.0f)
                                    .coerceIn(0.1f, 5.0f)
                            executor.execute {
                                try {
                                    val path = synthesize(context, text, accent, speed)
                                    result.success(path)
                                } catch (t: Throwable) {
                                    result.error("tts_error", t.message, null)
                                }
                            }
                        }
                        "dispose" -> {
                            executor.execute {
                                try {
                                    usTts?.free()
                                    ukTts?.free()
                                    usMaleTts?.free()
                                    albaTts?.free()
                                    zhTts?.free()
                                } catch (_: Throwable) {
                                }
                                usTts = null
                                ukTts = null
                                usMaleTts = null
                                albaTts = null
                                zhTts = null
                                result.success(null)
                            }
                        }
                        else -> result.notImplemented()
                    }
                }
        }

        private fun ensureData(context: Context): String {
            dataDir?.let { return it }
            val external = context.getExternalFilesDir(null) ?: context.filesDir
            val dir = File(external, "wordwave_tts")
            // 只有 espeak-ng-data 需要落到真实文件系统；
            // 模型和 tokens 由 asset manager 直接从 APK 资源读取。
            copyAssets(context.assets, ASSET_PREFIX, "espeak-ng-data", dir)
            dataDir = dir.absolutePath
            return dataDir!!
        }

        private fun copyAssets(
            assets: AssetManager,
            prefix: String,
            rel: String,
            dir: File,
        ) {
            val path = if (rel.isEmpty()) prefix else "$prefix/$rel"
            val entries = assets.list(path) ?: return
            if (entries.isEmpty()) {
                val target = File(dir, rel)
                target.parentFile?.mkdirs()
                assets.open(path).use { input ->
                    target.outputStream().use { output -> input.copyTo(output) }
                }
            } else {
                for (name in entries) {
                    copyAssets(assets, prefix, if (rel.isEmpty()) name else "$rel/$name", dir)
                }
            }
        }

        private fun createTts(context: Context, assets: AssetManager, accent: String): OfflineTts {
            val dir = ensureData(context)
            val isUk = accent == "uk"
            val modelName = when (accent) {
                "uk" -> "en_GB-cori-medium.onnx"
                "us-male" -> "en_US-danny-low.onnx"
                "uk-alba" -> "en_GB-alba-medium.onnx"
                "zh" -> "zh_CN-huayan-medium.onnx"
                else -> "en_US-lessac-medium.onnx"
            }
            val tokensName = when (accent) {
                "uk" -> "en_GB-cori-medium.tokens.txt"
                "us-male" -> "en_US-danny-low.tokens.txt"
                "uk-alba" -> "en_GB-alba-medium.tokens.txt"
                "zh" -> "zh_CN-huayan-medium.tokens.txt"
                else -> "en_US-lessac-medium.tokens.txt"
            }
            val vits = OfflineTtsVitsModelConfig(
                // asset-relative 路径，由 asset manager 直接读取
                model = "$ASSET_PREFIX/$modelName",
                tokens = "$ASSET_PREFIX/$tokensName",
                dataDir = File(dir, "espeak-ng-data").absolutePath,
            )
            val modelConfig = OfflineTtsModelConfig(
                vits = vits,
                numThreads = 2,
                debug = false,
                provider = "cpu",
            )
            return OfflineTts(
                assetManager = assets,
                config = OfflineTtsConfig(model = modelConfig, maxNumSentences = 1),
            )
        }

        private fun synthesize(
            context: Context,
            text: String,
            accent: String,
            speed: Float,
        ): String {
            val dir = ensureData(context)
            val assets = context.assets
            // 固定文件名缓存：同一文本+口音+语速永远复用同一个 wav，
            // 避免 Piper/VITS 每次合成带随机噪声导致“同一词每次发音不一样”
            val cacheDir = File(dir, "cache").apply { mkdirs() }
            val key = "${accent}_${speed}_${text}".hashCode()
            val out = File(cacheDir, "synth_${key}.wav")
            if (out.exists() && out.length() > 0) {
                return out.absolutePath
            }
            synchronized(this) {
                if (out.exists() && out.length() > 0) {
                    return out.absolutePath
                }
                val tts = if (accent == "uk") {
                    ukTts ?: createTts(context, assets, "uk").also { ukTts = it }
                } else if (accent == "us-male") {
                    usMaleTts ?: createTts(context, assets, "us-male").also { usMaleTts = it }
                } else if (accent == "uk-alba") {
                    albaTts ?: createTts(context, assets, "uk-alba").also { albaTts = it }
                } else if (accent == "zh") {
                    zhTts ?: createTts(context, assets, "zh").also { zhTts = it }
                } else {
                    usTts ?: createTts(context, assets, "us").also { usTts = it }
                }
                val audio = tts.generateWithConfig(
                    text = text,
                    config = GenerationConfig(sid = 0, speed = speed, silenceScale = 0.2f),
                )
                if (!audio.save(out.absolutePath)) {
                    throw IllegalStateException("Failed to save generated audio")
                }
            }
            return out.absolutePath
        }
    }
}
