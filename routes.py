"""
Authentication Routes
Handles login, registration, and token management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import logging
from datetime import timedelta
from .models import UserModel

logger = logging.getLogger(__name__)

# Create blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        # Validate input
        if not username or not password:
            return jsonify({
                'error': 'Username and password are required'
            }), 400
        
        if len(username) < 3:
            return jsonify({
                'error': 'Username must be at least 3 characters'
            }), 400
        
        if len(password) < 6:
            return jsonify({
                'error': 'Password must be at least 6 characters'
            }), 400
        
        # Check if user exists
        if UserModel.get_user(username):
            return jsonify({
                'error': 'Username already exists'
            }), 409
        
        # Create user
        user = UserModel.create_user(username, password)
        
        # Generate access token
        access_token = create_access_token(
            identity=username,
            expires_delta=timedelta(hours=24)
        )
        
        logger.info(f"User registered: {username}")
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'access_token': access_token,
            'username': username,
            'user_id': user['user_id']
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        # Validate input
        if not username or not password:
            return jsonify({
                'error': 'Username and password are required'
            }), 400
        
        # Check if user exists
        if not UserModel.get_user(username):
            return jsonify({
                'error': 'Invalid username or password'
            }), 401
        
        # Verify password
        if not UserModel.verify_password(username, password):
            return jsonify({
                'error': 'Invalid username or password'
            }), 401
        
        # Update last login
        UserModel.update_user(username, {'last_login': datetime.now().isoformat()})
        
        # Generate access token
        access_token = create_access_token(
            identity=username,
            expires_delta=timedelta(hours=24)
        )
        
        logger.info(f"User logged in: {username}")
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'access_token': access_token,
            'username': username
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """User logout endpoint"""
    try:
        username = get_jwt_identity()
        
        # Clear socket ID
        UserModel.update_user(username, {'socket_id': None})
        
        logger.info(f"User logged out: {username}")
        
        return jsonify({
            'success': True,
            'message': 'Logout successful'
        }), 200
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required()
def refresh():
    """Refresh JWT token"""
    try:
        username = get_jwt_identity()
        
        if not UserModel.get_user(username):
            return jsonify({'error': 'User not found'}), 404
        
        # Generate new token
        access_token = create_access_token(
            identity=username,
            expires_delta=timedelta(hours=24)
        )
        
        return jsonify({
            'success': True,
            'access_token': access_token
        }), 200
        
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return jsonify({'error': 'Token refresh failed'}), 500

@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify():
    """Verify JWT token"""
    try:
        username = get_jwt_identity()
        user = UserModel.get_user(username)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'username': username,
            'user_id': user['user_id'],
            'is_active': user.get('is_active', True)
        }), 200
        
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        return jsonify({'error': 'Token verification failed'}), 500

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get list of all users (admin only in production)"""
    try:
        # In production, check if user is admin
        users = []
        for username, user in UserModel._users.items():
            users.append({
                'username': username,
                'user_id': user['user_id'],
                'created_at': user['created_at'],
                'last_login': user.get('last_login'),
                'is_active': user.get('is_active', True),
                'is_online': user.get('socket_id') is not None
            })
        
        return jsonify({
            'success': True,
            'users': users,
            'count': len(users)
        }), 200
        
    except Exception as e:
        logger.error(f"Get users error: {str(e)}")
        return jsonify({'error': 'Failed to fetch users'}), 500

@auth_bp.route('/users/<username>', methods=['GET'])
@jwt_required()
def get_user(username):
    """Get user details"""
    try:
        user = UserModel.get_user(username)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Don't expose password
        user_data = {
            'username': username,
            'user_id': user['user_id'],
            'created_at': user['created_at'],
            'last_login': user.get('last_login'),
            'is_active': user.get('is_active', True),
            'is_online': user.get('socket_id') is not None
        }
        
        return jsonify({
            'success': True,
            'user': user_data
        }), 200
        
    except Exception as e:
        logger.error(f"Get user error: {str(e)}")
        return jsonify({'error': 'Failed to fetch user'}), 500

@auth_bp.route('/users/<username>', methods=['PUT'])
@jwt_required()
def update_user(username):
    """Update user profile"""
    try:
        current_user = get_jwt_identity()
        
        # Only allow users to update their own profile
        if current_user != username:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        
        # Fields that can be updated
        allowed_fields = ['password']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not update_data:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        # Hash password if updating
        if 'password' in update_data:
            salt = bcrypt.gensalt()
            update_data['password'] = bcrypt.hashpw(
                update_data['password'].encode('utf-8'), 
                salt
            )
        
        user = UserModel.update_user(username, update_data)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        logger.info(f"User updated: {username}")
        
        return jsonify({
            'success': True,
            'message': 'User updated successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Update user error: {str(e)}")
        return jsonify({'error': 'Update failed'}), 500

@auth_bp.route('/users/<username>', methods=['DELETE'])
@jwt_required()
def delete_user(username):
    """Delete user account"""
    try:
        current_user = get_jwt_identity()
        
        # Only allow users to delete their own account
        if current_user != username:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if not UserModel.delete_user(username):
            return jsonify({'error': 'User not found'}), 404
        
        logger.info(f"User deleted: {username}")
        
        return jsonify({
            'success': True,
            'message': 'User deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Delete user error: {str(e)}")
        return jsonify({'error': 'Delete failed'}), 500