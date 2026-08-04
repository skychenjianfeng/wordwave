import 'package:flutter/material.dart';

class AiChatPage extends StatelessWidget {
  const AiChatPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.smart_toy_outlined,
                size: 72, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            const Text('AI 聊天对话',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('功能开发中，敬请期待',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
            const SizedBox(height: 24),
            const TextField(
              enabled: false,
              decoration: InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'AI 对话即将上线…',
                suffixIcon: Icon(Icons.send),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
