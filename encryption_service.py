from cryptography.fernet import Fernet
import base64
import json

class EncryptionService:
    def __init__(self, key):
        """Initialize encryption service with key"""
        self.cipher = Fernet(key)
    
    def encrypt_message(self, message):
        """Encrypt a message"""
        if isinstance(message, dict):
            message = json.dumps(message)
        elif not isinstance(message, str):
            message = str(message)
        
        encrypted = self.cipher.encrypt(message.encode('utf-8'))
        return base64.b64encode(encrypted).decode('utf-8')
    
    def decrypt_message(self, encrypted_message):
        """Decrypt a message"""
        try:
            encrypted = base64.b64decode(encrypted_message)
            decrypted = self.cipher.decrypt(encrypted)
            return decrypted.decode('utf-8')
        except Exception as e:
            return None