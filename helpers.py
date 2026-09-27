"""
Utility Helper Functions
"""

import re
import uuid
import json
from datetime import datetime
from typing import Dict, Any, Optional
from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_username(username: str) -> bool:
    """Validate username format"""
    pattern = r'^[a-zA-Z0-9_.-]{3,20}$'
    return bool(re.match(pattern, username))

def validate_password(password: str) -> bool:
    """Validate password strength"""
    # At least 6 characters
    if len(password) < 6:
        return False
    # At least one uppercase letter
    if not re.search(r'[A-Z]', password):
        return False
    # At least one lowercase letter
    if not re.search(r'[a-z]', password):
        return False
    # At least one digit
    if not re.search(r'\d', password):
        return False
    return True

def generate_room_id() -> str:
    """Generate a unique room ID"""
    return str(uuid.uuid4())[:8]

def generate_meeting_url(room_id: str) -> str:
    """Generate meeting URL"""
    return f"/meeting/{room_id}"

def parse_timestamp(timestamp: str) -> datetime:
    """Parse ISO timestamp string"""
    try:
        return datetime.fromisoformat(timestamp)
    except ValueError:
        return datetime.now()

def format_time_delta(seconds: int) -> str:
    """Format time delta into human-readable string"""
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if seconds > 0 or not parts:
        parts.append(f"{seconds}s")
    
    return " ".join(parts[:2])  # Return only the two largest units

def format_file_size(bytes: int) -> str:
    """Format file size in human-readable format"""
    if bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while bytes >= 1024 and i < len(size_names) - 1:
        bytes /= 1024
        i += 1
    
    return f"{bytes:.2f} {size_names[i]}"

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS"""
    if not text:
        return ""
    
    # Remove HTML tags
    text = re.sub(r'<[^>]*>', '', text)
    # Remove script tags
    text = re.sub(r'<script.*?>.*?</script>', '', text, flags=re.DOTALL)
    # Remove event handlers
    text = re.sub(r'on\w+="[^"]*"', '', text)
    text = re.sub(r'on\w+=\'[^\']*\'', '', text)
    
    return text.strip()

def is_valid_room_id(room_id: str) -> bool:
    """Check if room ID is valid"""
    return bool(re.match(r'^[a-zA-Z0-9-]{6,12}$', room_id))

def merge_dicts(*dicts: Dict) -> Dict:
    """Merge multiple dictionaries"""
    result = {}
    for d in dicts:
        if d:
            result.update(d)
    return result

def safe_json_parse(data: str) -> Optional[Dict]:
    """Safely parse JSON string"""
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return None

def get_client_ip() -> str:
    """Get client IP address from request"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr or '127.0.0.1'

def get_user_agent() -> str:
    """Get user agent from request"""
    return request.headers.get('User-Agent', 'Unknown')

def require_websocket_auth(f):
    """Decorator to require WebSocket authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.args.get('token')
        if not token:
            return False, "Authentication required"
        try:
            # Verify token (implement your verification logic)
            return f(*args, **kwargs)
        except Exception:
            return False, "Invalid authentication"
    return decorated

def log_activity(logger, action: str, user: str = None, **kwargs):
    """Log user activity"""
    activity = {
        'action': action,
        'user': user or 'anonymous',
        'timestamp': datetime.now().isoformat(),
        'ip': get_client_ip(),
        'user_agent': get_user_agent(),
        **kwargs
    }
    logger.info(json.dumps(activity))
    return activity

class RateLimiter:
    """Simple rate limiter implementation"""
    
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests = {}
    
    def is_allowed(self, key: str) -> bool:
        """Check if request is allowed"""
        now = datetime.now().timestamp()
        
        # Clean old requests
        self._requests[key] = [
            t for t in self._requests.get(key, [])
            if now - t < self.window_seconds
        ]
        
        if len(self._requests.get(key, [])) >= self.max_requests:
            return False
        
        # Add current request
        self._requests.setdefault(key, []).append(now)
        return True
    
    def clear(self, key: str = None):
        """Clear rate limit data"""
        if key:
            self._requests.pop(key, None)
        else:
            self._requests.clear()

# Global rate limiter instance
rate_limiter = RateLimiter()

class CacheManager:
    """Simple in-memory cache manager"""
    
    def __init__(self):
        self._cache = {}
        self._ttl = {}
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """Set cache value with TTL"""
        self._cache[key] = value
        self._ttl[key] = datetime.now().timestamp() + ttl_seconds
    
    def get(self, key: str) -> Optional[Any]:
        """Get cache value if not expired"""
        if key not in self._cache:
            return None
        
        if datetime.now().timestamp() > self._ttl.get(key, 0):
            self.delete(key)
            return None
        
        return self._cache[key]
    
    def delete(self, key: str):
        """Delete cache entry"""
        self._cache.pop(key, None)
        self._ttl.pop(key, None)
    
    def clear(self):
        """Clear all cache"""
        self._cache.clear()
        self._ttl.clear()
    
    def get_or_set(self, key: str, func, ttl_seconds: int = 300):
        """Get from cache or compute and store"""
        value = self.get(key)
        if value is not None:
            return value
        
        value = func()
        self.set(key, value, ttl_seconds)
        return value

# Global cache instance
cache = CacheManager()

class ResponseHelper:
    """Helper for consistent API responses"""
    
    @staticmethod
    def success(data: Any = None, message: str = "Success", status_code: int = 200):
        """Return success response"""
        response = {
            'success': True,
            'message': message
        }
        if data is not None:
            response['data'] = data
        return jsonify(response), status_code
    
    @staticmethod
    def error(message: str = "Error", status_code: int = 400, errors: Any = None):
        """Return error response"""
        response = {
            'success': False,
            'error': message
        }
        if errors is not None:
            response['errors'] = errors
        return jsonify(response), status_code
    
    @staticmethod
    def paginate(items: list, page: int = 1, per_page: int = 20):
        """Paginate items"""
        start = (page - 1) * per_page
        end = start + per_page
        
        return {
            'items': items[start:end],
            'total': len(items),
            'page': page,
            'per_page': per_page,
            'total_pages': (len(items) + per_page - 1) // per_page
        }