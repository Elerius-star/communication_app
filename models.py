"""
User Models for Authentication
In-memory user management (replace with database in production)
"""

import bcrypt
import uuid
from datetime import datetime
from typing import Dict, Optional

class UserModel:
    """User model for authentication and session management"""
    
    # In-memory storage (replace with database)
    _users: Dict[str, Dict] = {}
    _sessions: Dict[str, Dict] = {}
    
    @classmethod
    def create_user(cls, username: str, password: str) -> Dict:
        """Create a new user"""
        if username in cls._users:
            raise ValueError("Username already exists")
        
        # Hash password
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        user = {
            'username': username,
            'password': hashed_password,
            'user_id': str(uuid.uuid4()),
            'created_at': datetime.now().isoformat(),
            'last_login': None,
            'is_active': True,
            'rooms': [],
            'socket_id': None
        }
        
        cls._users[username] = user
        return user
    
    @classmethod
    def get_user(cls, username: str) -> Optional[Dict]:
        """Get user by username"""
        return cls._users.get(username)
    
    @classmethod
    def verify_password(cls, username: str, password: str) -> bool:
        """Verify user password"""
        user = cls._users.get(username)
        if not user:
            return False
        
        return bcrypt.checkpw(password.encode('utf-8'), user['password'])
    
    @classmethod
    def update_user(cls, username: str, data: Dict) -> Optional[Dict]:
        """Update user data"""
        if username not in cls._users:
            return None
        
        cls._users[username].update(data)
        return cls._users[username]
    
    @classmethod
    def delete_user(cls, username: str) -> bool:
        """Delete user"""
        if username in cls._users:
            del cls._users[username]
            return True
        return False
    
    @classmethod
    def add_user_to_room(cls, username: str, room_id: str):
        """Add user to a room"""
        user = cls._users.get(username)
        if user and room_id not in user.get('rooms', []):
            user.setdefault('rooms', []).append(room_id)
    
    @classmethod
    def remove_user_from_room(cls, username: str, room_id: str):
        """Remove user from a room"""
        user = cls._users.get(username)
        if user and room_id in user.get('rooms', []):
            user['rooms'].remove(room_id)
    
    @classmethod
    def set_socket_id(cls, username: str, socket_id: str):
        """Set user's socket ID"""
        user = cls._users.get(username)
        if user:
            user['socket_id'] = socket_id
    
    @classmethod
    def get_user_by_socket(cls, socket_id: str) -> Optional[str]:
        """Get username by socket ID"""
        for username, user in cls._users.items():
            if user.get('socket_id') == socket_id:
                return username
        return None
    
    @classmethod
    def get_active_users(cls) -> list:
        """Get list of active users (with socket connection)"""
        return [username for username, user in cls._users.items() 
                if user.get('socket_id')]
    
    @classmethod
    def clear_all(cls):
        """Clear all users (for testing)"""
        cls._users.clear()
        cls._sessions.clear()