from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}

    async def connect(
        self,
        user_id: int,
        websocket: WebSocket,
        subprotocol: str | None = None,
    ):
        await websocket.accept(subprotocol=subprotocol)
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, data: dict):
        websocket = self.active_connections.get(user_id)

        if websocket:
            try:
                await websocket.send_json(data)
            except Exception:
                self.disconnect(user_id)


manager = ConnectionManager()