import sys
import os

# Add api directory to sys.path so app module is directly importable
api_dir = os.path.dirname(os.path.abspath(__file__))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.main import app
