// =====================================================
// FILE SHARE MANAGER
// =====================================================

class FileManager {
    constructor(app) {
        this.app = app;
        this.files = [];
        this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        this.ALLOWED_TYPES = [
            'image/*',
            'video/*',
            'audio/*',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
            'application/zip',
            'application/x-rar-compressed'
        ];
        
        this.init();
    }
    
    init() {
        this.setupDragDrop();
        this.setupFileInput();
    }
    
    setupDragDrop() {
        const dropZone = this.app.elements.dropZone;
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
        
        dropZone.addEventListener('click', () => {
            this.app.elements.fileInput.click();
        });
    }
    
    setupFileInput() {
        const input = this.app.elements.fileInput;
        input.addEventListener('change', () => {
            this.handleFiles(input.files);
            input.value = ''; // Reset input
        });
    }
    
    handleFiles(files) {
        Array.from(files).forEach(file => {
            this.validateFile(file);
        });
    }
    
    validateFile(file) {
        // Check file size
        if (file.size > this.MAX_FILE_SIZE) {
            this.app.showToast('error', 'File Too Large', `${file.name} exceeds 50MB limit`);
            return;
        }
        
        // Check file type
        const isAllowed = this.ALLOWED_TYPES.some(type => {
            if (type.endsWith('/*')) {
                const mimeType = type.replace('/*', '');
                return file.type.startsWith(mimeType);
            }
            return file.type === type;
        });
        
        if (!isAllowed) {
            this.app.showToast('error', 'File Type Not Allowed', `${file.name} is not a supported file type`);
            return;
        }
        
        this.addFile(file);
    }
    
    addFile(file) {
        // Add to file list
        const list = this.app.elements.fileList;
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.fileName = file.name;
        item.innerHTML = `
            <span class="file-name">
                <i class="fas ${this.getFileIcon(file.type)}"></i>
                ${file.name}
            </span>
            <span class="file-size">${this.app.formatFileSize(file.size)}</span>
            <button class="btn-icon remove-file" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        item.querySelector('.remove-file').addEventListener('click', () => {
            item.remove();
            this.files = this.files.filter(f => f.name !== file.name);
            this.updateSendButton();
        });
        
        list.appendChild(item);
        this.files.push(file);
        this.updateSendButton();
        
        // Show preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.createElement('div');
                preview.className = 'file-preview';
                preview.innerHTML = `<img src="${e.target.result}" alt="${file.name}" />`;
                item.appendChild(preview);
            };
            reader.readAsDataURL(file);
        }
    }
    
    getFileIcon(type) {
        if (type.startsWith('image/')) return 'fa-image';
        if (type.startsWith('video/')) return 'fa-video';
        if (type.startsWith('audio/')) return 'fa-music';
        if (type.includes('pdf')) return 'fa-file-pdf';
        if (type.includes('word')) return 'fa-file-word';
        if (type.includes('excel')) return 'fa-file-excel';
        if (type.includes('powerpoint')) return 'fa-file-powerpoint';
        return 'fa-file';
    }
    
    updateSendButton() {
        const btn = this.app.elements.sendFilesBtn;
        btn.disabled = this.files.length === 0;
        btn.textContent = this.files.length > 0 ? 
            `Send ${this.files.length} file${this.files.length > 1 ? 's' : ''}` : 
            'Send Files';
    }
    
    async sendFiles() {
        if (this.files.length === 0) return;
        
        const btn = this.app.elements.sendFilesBtn;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        try {
            for (const file of this.files) {
                await this.sendFile(file);
            }
            
            // Clear file list
            this.app.elements.fileList.innerHTML = '';
            this.files = [];
            this.updateSendButton();
            
            this.app.showToast('success', 'Files Sent', 'All files have been shared successfully');
            this.app.elements.fileShareModal.classList.add('hidden');
            
        } catch (error) {
            console.error('Send files error:', error);
            this.app.showToast('error', 'Send Failed', 'Failed to send files');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Files';
        }
    }
    
    async sendFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    // Convert to base64 for transmission
                    const fileData = btoa(e.target.result);
                    
                    this.app.socket.emit('file_share', {
                        room_id: this.app.currentRoom,
                        username: this.app.currentUser,
                        file_data: fileData,
                        file_name: file.name,
                        file_size: file.size,
                        file_type: file.type
                    });
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsBinaryString(file);
        });
    }
}

// Setup send button
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const btn = document.getElementById('sendFilesBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                if (window.app && window.fileManager) {
                    window.fileManager.sendFiles();
                }
            });
        }
    }, 100);
});