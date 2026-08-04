import json
import base64
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from api.models import ProgressBlob, UserProfile


class Command(BaseCommand):
    help = "从旧 Express 版 server/data 目录导入用户与学习进度（密码哈希兼容登录）"

    def add_arguments(self, parser):
        parser.add_argument("--legacy-dir", default="../server/data", help="旧数据目录")

    def handle(self, *args, **options):
        legacy = Path(options["legacy_dir"])
        if not legacy.is_absolute():
            legacy = (Path.cwd() / legacy).resolve()
        users_file = legacy / "users.json"
        if not users_file.exists():
            self.stderr.write(f"未找到 {users_file}，跳过迁移")
            return
        users = json.loads(users_file.read_text(encoding="utf-8"))
        imported = 0
        for uid, u in users.items():
            username = u.get("username")
            if not username:
                continue
            user = User.objects.filter(username__iexact=username).first()
            if not user:
                user = User(username=username)
                if u.get("createdAt"):
                    user.date_joined = u["createdAt"]
                # legacy_scrypt$base64(salt):base64(hash)，压缩至 128 字符内，供 LegacyScryptPasswordHasher 验证
                legacy_hash = u.get("passwordHash", "")
                try:
                    salt_hex, hash_hex = legacy_hash.split(":", 1)
                    compact = (
                        base64.b64encode(bytes.fromhex(salt_hex)).decode()
                        + ":"
                        + base64.b64encode(bytes.fromhex(hash_hex)).decode()
                    )
                except Exception:
                    compact = legacy_hash
                user.password = f"legacy_scrypt${compact}"
                user.save()
            UserProfile.objects.get_or_create(user=user, defaults={"nickname": username})
            progress_file = legacy / "progress" / f"{uid}.json"
            if progress_file.exists():
                try:
                    payload = json.loads(progress_file.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    payload = {}
                blob, _ = ProgressBlob.objects.get_or_create(user=user)
                blob.payload = payload
                blob.save()
            imported += 1
        self.stdout.write(self.style.SUCCESS(f"旧数据迁移完成：{imported} 个用户"))
