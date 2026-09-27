// =====================================================
// WHITEBOARD MANAGER
// =====================================================

class WhiteboardManager {
    constructor(app) {
        this.app = app;
        this.canvas = app.elements.whiteboardCanvas;
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.currentSize = 2;
        this.lastX = 0;
        this.lastY = 0;
        this.undoStack = [];
        this.maxUndo = 50;
        this.isRemote = false;
        
        this.init();
    }
    
    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.setupToolListeners();
        this.clearCanvas();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        
        // Restore canvas state if possible
        if (this.undoStack.length > 0) {
            this.restoreLastState();
        }
    }
    
    setupEventListeners() {
        const canvas = this.canvas;
        
        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        canvas.addEventListener('mousemove', (e) => this.draw(e));
        canvas.addEventListener('mouseup', () => this.stopDrawing());
        canvas.addEventListener('mouseleave', () => this.stopDrawing());
        
        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e);
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e);
        });
        canvas.addEventListener('touchend', () => this.stopDrawing());
    }
    
    setupToolListeners() {
        // Tool buttons
        this.app.elements.toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.app.elements.toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                this.updateCursor();
            });
        });
        
        // Color picker
        this.app.elements.drawColor.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
        });
        
        // Size slider
        this.app.elements.drawSize.addEventListener('input', (e) => {
            this.currentSize = parseInt(e.target.value);
        });
        
        // Clear button
        this.app.elements.clearWhiteboard.addEventListener('click', () => {
            this.clearWhiteboard();
        });
    }
    
    updateCursor() {
        const canvas = this.canvas;
        if (this.currentTool === 'eraser') {
            canvas.style.cursor = 'not-allowed';
        } else if (this.currentTool === 'text') {
            canvas.style.cursor = 'text';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }
    
    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        return {
            x: (clientX - rect.left) * (this.canvas.width / rect.width),
            y: (clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }
    
    startDrawing(e) {
        if (this.isRemote) return;
        
        this.isDrawing = true;
        const coords = this.getCoordinates(e);
        this.lastX = coords.x;
        this.lastY = coords.y;
        
        // Save state for undo
        this.saveState();
        
        // Handle text tool
        if (this.currentTool === 'text') {
            const text = prompt('Enter text:');
            if (text) {
                this.drawText(text, coords.x, coords.y);
            }
            this.isDrawing = false;
            return;
        }
    }
    
    draw(e) {
        if (!this.isDrawing || this.isRemote) return;
        
        const coords = this.getCoordinates(e);
        const x = coords.x;
        const y = coords.y;
        
        if (this.currentTool === 'eraser') {
            this.drawErase(x, y);
        } else if (this.currentTool === 'pen') {
            this.drawLine(this.lastX, this.lastY, x, y);
        } else if (this.currentTool === 'line') {
            // Redraw previous state and draw temporary line
            this.restoreLastState();
            this.drawLine(this.lastX, this.lastY, x, y);
        } else if (this.currentTool === 'rectangle') {
            this.restoreLastState();
            this.drawRectangle(this.lastX, this.lastY, x, y);
        } else if (this.currentTool === 'circle') {
            this.restoreLastState();
            this.drawCircle(this.lastX, this.lastY, x, y);
        }
        
        this.lastX = x;
        this.lastY = y;
        
        // Broadcast drawing to others
        this.broadcastDraw({
            tool: this.currentTool,
            x1: this.lastX,
            y1: this.lastY,
            x2: x,
            y2: y,
            color: this.currentColor,
            size: this.currentSize
        });
    }
    
    stopDrawing() {
        if (this.isDrawing && !this.isRemote) {
            this.isDrawing = false;
            // For line, rectangle, circle tools, save final state
            if (['line', 'rectangle', 'circle'].includes(this.currentTool)) {
                this.saveState();
            }
        }
    }
    
    drawLine(x1, y1, x2, y2) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = this.currentTool === 'eraser' ? '#FFFFFF' : this.currentColor;
        ctx.lineWidth = this.currentTool === 'eraser' ? this.currentSize * 3 : this.currentSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    
    drawRectangle(x1, y1, x2, y2) {
        const ctx = this.ctx;
        const width = x2 - x1;
        const height = y2 - y1;
        ctx.beginPath();
        ctx.rect(x1, y1, width, height);
        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = this.currentSize;
        ctx.stroke();
    }
    
    drawCircle(x1, y1, x2, y2) {
        const ctx = this.ctx;
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = this.currentSize;
        ctx.stroke();
    }
    
    drawErase(x, y) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, this.currentSize * 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }
    
    drawText(text, x, y) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `${this.currentSize * 10}px Arial`;
        ctx.fillStyle = this.currentColor;
        ctx.textBaseline = 'top';
        ctx.fillText(text, x, y);
        ctx.restore();
        
        // Broadcast text
        this.broadcastDraw({
            tool: 'text',
            x: x,
            y: y,
            text: text,
            color: this.currentColor,
            size: this.currentSize
        });
    }
    
    saveState() {
        const imageData = this.canvas.toDataURL();
        this.undoStack.push(imageData);
        if (this.undoStack.length > this.maxUndo) {
            this.undoStack.shift();
        }
    }
    
    restoreLastState() {
        if (this.undoStack.length > 0) {
            const imageData = this.undoStack[this.undoStack.length - 1];
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = imageData;
        }
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.undoStack = [];
        this.saveState();
    }
    
    clearWhiteboard() {
        this.clearCanvas();
        this.app.socket.emit('whiteboard_clear', {
            room_id: this.app.currentRoom,
            username: this.app.currentUser
        });
        this.app.showToast('info', 'Whiteboard Cleared', 'Whiteboard has been cleared');
    }
    
    broadcastDraw(data) {
        this.app.socket.emit('whiteboard_draw', {
            room_id: this.app.currentRoom,
            username: this.app.currentUser,
            action: 'draw',
            data: data
        });
    }
    
    drawRemote(data) {
        this.isRemote = true;
        
        switch (data.tool) {
            case 'pen':
                this.drawLine(data.x1, data.y1, data.x2, data.y2);
                break;
            case 'line':
                this.drawLine(data.x1, data.y1, data.x2, data.y2);
                break;
            case 'rectangle':
                this.drawRectangle(data.x1, data.y1, data.x2, data.y2);
                break;
            case 'circle':
                this.drawCircle(data.x1, data.y1, data.x2, data.y2);
                break;
            case 'text':
                this.drawText(data.text, data.x, data.y);
                break;
            case 'eraser':
                this.drawErase(data.x2, data.y2);
                break;
        }
        
        this.isRemote = false;
    }
    
    clearRemote() {
        this.clearCanvas();
    }
    
    loadState(data) {
        // Load whiteboard state from server
        if (data && data.lines && data.lines.length > 0) {
            this.isRemote = true;
            data.lines.forEach(line => {
                this.drawRemote(line.data);
            });
            this.isRemote = false;
        }
    }
}