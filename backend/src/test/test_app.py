import pytest
from fastapi.testclient import TestClient

from main import app


def test_root():
    """Test root endpoint"""
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "欢迎来到个人博客平台"}


def test_health():
    """Test health endpoint"""
    client = TestClient(app)
    response = client.get("/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "正常运行中"}
