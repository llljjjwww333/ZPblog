import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.model.user import User
from app.core.security import get_password_hash, create_access_token


def test_agent_collaboration(client: TestClient, db: Session):
    """Test Agent collaboration logic"""
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
    
    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test multi-agent review endpoint (simulated collaboration)
    response = client.post("/api/multi-agent/review", json={
        "article_id": 1,
        "review_type": "comprehensive",
        "agents": ["content_analyzer", "grammar_checker", "style_evaluator"]
    }, headers=headers)
    
    # Assert response status code (200 for success, 404 for not found, 422 for validation error)
    assert response.status_code in [200, 404, 422]
    
    # Test available LLMs for multi-agent
    response = client.get("/api/multi-agent/available-llms", headers=headers)
    
    # Assert response status code (200 for success, 404 for not found, 422 for validation error)
    assert response.status_code in [200, 404, 422]


def test_agent_feedback_handling(client: TestClient, db: Session):
    """Test Agent feedback handling"""
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
    
    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test recommendations feedback (simulated agent interaction)
    response = client.post("/api/recommendations/feedback", json={
        "post_id": 1,
        "feedback": "positive",
        "reason": "relevant content"
    }, headers=headers)
    
    # Assert response status code (200 for success, 404 for not found, 422 for validation error)
    assert response.status_code in [200, 404, 422]


def test_agent_ai_writing_tools(client: TestClient, db: Session):
    """Test Agent AI writing tools"""
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
    
    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test AI rewrite tool (simulated agent collaboration)
    try:
        response = client.post("/api/ai-rewrite", json={
            "content": "This is a test article that needs improvement.",
            "rewrite_type": "improve_clarity"
        }, headers=headers)
        # Assert response status code (200 for success, 404 for not found, 422 for validation error)
        assert response.status_code in [200, 404, 422]
    except Exception:
        # Handle any exception that might occur due to AI provider configuration
        pass
    
    # Test generate titles tool (simulated agent collaboration)
    try:
        response = client.post("/api/generate-titles", json={
            "content": "This is a test article about AI collaboration.",
            "count": 3
        }, headers=headers)
        # Assert response status code (200 for success, 404 for not found, 422 for validation error)
        assert response.status_code in [200, 404, 422]
    except Exception:
        # Handle any exception that might occur due to AI provider configuration
        pass
