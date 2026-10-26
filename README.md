# AI-Powered Repository and Research Retrieval Chatbot for STI Alaminos

This project is a full-stack academic repository and AI-enabled research retrieval system for STI Alaminos. It includes:

- React + Vite frontend
- Express.js backend
- SQLite database for local development
- RBAC for students, faculty and administrators
- Repository search and AI chat fallback
- Document upload, preview and download controls
- Sample academic data and demo documents

## Quick Start

1. Install dependencies:
   npm install
2. Copy the example environment file:
   cp .env.example .env
3. Start the app in development mode:
   npm run dev
4. Visit:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000/api/health

## Default Admin Account

The database seed creates a default administrator account:

- Username: admin
- Password: Admin123!

After logging in, you can create additional users and manage categories, documents and permissions.

## Project Structure

- backend/ – Express API, SQLite schema and seed data
- frontend/ – React application
- uploads/ – demo documents and uploaded files

## Features

- Landing page with repository overview
- Student, faculty and admin dashboards
- Research repository search and filters
- Role-based access controls
- Document upload validation and download protection
- AI-assisted bot with keyword fallback when no OpenAI key is configured
- Chat and search history tracking
- Admin analytics, user management and category creation

## Configuration

- Add your OpenAI API key to `.env` if you want AI-generated responses instead of repository-grounded fallback summaries.
- The app uses SQLite by default for simple local setup. A MySQL-compatible schema is also represented in the SQL seed file for migration.

## Database Notes

The backend initializes the database automatically on startup. If the schema is empty, it creates and seeds sample data including users, categories and demo documents.

## Testing

- Student login: username `student`, password `Student123!`
- Faculty login: username `faculty`, password `Faculty123!`
- Admin login: username `admin`, password `Admin123!`

After logging in, use the repository and chatbot pages to search, filter and open documents.

## Production

For production deployment, replace the default session secret, use a managed database, and configure a secure file storage strategy.
