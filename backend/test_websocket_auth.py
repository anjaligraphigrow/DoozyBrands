import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from main import app
from security import create_access_token, get_db


class FakeQuery:
    def __init__(self, user):
        self.user = user

    def filter(self, *_):
        return self

    def first(self):
        return self.user


class FakeSession:
    def __init__(self, user):
        self.user = user

    def query(self, _):
        return FakeQuery(self.user)


def test_notification_websocket_requires_matching_active_user():
    user = type("FakeUser", (), {"id": 47, "is_active": True})()
    app.dependency_overrides[get_db] = lambda: FakeSession(user)
    client = TestClient(app)
    token = create_access_token(user.id, "employee")

    try:
        with client.websocket_connect(
            "/ws/47",
            subprotocols=["office-system", f"bearer.{token}"],
        ):
            pass

        with pytest.raises(WebSocketDisconnect) as mismatch:
            with client.websocket_connect(
                "/ws/48",
                subprotocols=["office-system", f"bearer.{token}"],
            ):
                pass
        assert mismatch.value.code == 1008

        with pytest.raises(WebSocketDisconnect) as unauthenticated:
            with client.websocket_connect("/ws/47"):
                pass
        assert unauthenticated.value.code == 1008
    finally:
        app.dependency_overrides.pop(get_db, None)