// =====================================================
// COLLABMEET - Main Application
// =====================================================

class CollabMeet {
    constructor() {
        // Configuration
        this.SERVER_URL = 'http://localhost:5000';
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.isAuthenticated = false;
        this.audioEnabled = true;
        this.videoEnabled = true;
        
        // DOM Elements
        this.elements = {};
        this.cacheElements();
        
        // Initialize
        this.init();
    }
    
    cacheElements() {
        // Auth
        this.elements.authModal = document.getElementById('authModal');
        this.elements.authForm = document.getElementById('authForm');
        this.elements.authUsername = document.getElementById('authUsername');
        this.elements.authPassword = document.getElementById('authPassword');
        this.elements.authSubmitBtn = document.getElementById('authSubmitBtn');
        this.elements.authBtnText = document.getElementById('authBtnText');
        this.elements.authLoadingIcon = document.getElementById('authLoadingIcon');
        this.elements.authError = document.getElementById('authError');
        this.elements.authErrorMessage = document.getElementById('authErrorMessage');
        this.elements.authToggleBtn = document.getElementById('authToggleBtn');
        this.elements.authToggleText = document.getElementById('authToggleText');
        this.elements.authTitle = document.getElementById('authTitle');
        this.elements.authSubtitle = document.getElementById('authSubtitle');
        this.elements.togglePassword = document.getElementById('togglePassword');
        
        // App
        this.elements.app = document.getElementById('app');
        this.elements.navUsername = document.getElementById('navUsername');
        this.elements.welcomeUsername = document.getElementById('welcomeUsername');
        this.elements.logoutBtn = document.getElementById('logoutBtn');
        
        // Views
        this.elements.dashboardView = document.getElementById('dashboardView');
        this.elements.meetingView = document.getElementById('meetingView');
        
        // Dashboard
        this.elements.createMeetingBtn = document.getElementById('createMeetingBtn');
        this.elements.activeMeetingsList = document.getElementById('activeMeetingsList');
        this.elements.activeCount = document.getElementById('activeCount');
        this.elements.recentActivity = document.getElementById('recentActivity');
        this.elements.audioToggle = document.getElementById('audioToggle');
        this.elements.videoToggle = document.getElementById('videoToggle');
        
        // Meeting Room
        this.elements.videoGrid = document.getElementById('videoGrid');
        this.elements.localVideo = document.getElementById('localVideo');
        this.elements.toggleAudio = document.getElementById('toggleAudio');
        this.elements.toggleVideo = document.getElementById('toggleVideo');
        this.elements.toggleScreenShare = document.getElementById('toggleScreenShare');
        this.elements.toggleWhiteboard = document.getElementById('toggleWhiteboard');
        this.elements.shareFileBtn = document.getElementById('shareFileBtn');
        this.elements.endMeetingBtn = document.getElementById('endMeetingBtn');
        
        // Whiteboard
        this.elements.whiteboardModal = document.getElementById('whiteboardModal');
        this.elements.whiteboardCanvas = document.getElementById('whiteboardCanvas');
        this.elements.closeWhiteboard = document.getElementById('closeWhiteboard');
        this.elements.clearWhiteboard = document.getElementById('clearWhiteboard');
        this.elements.drawColor = document.getElementById('drawColor');
        this.elements.drawSize = document.getElementById('drawSize');
        this.elements.toolBtns = document.querySelectorAll('.tool-btn');
        
        // File Share
        this.elements.fileShareModal = document.getElementById('fileShareModal');
        this.elements.closeFileShare = document.getElementById('closeFileShare');
        this.elements.dropZone = document.getElementById('dropZone');
        this.elements.fileInput = document.getElementById('fileInput');
        this.elements.fileList = document.getElementById('fileList');
        this.elements.sendFilesBtn = document.getElementById('sendFilesBtn');
        
        // Chat
        this.elements.chatSidebar = document.getElementById('chatSidebar');
        this.elements.chatMessages = document.getElementById('chatMessages');
        this.elements.chatInput = document.getElementById('chatInput');
        this.elements.sendChatBtn = document.getElementById('sendChatBtn');
        this.elements.toggleChat = document.getElementById('toggleChat');
    }
    
    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupWebRTC();
        this.setupWhiteboard();
        this.setupFileShare();
    }
    
    // ========== AUTHENTICATION ==========
    setupEventListeners() {
        // Auth form submission
        this.elements.authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });
        
        // Toggle auth mode (login/register)
        this.elements.authToggleBtn.addEventListener('click', () => {
            this.toggleAuthMode();
        });
        
        // Toggle password visibility
        this.elements.togglePassword.addEventListener('click', () => {
            const input = this.elements.authPassword;
            const icon = this.elements.togglePassword.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });
        
        // Logout
        this.elements.logoutBtn.addEventListener('click', () => {
            this.logout();
        });
        
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const viewName = tab.dataset.tab;
                this.switchView(viewName);
            });
        });
        
        // Create meeting
        this.elements.createMeetingBtn.addEventListener('click', () => {
            this.showCreateMeetingModal();
        });
        
        // Meeting controls
        this.elements.toggleAudio.addEventListener('click', () => {
            this.toggleAudio();
        });
        
        this.elements.toggleVideo.addEventListener('click', () => {
            this.toggleVideo();
        });
        
        this.elements.toggleScreenShare.addEventListener('click', () => {
            this.toggleScreenShare();
        });
        
        this.elements.toggleWhiteboard.addEventListener('click', () => {
            this.toggleWhiteboardModal();
        });
        
        this.elements.shareFileBtn.addEventListener('click', () => {
            this.toggleFileShareModal();
        });
        
        this.elements.endMeetingBtn.addEventListener('click', () => {
            this.endMeeting();
        });
        
        // Chat
        this.elements.sendChatBtn.addEventListener('click', () => {
            this.sendChatMessage();
        });
        
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        this.elements.toggleChat.addEventListener('click', () => {
            this.elements.chatSidebar.classList.toggle('open');
        });
        
        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) modal.classList.add('hidden');
            });
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
        
        // Toggle switches
        this.elements.audioToggle.addEventListener('change', (e) => {
            this.audioEnabled = e.target.checked;
            this.updateLocalAudio();
        });
        
        this.elements.videoToggle.addEventListener('change', (e) => {
            this.videoEnabled = e.target.checked;
            this.updateLocalVideo();
        });
    }
    
    checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        const username = localStorage.getItem('username');
        
        if (token && username) {
            this.currentUser = username;
            this.isAuthenticated = true;
            this.elements.authModal.classList.add('hidden');
            this.elements.app.classList.remove('hidden');
            this.updateUI();
            this.connectSocket(token);
        } else {
            this.elements.authModal.classList.remove('hidden');
            this.elements.app.classList.add('hidden');
        }
    }
    
    async handleAuth() {
        const username = this.elements.authUsername.value.trim();
        const password = this.elements.authPassword.value.trim();
        const isLogin = this.elements.authSubmitBtn.dataset.mode === 'login';
        
        if (!username || !password) {
            this.showAuthError('Please fill in all fields');
            return;
        }
        
        this.setAuthLoading(true);
        this.hideAuthError();
        
        try {
            const endpoint = isLogin ? '/api/login' : '/api/register';
            const response = await fetch(`${this.SERVER_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('authToken', data.access_token);
                localStorage.setItem('username', data.username);
                this.currentUser = data.username;
                this.isAuthenticated = true;
                
                this.elements.authModal.classList.add('hidden');
                this.elements.app.classList.remove('hidden');
                this.updateUI();
                this.connectSocket(data.access_token);
                
                this.showToast('success', 'Welcome!', `Hello, ${data.username}!`);
            } else {
                this.showAuthError(data.error || 'Authentication failed');
            }
        } catch (error) {
            this.showAuthError('Connection error. Please try again.');
            console.error('Auth error:', error);
        } finally {
            this.setAuthLoading(false);
        }
    }
    
    toggleAuthMode() {
        const isLogin = this.elements.authSubmitBtn.dataset.mode === 'login';
        
        if (isLogin) {
            // Switch to Register
            this.elements.authSubmitBtn.dataset.mode = 'register';
            this.elements.authTitle.textContent = 'Create Account';
            this.elements.authSubtitle.textContent = 'Join CollabMeet today';
            this.elements.authBtnText.textContent = 'Sign Up';
            this.elements.authToggleText.textContent = 'Already have an account?';
            this.elements.authToggleBtn.textContent = 'Sign In';
        } else {
            // Switch to Login
            this.elements.authSubmitBtn.dataset.mode = 'login';
            this.elements.authTitle.textContent = 'Welcome to CollabMeet';
            this.elements.authSubtitle.textContent = 'Sign in to start collaborating';
            this.elements.authBtnText.textContent = 'Sign In';
            this.elements.authToggleText.textContent = "Don't have an account?";
            this.elements.authToggleBtn.textContent = 'Sign Up';
        }
        
        this.hideAuthError();
    }
    
    showAuthError(message) {
        this.elements.authError.classList.remove('hidden');
        this.elements.authErrorMessage.textContent = message;
    }
    
    hideAuthError() {
        this.elements.authError.classList.add('hidden');
    }
    
    setAuthLoading(loading) {
        if (loading) {
            this.elements.authSubmitBtn.disabled = true;
            this.elements.authBtnText.textContent = 'Please wait...';
            this.elements.authLoadingIcon.classList.remove('hidden');
        } else {
            this.elements.authSubmitBtn.disabled = false;
            this.elements.authBtnText.textContent = this.elements.authSubmitBtn.dataset.mode === 'login' ? 'Sign In' : 'Sign Up';
            this.elements.authLoadingIcon.classList.add('hidden');
        }
    }
    
    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        this.currentUser = null;
        this.isAuthenticated = false;
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.elements.app.classList.add('hidden');
        this.elements.authModal.classList.remove('hidden');
        this.elements.authForm.reset();
        this.switchView('dashboard');
        
        this.showToast('info', 'Logged Out', 'See you next time!');
    }
    
    // ========== SOCKET.IO CONNECTION ==========
    connectSocket(token) {
        this.socket = io(this.SERVER_URL, {
            query: { token },
            transports: ['websocket', 'polling']
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.showToast('success', 'Connected', 'You are now online');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showToast('error', 'Disconnected', 'Lost connection to server');
        });
        
        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
            this.showToast('error', 'Error', data.message || 'An error occurred');
        });
        
        // Room events
        this.socket.on('room_created', (data) => {
            this.currentRoom = data.room_id;
            this.switchView('meeting');
            this.showToast('success', 'Room Created', `Room: ${data.room_name}`);
        });
        
        this.socket.on('user_joined', (data) => {
            this.addParticipant(data.username);
            this.showToast('info', 'User Joined', `${data.username} joined the meeting`);
        });
        
        this.socket.on('user_left', (data) => {
            this.removeParticipant(data.username);
            this.showToast('info', 'User Left', `${data.username} left the meeting`);
        });
        
        this.socket.on('participant_list', (data) => {
            this.updateParticipants(data.participants);
        });
        
        // WebRTC events
        this.socket.on('offer', (data) => {
            this.handleRemoteOffer(data);
        });
        
        this.socket.on('answer', (data) => {
            this.handleRemoteAnswer(data);
        });
        
        this.socket.on('ice_candidate', (data) => {
            this.handleRemoteIceCandidate(data);
        });
        
        // Screen sharing events
        this.socket.on('screen_share_started', (data) => {
            this.showToast('info', 'Screen Sharing', `${data.username} started sharing their screen`);
        });
        
        this.socket.on('screen_share_stopped', (data) => {
            this.showToast('info', 'Screen Sharing', `${data.username} stopped sharing their screen`);
        });
        
        // File sharing events
        this.socket.on('file_received', (data) => {
            this.showToast('info', 'File Received', `${data.sender} shared: ${data.name}`);
            this.addFileToList(data);
        });
        
        // Whiteboard events
        this.socket.on('whiteboard_draw', (data) => {
            this.drawOnWhiteboard(data);
        });
        
        this.socket.on('whiteboard_cleared', (data) => {
            this.clearWhiteboardRemote();
        });
        
        this.socket.on('whiteboard_state', (data) => {
            this.loadWhiteboardState(data);
        });
        
        // Chat events
        this.socket.on('chat_message', (data) => {
            this.displayChatMessage(data);
        });
    }
    
    // ========== UI UPDATES ==========
    updateUI() {
        if (this.currentUser) {
            this.elements.navUsername.textContent = this.currentUser;
            this.elements.welcomeUsername.textContent = this.currentUser;
        }
    }
    
    switchView(view) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // Show selected view
        if (view === 'dashboard') {
            this.elements.dashboardView.classList.add('active');
        } else if (view === 'meeting') {
            this.elements.meetingView.classList.add('active');
        }
    }
    
    // ========== MEETING MANAGEMENT ==========
    showCreateMeetingModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'createMeetingModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle" style="color: var(--primary-orange);"></i> Create New Meeting</h3>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="createMeetingForm" class="create-meeting-form">
                    <div class="form-group">
                        <label for="meetingName">Meeting Name</label>
                        <input type="text" id="meetingName" placeholder="My Meeting" value="Meeting ${new Date().toLocaleString()}" />
                    </div>
                    <div class="form-group">
                        <label for="meetingPassword">Password (optional)</label>
                        <input type="password" id="meetingPassword" placeholder="Set a password" />
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">
                        <i class="fas fa-video"></i> Start Meeting
                    </button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#createMeetingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('meetingName').value.trim() || 'My Meeting';
            const password = document.getElementById('meetingPassword').value;
            
            this.createRoom(name, password);
            modal.remove();
        });
    }
    
    createRoom(roomName, password) {
        if (!this.socket) {
            this.showToast('error', 'Error', 'Not connected to server');
            return;
        }
        
        this.socket.emit('create_room', {
            room_id: null,
            username: this.currentUser,
            room_name: roomName,
            password: password
        });
    }
    
    joinRoom(roomId, password) {
        if (!this.socket) {
            this.showToast('error', 'Error', 'Not connected to server');
            return;
        }
        
        this.socket.emit('join_room', {
            room_id: roomId,
            username: this.currentUser,
            password: password || ''
        });
    }
    
    endMeeting() {
        if (this.currentRoom) {
            this.socket.emit('leave_room', {
                room_id: this.currentRoom,
                username: this.currentUser
            });
        }
        
        this.currentRoom = null;
        this.switchView('dashboard');
        this.clearVideoGrid();
        this.showToast('info', 'Meeting Ended', 'You have left the meeting');
    }
    
    // ========== VIDEO & AUDIO ==========
    setupWebRTC() {
        // This will be implemented in webrtc.js
        window.webrtc = new WebRTCManager(this);
    }
    
    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        this.updateLocalAudio();
        const btn = this.elements.toggleAudio;
        btn.classList.toggle('muted');
        btn.querySelector('i').className = this.audioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
        this.elements.audioToggle.checked = this.audioEnabled;
    }
    
    toggleVideo() {
        this.videoEnabled = !this.videoEnabled;
        this.updateLocalVideo();
        const btn = this.elements.toggleVideo;
        btn.classList.toggle('muted');
        btn.querySelector('i').className = this.videoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
        this.elements.videoToggle.checked = this.videoEnabled;
    }
    
    updateLocalAudio() {
        // Implement in webrtc.js
        if (window.webrtc) {
            window.webrtc.setAudioEnabled(this.audioEnabled);
        }
    }
    
    updateLocalVideo() {
        // Implement in webrtc.js
        if (window.webrtc) {
            window.webrtc.setVideoEnabled(this.videoEnabled);
        }
    }
    
    toggleScreenShare() {
        // Implement in webrtc.js
        if (window.webrtc) {
            window.webrtc.toggleScreenShare();
        }
    }
    
    addParticipant(username) {
        // Implement in webrtc.js
        if (window.webrtc) {
            window.webrtc.addRemoteVideo(username);
        }
    }
    
    removeParticipant(username) {
        // Implement in webrtc.js
        if (window.webrtc) {
            window.webrtc.removeRemoteVideo(username);
        }
    }
    
    updateParticipants(participants) {
        const list = this.elements.activeMeetingsList;
        list.innerHTML = '';
        
        if (!participants || participants.length === 0) {
            list.innerHTML = '<p class="empty-state">No participants</p>';
            return;
        }
        
        participants.forEach(username => {
            const item = document.createElement('div');
            item.className = 'meeting-item';
            item.innerHTML = `
                <div class="meeting-info">
                    <span class="meeting-name">
                        <span class="status-dot ${username === this.currentUser ? 'online' : 'offline'}"></span>
                        ${username} ${username === this.currentUser ? '(You)' : ''}
                    </span>
                </div>
            `;
            list.appendChild(item);
        });
    }
    
    clearVideoGrid() {
        const grid = this.elements.videoGrid;
        grid.innerHTML = '';
        // Re-add local video
        const localContainer = document.createElement('div');
        localContainer.className = 'video-container local-video';
        localContainer.id = 'localVideoContainer';
        localContainer.innerHTML = `
            <video id="localVideo" autoplay muted playsinline></video>
            <div class="video-label">
                <span>You</span>
                <div class="video-status">
                    <i class="fas fa-circle online"></i>
                </div>
            </div>
        `;
        grid.appendChild(localContainer);
        this.elements.localVideo = localContainer.querySelector('video');
    }
    
    // ========== WHITEBOARD ==========
    setupWhiteboard() {
        // This will be implemented in whiteboard.js
        window.whiteboard = new WhiteboardManager(this);
    }
    
    toggleWhiteboardModal() {
        this.elements.whiteboardModal.classList.toggle('hidden');
        if (!this.elements.whiteboardModal.classList.contains('hidden')) {
            // Resize canvas
            setTimeout(() => {
                if (window.whiteboard) {
                    window.whiteboard.resizeCanvas();
                }
            }, 100);
        }
    }
    
    drawOnWhiteboard(data) {
        if (window.whiteboard) {
            window.whiteboard.drawRemote(data);
        }
    }
    
    clearWhiteboardRemote() {
        if (window.whiteboard) {
            window.whiteboard.clearRemote();
        }
    }
    
    loadWhiteboardState(data) {
        if (window.whiteboard) {
            window.whiteboard.loadState(data);
        }
    }
    
    // ========== FILE SHARING ==========
    setupFileShare() {
        // This will be implemented in fileShare.js
        window.fileManager = new FileManager(this);
    }
    
    toggleFileShareModal() {
        this.elements.fileShareModal.classList.toggle('hidden');
    }
    
    addFileToList(data) {
        const list = this.elements.fileList;
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span class="file-name"><i class="fas fa-file"></i> ${data.name}</span>
            <span class="file-size">${this.formatFileSize(data.size)}</span>
        `;
        list.appendChild(item);
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // ========== CHAT ==========
    sendChatMessage() {
        const input = this.elements.chatInput;
        const message = input.value.trim();
        
        if (!message || !this.currentRoom) return;
        
        this.socket.emit('chat_message', {
            room_id: this.currentRoom,
            username: this.currentUser,
            message: message
        });
        
        this.displayChatMessage({
            username: this.currentUser,
            message: message,
            isOwn: true
        });
        
        input.value = '';
    }
    
    displayChatMessage(data) {
        const container = this.elements.chatMessages;
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${data.isOwn || data.username === this.currentUser ? 'own' : 'other'}`;
        
        if (data.username && data.username !== this.currentUser) {
            messageDiv.innerHTML = `
                <div class="msg-sender">${data.username}</div>
                ${data.message}
            `;
        } else {
            messageDiv.textContent = data.message;
        }
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }
    
    // ========== TOAST NOTIFICATIONS ==========
    showToast(type, title, message) {
        const container = document.querySelector('.toast-container') || (() => {
            const div = document.createElement('div');
            div.className = 'toast-container';
            document.body.appendChild(div);
            return div;
        })();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        `;
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
        
        container.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }
    
    // ========== WEBRTC EVENT HANDLERS ==========
    handleRemoteOffer(data) {
        if (window.webrtc) {
            window.webrtc.handleOffer(data);
        }
    }
    
    handleRemoteAnswer(data) {
        if (window.webrtc) {
            window.webrtc.handleAnswer(data);
        }
    }
    
    handleRemoteIceCandidate(data) {
        if (window.webrtc) {
            window.webrtc.handleIceCandidate(data);
        }
    }
}

// =====================================================
// Initialize App
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CollabMeet();
});