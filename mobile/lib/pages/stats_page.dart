import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state.dart';

class StatsPage extends StatelessWidget {
  const StatsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final st = s.localStats();
    final cats = <String, int>{};
    for (final w in s.words) {
      cats[w.category] = (cats[w.category] ?? 0) + 1;
    }
    final catList = cats.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final top = catList.take(6).toList();

    final days = List.generate(30, (i) {
      final d = DateTime.now().subtract(Duration(days: 29 - i));
      return s.dailyWords['${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}']
              ?.length ??
          0;
    });

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _card(context, '已学', st['learned']!, Colors.green),
            _card(context, '掌握', st['mastered']!, Colors.blue),
            _card(context, '错词', st['wrong']!, Colors.red),
            _card(context, '待复习', st['due']!, Colors.amber),
            _card(context, '今日', st['today']!, Colors.purple),
            _card(context, '连续天数', st['streak']!, Colors.orange),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('近 30 天学习量',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                SizedBox(
                  height: 180,
                  child: BarChart(
                    BarChartData(
                      maxY: (days.fold(0, (a, b) => a > b ? a : b) + 1).toDouble(),
                      barTouchData: BarTouchData(
                        touchTooltipData: BarTouchTooltipData(
                          getTooltipItem: (g, _, rod, __) =>
                              BarTooltipItem('${rod.toY.toInt()} 词', const TextStyle(color: Colors.white)),
                        ),
                      ),
                      titlesData: const FlTitlesData(
                        leftTitles: AxisTitles(),
                        topTitles: AxisTitles(),
                        rightTitles: AxisTitles(),
                        bottomTitles: AxisTitles(),
                      ),
                      borderData: FlBorderData(show: false),
                      barGroups: List.generate(
                        days.length,
                        (i) => BarChartGroupData(
                          x: i,
                          barRods: [
                            BarChartRodData(
                              toY: days[i].toDouble(),
                              color: Colors.green,
                              width: 6,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (top.isNotEmpty) ...[
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('分类掌握度雷达图',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 220,
                    child: RadarChart(
                      RadarChartData(
                        radarShape: RadarShape.polygon,
                        dataSets: [
                          RadarDataSet(
                            dataEntries: top
                                .map((e) => RadarEntry(
                                    value: e.value.toDouble().clamp(0, 100)))
                                .toList(),
                            fillColor: Colors.green.withOpacity(0.2),
                            borderColor: Colors.green,
                          ),
                        ],
                        radarBorderData: const BorderSide(color: Colors.grey, width: 1),
                        titleTextStyle: const TextStyle(fontSize: 10),
                        getTitle: (i, _) => RadarChartTitle(text: top[i].key),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _card(BuildContext context, String label, int value, Color color) => Container(
        width: (MediaQuery.of(context).size.width - 32 - 30) / 3,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Column(
          children: [
            Text('$value',
                style: TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w800, color: color)),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      );
}
