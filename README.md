# EduCoin (username-only quiz rewards)

A simple website where people earn **EduCoin** by answering quizzes.

- Frontend: **plain HTML/CSS/JS**
- Backend: **Vercel Serverless Functions** (`/api/*`)
- Database: **Supabase Postgres**
- Accounts: **username only** (must be **globally unique**)

## What you get

- Unique username registration (`/api/register`)
- Quiz list + quiz runner (static pages)
- Server-verified submissions (`/api/submit`)
- Balance stored in Supabase (not in the browser)
- Prevents earning the **same quiz** more than once per username

