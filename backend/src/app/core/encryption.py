"""
API密钥加密解密工具
使用Fernet对称加密
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
from app.config import settings


class APIKeyEncryption:
    """API密钥加密工具"""
    
    def __init__(self):
        # 使用SECRET_KEY作为基础生成加密密钥
        self.key = self._generate_key()
        self.fernet = Fernet(self.key)
    
    def _generate_key(self) -> bytes:
        """从SECRET_KEY生成Fernet密钥"""
        # 使用PBKDF2从SECRET_KEY派生密钥
        secret = settings.SECRET_KEY.encode()
        salt = b'blog_platform_salt'  # 固定salt，生产环境应该使用随机salt并存储
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(secret))
        return key
    
    def encrypt(self, api_key: str) -> str:
        """
        加密API密钥
        
        Args:
            api_key: 原始API密钥
            
        Returns:
            加密后的字符串
        """
        if not api_key:
            return ""
        encrypted = self.fernet.encrypt(api_key.encode())
        return encrypted.decode()
    
    def decrypt(self, encrypted_key: str) -> str:
        """
        解密API密钥
        
        Args:
            encrypted_key: 加密的API密钥
            
        Returns:
            原始API密钥
        """
        if not encrypted_key:
            return ""
        try:
            decrypted = self.fernet.decrypt(encrypted_key.encode())
            return decrypted.decode()
        except Exception as e:
            raise ValueError(f"解密失败: {e}")


# 全局加密实例
_encryption = None

def get_encryption() -> APIKeyEncryption:
    """获取加密实例（单例）"""
    global _encryption
    if _encryption is None:
        _encryption = APIKeyEncryption()
    return _encryption
