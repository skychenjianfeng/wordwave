# sherpa-onnx JNI 通过字段名反射访问配置类，禁止裁剪/混淆
-keep class com.k2fsa.sherpa.onnx.** { *; }
-keepclassmembers class com.k2fsa.sherpa.onnx.** { *; }

# 本地 TTS 插件
-keep class com.wordwave.wordwave.OfflineTtsPlugin { *; }
