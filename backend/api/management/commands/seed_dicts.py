import json
from pathlib import Path

from django.core.management.base import BaseCommand

from api.models import DictMeta, Word


class Command(BaseCommand):
    help = "将 public/data/dicts/*.json 词库导入 MySQL（幂等，可重复执行）"

    def add_arguments(self, parser):
        parser.add_argument("--data-dir", default="public/data/dicts", help="词库 JSON 目录")
        parser.add_argument("--force", action="store_true", help="强制重建全部词库")

    def handle(self, *args, **options):
        data_dir = Path(options["data_dir"])
        if not data_dir.is_absolute():
            data_dir = (Path.cwd() / data_dir).resolve()
        index_file = data_dir / "index.json"
        if not index_file.exists():
            self.stderr.write(f"找不到 {index_file}")
            raise SystemExit(1)

        metas = json.loads(index_file.read_text(encoding="utf-8"))
        total_words = 0
        for sort, meta in enumerate(metas):
            key = meta["id"]
            words_file = data_dir / f"{key}.json"
            if not words_file.exists():
                self.stderr.write(f"缺少词库文件 {words_file}，跳过 {key}")
                continue
            words = json.loads(words_file.read_text(encoding="utf-8"))
            db_meta = DictMeta.objects.filter(key=key).first()
            if db_meta and db_meta.count == len(words) and not options["force"]:
                self.stdout.write(f"[skip] {key}（{len(words)} 词）")
                total_words += len(words)
                continue

            db_meta, _ = DictMeta.objects.update_or_create(
                key=key,
                defaults={
                    "name": meta["name"],
                    "description": meta.get("description", ""),
                    "count": len(words),
                    "difficulty": meta.get("difficulty", ""),
                    "category": meta.get("category", ""),
                    "tags": meta.get("tags", []),
                    "source": meta.get("source", ""),
                    "sort": sort,
                    "enabled": True,
                },
            )
            Word.objects.filter(dict_meta=db_meta).delete()
            rows = [
                Word(
                    dict_meta=db_meta,
                    wid=int(w.get("id", i + 1)),
                    word=str(w.get("word", "")),
                    word_lower=str(w.get("word", "")).lower(),
                    meaning=str(w.get("meaning", "")),
                    alt=w.get("alt"),
                    category=str(w.get("category", "")),
                    subcategory=w.get("subcategory"),
                    freq=int(w.get("freq") or 0),
                    ipa=w.get("ipa"),
                )
                for i, w in enumerate(words)
                if str(w.get("word", "")).strip()
            ]
            for start in range(0, len(rows), 2000):
                Word.objects.bulk_create(rows[start : start + 2000], ignore_conflicts=True)
            total_words += len(rows)
            self.stdout.write(f"[ok] {key}（{len(rows)} 词）")

        self.stdout.write(self.style.SUCCESS(f"词库导入完成：{len(metas)} 个词库，共 {total_words} 词"))
