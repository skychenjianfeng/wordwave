import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../main.dart';
import '../models.dart';
import '../state.dart';
import '../widgets/cards.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('服务器地址',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: TextEditingController(text: s.serverUrl),
                        decoration: const InputDecoration(
                          isDense: true,
                          border: OutlineInputBorder(),
                          hintText: 'http://192.168.x.x:3101',
                        ),
                        onSubmitted: (v) {
                          s.setServerUrl(v.trim());
                          toast(context, '服务器地址已更新');
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () {
                        s.setServerUrl('http://10.0.2.2:3101');
                        toast(context, '已切换为模拟器地址 10.0.2.2:3101');
                      },
                      child: const Text('模拟器'),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text('真机请填电脑局域网 IP + :3101',
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ],
            ),
          ),
        ),
        const RateControl(),
        const SizedBox(height: 10),
        const AccentControl(),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('例句风格',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                DropdownButtonFormField<ExampleStyle>(
                  value: s.exampleStyle,
                  isExpanded: true,
                  decoration: const InputDecoration(
                      isDense: true, border: OutlineInputBorder()),
                  items: ExampleStyle.values.map((st) {
                    final labels = {
                      ExampleStyle.exam: '考研真题风',
                      ExampleStyle.daily: '日常简单风',
                      ExampleStyle.funny: '搞笑幽默风',
                      ExampleStyle.business: '商务职场风',
                      ExampleStyle.story: '故事叙述风',
                      ExampleStyle.tiktok: 'TikTok 短视频风',
                      ExampleStyle.twitter: '推特发文/评论风',
                    };
                    return DropdownMenuItem(
                        value: st,
                        child:
                            Text(labels[st]!, overflow: TextOverflow.ellipsis));
                  }).toList(),
                  onChanged: (st) {
                    if (st == null) return;
                    s.exampleStyle = st;
                    s.saveSettingsNow();
                    s.refresh();
                  },
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        const Card(
            child: Padding(padding: EdgeInsets.all(12), child: SwitchPanel())),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('词典管理',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                ...s.dicts.map((d) => ListTile(
                      dense: true,
                      title: Text(d.name, overflow: TextOverflow.ellipsis),
                      subtitle: Text('${d.difficulty} · ${d.count} 词',
                          style: const TextStyle(fontSize: 11)),
                      trailing: d.id == s.activeDictId
                          ? const Chip(
                              label: Text('使用中'), padding: EdgeInsets.zero)
                          : TextButton(
                              onPressed: () => s.loadDict(d.id),
                              child: const Text('切换'),
                            ),
                    )),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('账号', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                if (s.user == null)
                  FilledButton.icon(
                    onPressed: () => showAuthDialog(context),
                    icon: const Icon(Icons.login),
                    label: const Text('登录 / 注册'),
                  )
                else ...[
                  Text('当前账号：${s.user!.username}',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Text('学习进度已开启云端同步',
                      style:
                          TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => showPasswordDialog(context),
                    icon: const Icon(Icons.lock_outline, size: 16),
                    label: const Text('修改密码'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await s.logout();
                      if (context.mounted) toast(context, '已退出登录');
                    },
                    child:
                        const Text('退出登录', style: TextStyle(color: Colors.red)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

Future<void> showAuthDialog(BuildContext context) async {
  final s = context.read<AppState>();
  final username = TextEditingController();
  final password = TextEditingController();
  var register = false;
  await showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: Text(register ? '注册账号' : '登录'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: username,
              decoration: const InputDecoration(
                  border: OutlineInputBorder(), labelText: '用户名（2-20 位）'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(
                  border: OutlineInputBorder(), labelText: '密码（6-64 位）'),
            ),
            TextButton(
              onPressed: () => setState(() => register = !register),
              child: Text(register ? '已有账号？去登录' : '没有账号？去注册'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          FilledButton(
            onPressed: () async {
              try {
                if (register) {
                  await s.register(username.text.trim(), password.text);
                } else {
                  await s.login(username.text.trim(), password.text);
                }
                if (ctx.mounted) {
                  Navigator.pop(ctx);
                  toast(context, register ? '注册成功' : '登录成功');
                }
              } catch (e) {
                if (ctx.mounted) toast(context, '$e', error: true);
              }
            },
            child: Text(register ? '注册' : '登录'),
          ),
        ],
      ),
    ),
  );
}

Future<void> showPasswordDialog(BuildContext context) async {
  final s = context.read<AppState>();
  final oldCtrl = TextEditingController();
  final newCtrl = TextEditingController();
  await showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('修改密码'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: oldCtrl,
            obscureText: true,
            decoration: const InputDecoration(
                border: OutlineInputBorder(), labelText: '原密码'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: newCtrl,
            obscureText: true,
            decoration: const InputDecoration(
                border: OutlineInputBorder(), labelText: '新密码（6-64 位）'),
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(
          onPressed: () async {
            try {
              await s.api.changePassword(oldCtrl.text, newCtrl.text);
              if (ctx.mounted) {
                Navigator.pop(ctx);
                toast(context, '密码修改成功');
              }
            } catch (e) {
              if (ctx.mounted) toast(context, '$e', error: true);
            }
          },
          child: const Text('确认修改'),
        ),
      ],
    ),
  );
}
