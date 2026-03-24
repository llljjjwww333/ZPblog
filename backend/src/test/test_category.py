import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.model.user import User
from app.model.category import Category
from app.core.security import get_password_hash, create_access_token


def test_create_category(client: TestClient, db: Session):
    """Test create category functionality"""
    # Create test user
    hashed_password = get_password_hash("password123")
    test_user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed_password,
        is_superuser=True
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    
    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test data
    category_data = {
        "name": "Test Category"
    }
    
    # Make create category request
    response = client.post("/api/categories/", json=category_data, headers=headers)
    
    # Assert response
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == category_data["name"]
    assert "id" in data
    
    # Verify category exists in database
    db_category = db.query(Category).filter(Category.id == data["id"]).first()
    assert db_category is not None
    assert db_category.name == category_data["name"]


def test_get_categories(client: TestClient, db: Session):
    """Test get categories functionality"""
    # Create test categories
    for i in range(3):
        test_category = Category(name=f"Test Category {i}")
        db.add(test_category)
    db.commit()
    
    # Make get categories request
    response = client.get("/api/categories/")
    
    # Assert response
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
