import uvicorn

# api/main.py
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.app import app  # ← Hanya di sini!

if __name__ =="__main__":
    uvicorn.run("app.app:app", host="0.0.0.0", port=8000, reload=True)