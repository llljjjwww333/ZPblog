import sys
import os

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

print("Registered routes:")
for route in app.routes:
    if hasattr(route, "path"):
        print(f"Path: {route.path}, Name: {route.name}")
