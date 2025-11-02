# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy backend requirements
COPY backend/requirements.txt ./backend/

# Install dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Set working directory to backend
WORKDIR /app/backend

# Expose port (Railway will set PORT env var)
EXPOSE 8080

# Run gunicorn with shell to expand PORT variable
CMD gunicorn server:app --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 120
