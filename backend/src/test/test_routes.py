import pytest
from fastapi.testclient import TestClient

from main import app


def test_api_routes():
    """Test API routes are registered"""
    client = TestClient(app)
    
    # Test auth routes
    response = client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    })
    assert response.status_code != 404, f"/api/auth/register returned 404"
    print(f"/api/auth/register: {response.status_code}")
    
    # Test categories routes
    response = client.get("/api/categories/")
    assert response.status_code != 404, f"/api/categories/ returned 404"
    print(f"/api/categories/: {response.status_code}")
    
    # Test posts routes
    response = client.get("/api/posts/")
    assert response.status_code != 404, f"/api/posts/ returned 404"
    print(f"/api/posts/: {response.status_code}")
    
    # Test comments routes
    response = client.get("/api/comments/post/1")
    assert response.status_code != 404, f"/api/comments/post/1 returned 404"
    print(f"/api/comments/post/1: {response.status_code}")
