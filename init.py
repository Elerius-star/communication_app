"""
Authentication Package
Handles user authentication, JWT tokens, and session management
"""

from .models import UserModel
from .routes import auth_bp

__all__ = ['UserModel', 'auth_bp']