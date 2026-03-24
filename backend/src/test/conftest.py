import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Create a test database engine
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_blog.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create a sessionmaker for testing
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the database engine before importing app
import app.database
app.database.engine = engine

# Import FastAPI app instance
from main import app
from app.database import Base, get_db

@pytest.fixture(scope="function")
def db():
    # Create the database tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    # Override the get_db dependency
    def override_get_db():
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    # Use the correct TestClient initialization
    client = TestClient(app)
    yield client
    del app.dependency_overrides[get_db]
