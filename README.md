# AI-Powered Repository and Research Retrieval Chatbot for STI Alaminos

This project is a full-stack academic repository and AI-enabled research retrieval system for STI Alaminos.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite for local development
- Auth: server-side sessions with bcrypt hashing
- Uploads: local protected uploads folder

## Quick Start

1. Install dependencies:
   npm install
2. Copy environment file:
   cp .env.example .env
3. Start the app:
   npm run dev
4. Open the app at:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000/api/health

## Default Accounts

- Admin: username `admin`, password `Admin123!`
- Faculty: username `faculty`, password `Faculty123!`
- Student: username `student`, password `Student123!`

## Features

- Student, faculty and admin dashboards
- Research repository search with filters
- Document upload and protected download rules
- AI chatbot with repository search fallback
- User management and category management
- Role-based access control
- Seeded sample documents and categories

## Notes

The project keeps file storage in the local `backend/uploads` folder for development.
If you want AI-generated summaries, add an OpenAI API key to `.env`.

## First Administrator

The app seeds the default admin account automatically on first startup.
