import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../main.dart';
import '../state.dart';

class DataPage extends StatelessWidget {
  const DataPage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('💾 导出 / 导入学习数据',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text('学习进度、SM-2 复习记录、错词本与音节笔记全部包含在 JSON 备份中',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: [
                    FilledButton.icon(
                      onPressed: () {
                        final json = s.exportJson();
                        Clipboard.setData(ClipboardData(text: json));
                        toast(context, '备份已复制到剪贴板，请粘贴保存为 .json 文件');
                      },
                      icon: const Icon(Icons.copy),
                      label: const Text('导出（复制 JSON）'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final ctrl = TextEditingController();
                        final text = await showDialog<String>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('导入备份'),
                            content: TextField(
                              controller: ctrl,
                              maxLines: 8,
                              decoration: const InputDecoration(
                                  border: OutlineInputBorder(),
                                  hintText: '粘贴导出的 JSON'),
                            ),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('取消')),
                              FilledButton(
                                  onPressed: () => Navigator.pop(ctx, ctrl.text),
                                  child: const Text('导入')),
                            ],
                          ),
                        );
                        if (text != null && text.isNotEmpty) {
                          if (!context.mounted) return;
                          final ok = s.importJson(text);
                          toast(context, ok ? '导入成功' : '导入失败：格式不正确',
                              error: !ok);
                        }
                      },
                      icon: const Icon(Icons.upload),
                      label: const Text('导入'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.cached, color: Colors.amber),
            title: const Text('清空 AI 例句缓存'),
            subtitle: Text('本地缓存 ${s.exampleCache.length} 条'),
            trailing: TextButton(
              onPressed: () {
                s.clearExampleCache();
                toast(context, '例句缓存已清空');
              },
              child: const Text('清空'),
            ),
          ),
        ),
        Card(
          child: ListTile(
            leading: const Icon(Icons.sync, color: Colors.blue),
            title: const Text('同步学习进度到云端'),
            subtitle: Text(s.token == null ? '未登录（游客模式）' : '登录账号：${s.user?.username}'),
            trailing: FilledButton(
              onPressed: s.token == null
                  ? null
                  : () async {
                      await s.syncProgress();
                      if (context.mounted) toast(context, '同步完成');
                    },
              child: const Text('同步'),
            ),
          ),
        ),
        Card(
          color: Colors.red.withOpacity(0.05),
          child: ListTile(
            leading: const Icon(Icons.delete_forever, color: Colors.red),
            title: const Text('重置全部数据', style: TextStyle(color: Colors.red)),
            subtitle: const Text('清空学习进度、例句缓存与设置（不可恢复）'),
            trailing: TextButton(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('确定重置？'),
                    content: const Text('此操作不可恢复，建议先导出备份。'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('取消')),
                      FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('重置')),
                    ],
                  ),
                );
                if (ok == true) {
                  await s.resetAll();
                  if (context.mounted) toast(context, '已重置全部数据');
                }
              },
              child: const Text('重置', style: TextStyle(color: Colors.red)),
            ),
          ),
        ),
      ],
    );
  }
}
