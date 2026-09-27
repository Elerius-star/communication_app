from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import bcrypt
import jwt
from datetime import datetime, timedelta
import uuid
import logging
from cryptography.fernet import Fernet
import json
import base64
from services.encryption_service import EncryptionService
from services.webrtc_service import WebRTCService

# ============================================
# NO EVENTLET - Using threading instead
# ============================================

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object('config.Config')

# Initialize extensions
cors = CORS(app, resources={r"/*": {"origins": app.config['CORS_ORIGINS']}})
jwt = JWTManager(app)

# ============================================
# FIX: Use threading async_mode
# ============================================
socketio = SocketIO(
    app, 
    cors_allowed_origins=app.config['CORS_ORIGINS'],
    async_mode='threading',  # Works with Python 3.12+
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25
)

# Initialize services
encryption_service = EncryptionService(app.config['ENCRYPTION_KEY'])
webrtc_service = WebRTCService()

# In-memory storage (replace with database in production)
active_rooms = {}
active_users = {}
whiteboard_data = {}
shared_files = {}

# ===================== AUTHENTICATION ROUTES =====================
@app.route('/api/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        # Check if user exists (in-memory for demo)
        if username in active_users:
            return jsonify({'error': 'Username already exists'}), 409
        
        # Hash password
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Store user (in-memory for demo)
        active_users[username] = {
            'password': hashed,
            'created_at': datetime.now().isoformat(),
            'user_id': str(uuid.uuid4())
        }
        
        # Generate access token
        access_token = create_access_token(
            identity=username,
            expires_delta=timedelta(hours=24)
        )
        
        logger.info(f"User registered: {username}")
        return jsonify({
            'message': 'Registration successful',
            'access_token': access_token,
            'username': username
        }), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        # Check if user exists
        user = active_users.get(username)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
            return jsonify({'error': 'Invalid password'}), 401
        
        # Generate access token
        access_token = create_access_token(
            identity=username,
            expires_delta=timedelta(hours=24)
        )
        
        logger.info(f"User logged in: {username}")
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'username': username
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'active_users': len(active_users),
        'active_rooms': len(active_rooms)
    }), 200

# ===================== WEBSOCKET EVENTS =====================
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    try:
        token = request.args.get('token')
        if not token:
            logger.warning("Connection attempt without token")
            return False
        
        # Verify JWT token
        try:
            decoded = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            username = decoded.get('sub')
            if not username:
                return False
            
            # Store connection info
            if username not in active_users:
                return False
            
            active_users[username]['socket_id'] = request.sid
            
            logger.info(f"User connected: {username}")
            emit('connected', {'message': f'Welcome {username}'})
            return True
            
        except jwt.InvalidTokenError:
            logger.warning("Invalid token")
            return False
            
    except Exception as e:
        logger.error(f"Connection error: {str(e)}")
        return False

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    try:
        # Find user by socket id
        for username, data in active_users.items():
            if data.get('socket_id') == request.sid:
                # Remove from rooms
                for room_id in list(data.get('rooms', [])):
                    leave_room(room_id)
                    webrtc_service.remove_user_from_room(room_id, username)
                    emit('user_left', {'username': username}, room=room_id)
                
                active_users[username]['socket_id'] = None
                logger.info(f"User disconnected: {username}")
                break
                
    except Exception as e:
        logger.error(f"Disconnect error: {str(e)}")

@socketio.on('create_room')
def handle_create_room(data):
    """Create a new room"""
    try:
        room_id = data.get('room_id') or str(uuid.uuid4())[:8]
        username = data.get('username')
        room_name = data.get('room_name', f'Room {room_id}')
        password = data.get('password')
        
        if room_id in active_rooms:
            emit('room_error', {'error': 'Room already exists'})
            return
        
        # Create room
        active_rooms[room_id] = {
            'id': room_id,
            'name': room_name,
            'password': password,
            'participants': [],
            'created_by': username,
            'created_at': datetime.now().isoformat(),
            'whiteboard': {
                'lines': [],
                'texts': [],
                'shapes': []
            },
            'files': []
        }
        
        # Add user to room
        join_room(room_id)
        active_rooms[room_id]['participants'].append(username)
        active_users[username].setdefault('rooms', []).append(room_id)
        
        emit('room_created', {
            'room_id': room_id,
            'room_name': room_name,
            'participants': [username]
        })
        
        logger.info(f"Room created: {room_id} by {username}")
        
    except Exception as e:
        logger.error(f"Create room error: {str(e)}")
        emit('room_error', {'error': 'Failed to create room'})

@socketio.on('join_room')
def handle_join_room(data):
    """Join an existing room"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        password = data.get('password')
        
        if room_id not in active_rooms:
            emit('room_error', {'error': 'Room not found'})
            return
        
        room = active_rooms[room_id]
        
        # Check password if required
        if room.get('password') and room['password'] != password:
            emit('room_error', {'error': 'Invalid room password'})
            return
        
        # Add user to room
        join_room(room_id)
        room['participants'].append(username)
        active_users[username].setdefault('rooms', []).append(room_id)
        
        # Notify others in room
        emit('user_joined', {'username': username, 'participants': room['participants']}, room=room_id)
        
        # Send current whiteboard state
        emit('whiteboard_state', room['whiteboard'], room=room_id)
        
        # Send file list
        emit('file_list', room['files'], room=room_id)
        
        # Send participant list to the joining user
        emit('participant_list', {'participants': room['participants']})
        
        logger.info(f"User {username} joined room {room_id}")
        
    except Exception as e:
        logger.error(f"Join room error: {str(e)}")
        emit('room_error', {'error': 'Failed to join room'})

@socketio.on('leave_room')
def handle_leave_room(data):
    """Leave a room"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        
        if room_id in active_rooms:
            room = active_rooms[room_id]
            if username in room['participants']:
                room['participants'].remove(username)
                
                # Remove from user's rooms
                if username in active_users and 'rooms' in active_users[username]:
                    active_users[username]['rooms'].remove(room_id)
                
                leave_room(room_id)
                
                emit('user_left', {'username': username, 'participants': room['participants']}, room=room_id)
                
                # Remove empty rooms
                if len(room['participants']) == 0:
                    del active_rooms[room_id]
                    logger.info(f"Room {room_id} deleted (empty)")
                
        logger.info(f"User {username} left room {room_id}")
        
    except Exception as e:
        logger.error(f"Leave room error: {str(e)}")

# ===================== WEBRTC SIGNALING =====================
@socketio.on('offer')
def handle_offer(data):
    """Handle WebRTC offer"""
    try:
        room_id = data.get('room_id')
        target = data.get('target')
        offer = data.get('offer')
        username = data.get('username')
        
        # Encrypt SDP offer
        encrypted_offer = encryption_service.encrypt_message(offer)
        
        # Send to target user
        emit('offer', {
            'from': username,
            'offer': encrypted_offer,
            'room_id': room_id
        }, room=target)
        
        logger.info(f"Offer from {username} to {target}")
        
    except Exception as e:
        logger.error(f"Offer error: {str(e)}")

@socketio.on('answer')
def handle_answer(data):
    """Handle WebRTC answer"""
    try:
        target = data.get('target')
        answer = data.get('answer')
        username = data.get('username')
        
        # Encrypt SDP answer
        encrypted_answer = encryption_service.encrypt_message(answer)
        
        emit('answer', {
            'from': username,
            'answer': encrypted_answer
        }, room=target)
        
        logger.info(f"Answer from {username} to {target}")
        
    except Exception as e:
        logger.error(f"Answer error: {str(e)}")

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    """Handle ICE candidates"""
    try:
        target = data.get('target')
        candidate = data.get('candidate')
        username = data.get('username')
        
        # Encrypt ICE candidate
        encrypted_candidate = encryption_service.encrypt_message(candidate)
        
        emit('ice_candidate', {
            'from': username,
            'candidate': encrypted_candidate
        }, room=target)
        
    except Exception as e:
        logger.error(f"ICE candidate error: {str(e)}")

# ===================== SCREEN SHARING =====================
@socketio.on('screen_share_start')
def handle_screen_share_start(data):
    """Start screen sharing"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        
        emit('screen_share_started', {
            'username': username,
            'status': 'sharing'
        }, room=room_id)
        
        logger.info(f"Screen sharing started by {username}")
        
    except Exception as e:
        logger.error(f"Screen share start error: {str(e)}")

@socketio.on('screen_share_stop')
def handle_screen_share_stop(data):
    """Stop screen sharing"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        
        emit('screen_share_stopped', {
            'username': username,
            'status': 'stopped'
        }, room=room_id)
        
        logger.info(f"Screen sharing stopped by {username}")
        
    except Exception as e:
        logger.error(f"Screen share stop error: {str(e)}")

# ===================== FILE SHARING =====================
@socketio.on('file_share')
def handle_file_share(data):
    """Handle file sharing"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        file_data = data.get('file_data')
        file_name = data.get('file_name')
        file_size = data.get('file_size')
        file_type = data.get('file_type')
        
        # Encrypt file data
        encrypted_file = encryption_service.encrypt_message(file_data)
        
        # Store file info
        file_id = str(uuid.uuid4())
        file_info = {
            'id': file_id,
            'name': file_name,
            'size': file_size,
            'type': file_type,
            'sender': username,
            'timestamp': datetime.now().isoformat(),
            'data': encrypted_file
        }
        
        if room_id in active_rooms:
            active_rooms[room_id]['files'].append(file_info)
        
        # Broadcast to all in room (excluding sender)
        emit('file_received', {
            'file_id': file_id,
            'name': file_name,
            'size': file_size,
            'type': file_type,
            'sender': username
        }, room=room_id, skip_sid=request.sid)
        
        logger.info(f"File {file_name} shared by {username} in room {room_id}")
        
    except Exception as e:
        logger.error(f"File share error: {str(e)}")

@socketio.on('file_request')
def handle_file_request(data):
    """Request file download"""
    try:
        file_id = data.get('file_id')
        room_id = data.get('room_id')
        username = data.get('username')
        
        # Find file
        if room_id in active_rooms:
            for file in active_rooms[room_id]['files']:
                if file['id'] == file_id:
                    # Send file data
                    emit('file_data', {
                        'file_id': file_id,
                        'data': file['data']
                    }, room=request.sid)
                    break
        
    except Exception as e:
        logger.error(f"File request error: {str(e)}")

# ===================== WHITEBOARD =====================
@socketio.on('whiteboard_draw')
def handle_whiteboard_draw(data):
    """Handle whiteboard drawing"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        action = data.get('action')
        draw_data = data.get('data')
        
        # Store in room state
        if room_id in active_rooms:
            room = active_rooms[room_id]
            room['whiteboard']['lines'].append({
                'user': username,
                'data': draw_data,
                'timestamp': datetime.now().isoformat()
            })
            
            # Keep only last 1000 actions to prevent memory issues
            if len(room['whiteboard']['lines']) > 1000:
                room['whiteboard']['lines'] = room['whiteboard']['lines'][-1000:]
        
        # Broadcast to all others in room
        emit('whiteboard_draw', {
            'user': username,
            'action': action,
            'data': draw_data
        }, room=room_id, skip_sid=request.sid)
        
    except Exception as e:
        logger.error(f"Whiteboard draw error: {str(e)}")

@socketio.on('whiteboard_clear')
def handle_whiteboard_clear(data):
    """Clear whiteboard"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        
        # Clear in room state
        if room_id in active_rooms:
            active_rooms[room_id]['whiteboard']['lines'] = []
            active_rooms[room_id]['whiteboard']['texts'] = []
            active_rooms[room_id]['whiteboard']['shapes'] = []
        
        # Broadcast to all in room
        emit('whiteboard_cleared', {
            'user': username,
            'message': 'Whiteboard cleared'
        }, room=room_id)
        
    except Exception as e:
        logger.error(f"Whiteboard clear error: {str(e)}")

# ===================== CHAT =====================
@socketio.on('chat_message')
def handle_chat_message(data):
    """Handle chat messages"""
    try:
        room_id = data.get('room_id')
        username = data.get('username')
        message = data.get('message')
        
        emit('chat_message', {
            'username': username,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }, room=room_id)
        
    except Exception as e:
        logger.error(f"Chat message error: {str(e)}")

# ===================== ERROR HANDLING =====================
@socketio.on_error()
def handle_socket_error(e):
    """Global socket error handler"""
    logger.error(f"Socket error: {str(e)}")
    emit('error', {'message': 'An error occurred'})

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# ===================== MAIN =====================
if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("🚀 Starting Video Conferencing Backend Server...")
    logger.info("=" * 60)
    logger.info(f"📍 Server will run on: http://localhost:5000")
    logger.info(f"📍 WebSocket will run on: ws://localhost:5000")
    logger.info("=" * 60)
    
    # Use threading as the server (compatible with Python 3.12+)
    socketio.run(
        app, 
        debug=True, 
        host='0.0.0.0', 
        port=5000,
        use_reloader=True,
        log_output=True
    )   