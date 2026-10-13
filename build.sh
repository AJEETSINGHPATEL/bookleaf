#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Building React Vite Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "==> Build complete! Both frontend and backend are ready."
