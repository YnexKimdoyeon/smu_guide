"""
WebSocket 연결 관리자
"""
from typing import Dict, List
from fastapi import WebSocket
import json


class ConnectionManager:
    """WebSocket 연결 관리"""

    def __init__(self):
        # room_id -> {conn_id: (websocket, user_id)}
        self.active_connections: Dict[int, Dict[str, tuple]] = {}
        # user_id -> websocket (랜덤 채팅용)
        self.random_connections: Dict[int, WebSocket] = {}
        self._conn_counter = 0

    def _get_conn_id(self) -> str:
        """고유 연결 ID 생성"""
        self._conn_counter += 1
        return f"conn_{self._conn_counter}"

    async def connect(self, websocket: WebSocket, room_id: int, user_id: int) -> str:
        """채팅방 연결, 연결 ID 반환"""
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}

        conn_id = self._get_conn_id()
        self.active_connections[room_id][conn_id] = (websocket, user_id)
        return conn_id

    def disconnect(self, room_id: int, conn_id: str):
        """채팅방 연결 해제"""
        if room_id in self.active_connections:
            if conn_id in self.active_connections[room_id]:
                del self.active_connections[room_id][conn_id]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, room_id: int, message: dict, exclude_user: int = None):
        """채팅방 전체에 메시지 전송"""
        if room_id not in self.active_connections:
            return

        dead_connections = []
        for conn_id, (ws, user_id) in self.active_connections[room_id].items():
            if exclude_user and user_id == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"브로드캐스트 오류: {e}")
                dead_connections.append(conn_id)

        # 죽은 연결 정리
        for conn_id in dead_connections:
            if conn_id in self.active_connections.get(room_id, {}):
                del self.active_connections[room_id][conn_id]

    async def send_personal(self, websocket: WebSocket, message: dict):
        """개인 메시지 전송"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"개인 메시지 오류: {e}")

    def get_room_user_count(self, room_id: int) -> int:
        """채팅방 접속자 수"""
        if room_id not in self.active_connections:
            return 0
        return len(self.active_connections[room_id])

    # 랜덤 채팅용
    async def connect_random(self, websocket: WebSocket, user_id: int):
        """랜덤 채팅 연결"""
        await websocket.accept()
        self.random_connections[user_id] = websocket

    def disconnect_random(self, user_id: int):
        """랜덤 채팅 연결 해제"""
        if user_id in self.random_connections:
            del self.random_connections[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        """특정 사용자에게 메시지 전송"""
        if user_id in self.random_connections:
            try:
                await self.random_connections[user_id].send_json(message)
            except Exception as e:
                print(f"사용자 메시지 오류: {e}")
                del self.random_connections[user_id]


# 전역 매니저 인스턴스
manager = ConnectionManager()
