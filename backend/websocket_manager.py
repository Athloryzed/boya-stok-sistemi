from fastapi import WebSocket
from typing import List
import logging


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logging.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logging.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Tüm bağlı istemcilere mesaj gönder"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logging.error(f"WebSocket send error: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


class ManagerConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}

    async def connect(self, websocket: WebSocket, manager_id: str):
        await websocket.accept()
        self.active_connections[manager_id] = websocket
        logging.info(f"Manager WebSocket connected: {manager_id}. Total: {len(self.active_connections)}")

    def disconnect(self, manager_id: str):
        if manager_id in self.active_connections:
            del self.active_connections[manager_id]
        logging.info(f"Manager WebSocket disconnected: {manager_id}. Total: {len(self.active_connections)}")

    async def broadcast_to_managers(self, message: dict):
        """Tüm yöneticilere mesaj gönder"""
        disconnected = []
        for manager_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
                logging.info(f"Notification sent to manager: {manager_id}")
            except Exception as e:
                logging.error(f"Manager WebSocket send error: {e}")
                disconnected.append(manager_id)
        for mgr_id in disconnected:
            self.disconnect(mgr_id)


# Singleton instances
ws_manager = ConnectionManager()
ws_manager_mgmt = ManagerConnectionManager()
