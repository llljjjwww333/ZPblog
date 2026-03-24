import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.model.user import User
from app.model.post import Post
from app.model.category import Category
from app.core.security import get_password_hash, create_access_token


def test_create_post(client: TestClient, db: Session):
    """Test create post functionality"""
    # Create test user
    hashed_password = get_password_hash("password123")
    test_user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed_password
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    
    # Create test category
    test_category = Category(name="Test Category")
    db.add(test_category)
    db.commit()
    db.refresh(test_category)
    
    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test data
    post_data = {
        "title": "Test Post",
        "content_markdown": "This is a test post content",
        "category_id": test_category.id,
        "cover_image": "test_cover.jpg"
    }
    
    # Make create post request
    response = client.post("/api/posts/", json=post_data, headers=headers)
    
    # Assert response
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == post_data["title"]
    assert data["content_markdown"] == post_data["content_markdown"]
    assert data["category_id"] == post_data["category_id"]
    assert "id" in data
    
    # Verify post exists in database
    db_post = db.query(Post).filter(Post.id == data["id"]).first()
    assert db_post is not None
    assert db_post.title == post_data["title"]


def test_get_posts(client: TestClient, db: Session):
    """Test get posts functionality"""
    # Create test user
    hashed_password = get_password_hash("password123")
    test_user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed_password
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    
    # Create test category
    test_category = Category(name="Test Category")
    db.add(test_category)
    db.commit()
    db.refresh(test_category)
    
    # Create test posts
    for i in range(3):
        test_post = Post(
            title=f"Test Post {i}",
            content_markdown=f"This is test post {i} content",
            category_id=test_category.id,
            author_id=test_user.id
        )
        db.add(test_post)
    db.commit()
    
    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Make get posts request
    response = client.get("/api/posts/", headers=headers)
    
    # Assert response
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3


def test_get_post_by_id(client: TestClient, db: Session):
    """Test get post by id functionality"""
    # Create test user
    hashed_password = get_password_hash("password123")
    test_user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed_password
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    
    # Create test category
    test_category = Category(name="Test Category")
    db.add(test_category)
    db.commit()
    db.refresh(test_category)
    
    # Create test post
    test_post = Post(
        title="Test Post",
        content_markdown="This is a test post content",
        category_id=test_category.id,
        author_id=test_user.id
    )
    db.add(test_post)
    db.commit()
    db.refresh(test_post)
    
    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Make get post by id request
    response = client.get(f"/api/posts/{test_post.id}/", headers=headers)
    
    # Assert response
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == test_post.title
    assert data["content_markdown"] == test_post.content_markdown
    assert data["id"] == test_post.id
