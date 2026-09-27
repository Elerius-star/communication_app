// =====================================================
// WEBRTC MANAGER
// =====================================================

class WebRTCManager {
    constructor(app) {
        this.app = app;
        this.localStream = null;
        this.screenStream = null;
        this.peerConnections = {};
        this.isScreenSharing = false;
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.init();
    }
    
    async init() {
        try {
            await this.getUserMedia();
        } catch (error) {
            console.error('Error accessing media devices:', error);
            this.app.showToast('error', 'Media Error', 'Unable to access camera or microphone');
        }
    }
    
    async getUserMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            
            const video = this.app.elements.localVideo;
            if (video) {
                video.srcObject = this.localStream;
            }
            
            return this.localStream;
        } catch (error) {
            console.error('getUserMedia error:', error);
            throw error;
        }
    }
    
    setAudioEnabled(enabled) {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = enabled;
            });
        }
    }
    
    setVideoEnabled(enabled) {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = enabled;
            });
        }
    }
    
    async toggleScreenShare() {
        if (this.isScreenSharing) {
            this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    }
    
    async startScreenShare() {
        try {
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always'
                },
                audio: false
            });
            
            this.isScreenSharing = true;
            
            // Replace video track with screen track
            const videoTrack = this.screenStream.getVideoTracks()[0];
            const sender = this.peerConnections[this.app.currentRoom]?.getSenders?.()?.find(
                s => s.track?.kind === 'video'
            );
            
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
            
            // Update UI
            this.app.elements.toggleScreenShare.classList.add('active');
            
            // Notify others
            this.app.socket.emit('screen_share_start', {
                room_id: this.app.currentRoom,
                username: this.app.currentUser
            });
            
            this.app.showToast('success', 'Screen Sharing', 'You are now sharing your screen');
            
            // Handle stop when user clicks "Stop sharing" in browser
            videoTrack.onended = () => {
                this.stopScreenShare();
            };
            
        } catch (error) {
            console.error('Screen share error:', error);
            this.app.showToast('error', 'Screen Share Error', 'Failed to start screen sharing');
        }
    }
    
    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        this.isScreenSharing = false;
        this.app.elements.toggleScreenShare.classList.remove('active');
        
        // Restore camera video
        const videoTrack = this.localStream?.getVideoTracks()[0];
        if (videoTrack) {
            const sender = this.peerConnections[this.app.currentRoom]?.getSenders?.()?.find(
                s => s.track?.kind === 'video'
            );
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
        }
        
        // Notify others
        this.app.socket.emit('screen_share_stop', {
            room_id: this.app.currentRoom,
            username: this.app.currentUser
        });
        
        this.app.showToast('info', 'Screen Sharing', 'You have stopped sharing your screen');
    }
    
    createPeerConnection(remoteUsername) {
        const pc = new RTCPeerConnection(this.iceServers);
        
        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.app.socket.emit('ice_candidate', {
                    target: remoteUsername,
                    candidate: event.candidate,
                    username: this.app.currentUser
                });
            }
        };
        
        // Handle remote tracks
        pc.ontrack = (event) => {
            this.addRemoteTrack(remoteUsername, event.streams[0]);
        };
        
        // Handle connection state
        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${remoteUsername}:`, pc.connectionState);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.removeRemoteVideo(remoteUsername);
            }
        };
        
        this.peerConnections[remoteUsername] = pc;
        return pc;
    }
    
    async createOffer(remoteUsername) {
        const pc = this.createPeerConnection(remoteUsername);
        
        try {
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await pc.setLocalDescription(offer);
            
            this.app.socket.emit('offer', {
                room_id: this.app.currentRoom,
                target: remoteUsername,
                offer: offer,
                username: this.app.currentUser
            });
            
            return offer;
        } catch (error) {
            console.error('Create offer error:', error);
            throw error;
        }
    }
    
    async handleOffer(data) {
        const remoteUsername = data.from;
        const pc = this.createPeerConnection(remoteUsername);
        
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            this.app.socket.emit('answer', {
                target: remoteUsername,
                answer: answer,
                username: this.app.currentUser
            });
        } catch (error) {
            console.error('Handle offer error:', error);
        }
    }
    
    async handleAnswer(data) {
        const remoteUsername = data.from;
        const pc = this.peerConnections[remoteUsername];
        
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (error) {
                console.error('Handle answer error:', error);
            }
        }
    }
    
    async handleIceCandidate(data) {
        const remoteUsername = data.from;
        const pc = this.peerConnections[remoteUsername];
        
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('Handle ICE candidate error:', error);
            }
        }
    }
    
    addRemoteTrack(username, stream) {
        this.addRemoteVideo(username, stream);
    }
    
    addRemoteVideo(username, stream = null) {
        const grid = this.app.elements.videoGrid;
        
        // Check if already exists
        const existing = document.getElementById(`remote-${username}`);
        if (existing) {
            if (stream) {
                const video = existing.querySelector('video');
                if (video) video.srcObject = stream;
            }
            return;
        }
        
        const container = document.createElement('div');
        container.className = 'video-container';
        container.id = `remote-${username}`;
        container.innerHTML = `
            <video autoplay playsinline></video>
            <div class="video-label">
                <span>${username}</span>
                <div class="video-status">
                    <i class="fas fa-circle online"></i>
                </div>
            </div>
        `;
        
        if (stream) {
            const video = container.querySelector('video');
            video.srcObject = stream;
        }
        
        grid.appendChild(container);
    }
    
    removeRemoteVideo(username) {
        const container = document.getElementById(`remote-${username}`);
        if (container) {
            container.remove();
        }
        
        // Close peer connection
        if (this.peerConnections[username]) {
            this.peerConnections[username].close();
            delete this.peerConnections[username];
        }
    }
}