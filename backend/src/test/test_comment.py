import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.model.user import User
from app.model.post import Post
from app.model.category import Category
from app.model.comment import Comment
from app.core.security import get_password_hash, create_access_token


def test_create_comment(client: TestClient, db: Session):
    """Test create comment functionality"""
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
    
    # Test data
    comment_data = {
        "content": "This is a test comment",
        "post_id": test_post.id
    }
    
    # Make create comment request
    response = client.post(f"/api/comments/post/{test_post.id}", json=comment_data, headers=headers)
    
    # Assert response
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == comment_data["content"]
    assert data["post_id"] == comment_data["post_id"]
    assert "id" in data
    
    # Verify comment exists in database
    db_comment = db.query(Comment).filter(Comment.id == data["id"]).first()
    assert db_comment is not None
    assert db_comment.content == comment_data["content"]


def test_get_comments_by_post_id(client: TestClient, db: Session):
    """Test get comments by post id functionality"""
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
    
    # Create test comments
    for i in range(3):
        test_comment = Comment(
            content=f"This is test comment {i}",
            post_id=test_post.id,
            author_id=test_user.id
        )
        db.add(test_comment)
    db.commit()
    
    # Make get comments request
    response = client.get(f"/api/comments/post/{test_post.id}")
    
    # Assert response
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
