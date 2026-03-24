import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.model.user import User
from app.schemas.user import UserCreate, UserLogin
from app.core.security import get_password_hash


def test_user_registration(client: TestClient, db: Session):
    """Test user registration functionality"""
    # Test data
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    }
    
    # Make registration request
    response = client.post("/api/auth/register", json=user_data)
    
    # Assert response
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == user_data["username"]
    assert data["email"] == user_data["email"]
    assert "id" in data
    
    # Verify user exists in database
    db_user = db.query(User).filter(User.email == user_data["email"]).first()
    assert db_user is not None
    assert db_user.username == user_data["username"]


def test_user_login(client: TestClient, db: Session):
    """Test user login functionality"""
    # Create test user in database
    hashed_password = get_password_hash("password123")
    test_user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed_password
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    
    # Test login
    login_data = {
        "username": "test@example.com",
        "password": "password123"
    }
    
    response = client.post("/api/login", json=login_data)
    
    # Assert response
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "token_type" in data
    assert data["token_type"] == "bearer"


def test_invalid_login(client: TestClient, db: Session):
    """Test invalid login attempt"""
    # Create test user in database
    hashed_password = get_password_hash("password123")
    test_user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed_password
    )
    db.add(test_user)
    db.commit()
    
    # Test login with wrong password
    login_data = {
        "username": "test@example.com",
        "password": "wrongpassword"
    }
    
    response = client.post("/api/login", json=login_data)
    
    # Assert response
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data
