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

## Local dev

You can open the HTML files directly for UI, but API calls need a serverless runtime.

Recommended:

1. Install Vercel CLI
2. Run:
   - `vercel dev`

Then open the printed local URL.

## Deploy to Vercel

1. Push this folder to GitHub
2. Import into Vercel
3. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never put this in frontend code)
4. Deploy

## Supabase setup (required)

Create a new Supabase project, then open **SQL Editor** and run:

```sql
-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  balance integer not null default 0,
  created_at timestamptz not null default now()
);

-- QUIZ ATTEMPTS
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  username text not null references public.users(username) on delete cascade,
  quiz_id text not null,
  earned integer not null,
  created_at timestamptz not null default now(),
  unique (username, quiz_id)
);
```

### Optional (recommended): atomic awarding RPC

This makes awarding coins fully atomic (no race conditions).

```sql
create or replace function public.award_quiz(
  p_username text,
  p_quiz_id text,
  p_earned integer
)
returns table(balance integer)
language plpgsql
security definer
as $$
declare
  v_balance integer;
begin
  -- Insert attempt (blocks duplicates via unique constraint)
  insert into public.quiz_attempts(username, quiz_id, earned)
  values (p_username, p_quiz_id, p_earned);

  update public.users
    set balance = balance + p_earned
    where username = p_username
    returning public.users.balance into v_balance;

  return query select v_balance as balance;
exception
  when unique_violation then
    raise exception 'ALREADY_ATTEMPTED' using errcode = '23505';
end;
$$;
```

If you don’t add this function, the app will still work (it falls back to a 2-step update).

## Quiz content

Edit `quizzes/quizzes.json`.

- `reward`: maximum EDU you can earn from that quiz
- `perCorrect`: coins per correct answer (earned is capped by `reward`)
- Answers are stored server-side in this JSON and never sent to the browser.

## Pages

- `index.html`: username registration/login
- `quizzes.html`: quiz list
- `quiz.html`: quiz runner
- `wallet.html`: balance view

## Important note about username-only accounts

This MVP **does not prove ownership** of a username (no password/email). Someone else could type the same username on another device **if they know it**. The uniqueness check prevents *new registrations* with duplicates, but it can’t stop impersonation without real authentication.

If you want secure accounts, we can add:
- email OTP
- Google login
- passkeys

