import json
from typing import Dict, List, Optional

class WebRTCService:
    """Service to manage WebRTC connections"""
    
    def __init__(self):
        self.room_connections = {}
        self.user_connections = {}
    
    def add_user_to_room(self, room_id: str, username: str, connection_data: dict):
        """Add user to a room"""
        if room_id not in self.room_connections:
            self.room_connections[room_id] = {}
        
        self.room_connections[room_id][username] = connection_data
        self.user_connections[username] = {'room_id': room_id, 'data': connection_data}
    
    def remove_user_from_room(self, room_id: str, username: str):
        """Remove user from room"""
        if room_id in self.room_connections:
            if username in self.room_connections[room_id]:
                del self.room_connections[room_id][username]
            
            # Clean up empty rooms
            if len(self.room_connections[room_id]) == 0:
                del self.room_connections[room_id]
        
        if username in self.user_connections:
            del self.user_connections[username]
    
    def get_room_participants(self, room_id: str) -> List[str]:
        """Get list of participants in a room"""
        if room_id in self.room_connections:
            return list(self.room_connections[room_id].keys())
        return []
    
    def get_user_room(self, username: str) -> Optional[str]:
        """Get the room ID of a user"""
        if username in self.user_connections:
            return self.user_connections[username]['room_id']
        return None