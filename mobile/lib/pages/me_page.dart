import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../main.dart';
import '../state.dart';
import 'data_page.dart';
import 'personal_page.dart';
import 'settings_page.dart';

class MePage extends StatelessWidget {
  const MePage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final st = s.localStats();
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.green.shade100,
                  child: Text(
                    (s.user?.username.isNotEmpty == true ? s.user!.username[0] : 'W'),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.user?.username ?? '游客',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 2),
                      Text(s.user == null ? '登录后学习进度可云端同步' : '云端同步已开启',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
                if (s.user == null)
                  FilledButton(
                    onPressed: () => showAuthDialog(context),
                    child: const Text('登录'),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _stat('已学', st['learned']!),
            _stat('掌握', st['mastered']!),
            _stat('错词', st['wrong']!),
            _stat('连续', st['streak']!),
          ],
        ),
        const SizedBox(height: 10),
        _entry(context, Icons.school, '个人学习中心', Colors.green, const PersonalPage()),
        _entry(context, Icons.settings, '设置', Colors.blueGrey, const SettingsPage()),
        _entry(context, Icons.save, '数据管理', Colors.brown, const DataPage()),
        if (s.user != null)
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('退出登录', style: TextStyle(color: Colors.red)),
              onTap: () async {
                await s.logout();
                if (context.mounted) toast(context, '已退出登录');
              },
            ),
          ),
      ],
    );
  }

  Widget _stat(String label, int value) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(
              children: [
                Text('$value',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                Text(label, style: const TextStyle(fontSize: 11)),
              ],
            ),
          ),
        ),
      );

  Widget _entry(BuildContext context, IconData icon, String label, Color color, Widget page) =>
      Card(
        child: ListTile(
          leading: Icon(icon, color: color),
          title: Text(label),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => openFeature(context, label, page),
        ),
      );
}
