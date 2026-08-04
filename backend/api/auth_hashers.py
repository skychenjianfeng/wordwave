import hashlib
import base64

from django.contrib.auth.hashers import BasePasswordHasher


class LegacyScryptPasswordHasher(BasePasswordHasher):
    """兼容旧 Express 版（crypto.scryptSync(password, salt, 64) -> salt:hex）的密码哈希。"""

    algorithm = "legacy_scrypt"
    library = ("hashlib", "scrypt")
    iterations = 16384

    def salt(self):
        return ""

    def encode(self, password, salt):
        raise NotImplementedError("legacy_scrypt 仅用于验证旧账号，不做新密码编码")

    def verify(self, password, encoded):
        # 兼容两种形式：legacy_scrypt$<salt>:<hash> 与 <salt>:<hash>
        if encoded.startswith(f"{self.algorithm}$"):
            encoded = encoded.split("$", 1)[1]
        try:
            salt_hex, hash_hex = encoded.split(":", 1)
            try:
                salt = base64.b64decode(salt_hex, validate=True)
                expected = base64.b64decode(hash_hex, validate=True)
            except Exception:
                salt = bytes.fromhex(salt_hex)
                expected = bytes.fromhex(hash_hex)
            if len(expected) != 64:
                return False
            actual = hashlib.scrypt(
                password.encode("utf-8"),
                salt=salt,
                n=self.iterations,
                r=8,
                p=1,
                dklen=64,
            )
            return actual == expected
        except (ValueError, TypeError, base64.binascii.Error):
            return False

    def safe_summary(self, encoded):
        return {"algorithm": self.algorithm}
