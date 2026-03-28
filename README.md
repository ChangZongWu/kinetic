# Kinetic — Workout Tracking App

A premium fitness tracking app with a dark theme, interactive muscle selector, AI fitness advisor, and real-time workout logging. Built with Expo React Native (web + mobile), Python FastAPI, and Supabase.

---

## Live App

**Frontend:** [kinetic-phi-mauve.vercel.app](https://kinetic-phi-mauve.vercel.app)
**API:** [kinetic-production-f463.up.railway.app](https://kinetic-production-f463.up.railway.app)

---

## Features

- **Dashboard** — Weekly volume chart, today's session preview, streak tracking, plan switcher
- **Active Workout** — Live set tracking with auto rest timer, last-session weight hints, post-workout summary with PRs
- **Workout Builder** — Create plans, assign exercises by day, configure sets & reps, apply templates (PPL, Upper/Lower, Full Body 3×, 5×5)
- **Exercise Library** — Filter by muscle group via interactive body diagram, create custom exercises
- **Progress** — 6-week volume chart, strength progression graphs, clickable training calendar, workout history
- **AI Advisor** — Claude-powered fitness coach with context of your profile and workout history
- **Profile** — Unit toggle (metric/imperial), fitness goal, rest timer default

---

## Architecture

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    KINETIC FITNESS APP — ARCHITECTURE                                        ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND  ·  Expo React Native                                            │
│                                       ☁  Deployed on Vercel                                                 │
│                                                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                          SCREENS                                                      │   │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │  Dashboard  │  │ Active Workout   │  │ Workout Builder  │  │   Progress   │  │  Exercise List  │  │   │
│  │  └─────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘  └─────────────────┘  │   │
│  │  ┌──────────────────┐  ┌─────────────────────┐  ┌───────────────────────────────────────────────┐    │   │
│  │  │ Muscle Selector  │  │       Profile       │  │                 AI Advisor                    │    │   │
│  │  └──────────────────┘  └─────────────────────┘  └───────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                              │
│  ┌────────────────────────────────────┐   ┌────────────────────────────────────────────────────────────┐   │
│  │            STATE                   │   │                       AUTH                                  │   │
│  │  · React useState (per screen)     │   │  · Supabase JS Client v2                                   │   │
│  │  · localStorage (plan selection)   │   │  · JWT in localStorage / AsyncStorage                      │   │
│  └────────────────────────────────────┘   └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
         │  ① Login/signup direct to Supabase          │  ② REST + JWT          ③ /ai/chat → SSE
         ▼                                             ▼                                     ▲
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND  ·  Python FastAPI                                               │
│                                       ☁  Deployed on Railway                                                │
│                                                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  AUTH MIDDLEWARE  ──  Extract Bearer JWT  ──►  Verify via Supabase  (every protected request)        │   │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                              │                                                               │
│                                              ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                         ROUTERS                                                       │   │
│  │  ┌──────┐  ┌─────────┐  ┌───────────┐  ┌───────┐  ┌─────────┐  ┌──────────────┐  ┌──────────┐      │   │
│  │  │health│  │ muscles │  │ exercises │  │ plans │  │ profile │  │ session_sets │  │   logs   │      │   │
│  │  └──────┘  └─────────┘  └───────────┘  └───────┘  └─────────┘  └──────────────┘  └──────────┘      │   │
│  │                                                                                                        │   │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │  ai  ──►  Anthropic Claude (claude-opus-4-6)  ──►  Server-Sent Events stream  ──►  Frontend  │    │   │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
         │  ① JWT verification          │  ② DB queries (Supabase service key)          ▲  Results
         ▼                              ▼                                                │
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE + AUTH  ·  Supabase (PostgreSQL)                                      │
│                                         ☁  Supabase Cloud                                                   │
│                                                                                                              │
│  ┌─────────────────────────────────┐   ┌────────────────────────────────────────────────────────────────┐  │
│  │        SUPABASE AUTH            │   │                   POSTGRESQL TABLES                            │  │
│  │  · Login / Signup (frontend)    │   │                                                                │  │
│  │  · Issues JWT on success        │   │  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐  │  │
│  │  · JWT verified by FastAPI      │   │  │   profiles   │   │muscle_groups │   │    exercises      │  │  │
│  │                                 │   │  └──────────────┘   └──────────────┘   └───────────────────┘  │  │
│  │                                 │   │  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐  │  │
│  │                                 │   │  │workout_plans │   │plan_sessions │   │   session_sets    │  │  │
│  │                                 │   │  └──────────────┘   └──────────────┘   └───────────────────┘  │  │
│  │                                 │   │  ┌──────────────┐   ┌──────────────┐                          │  │
│  │                                 │   │  │workout_logs  │   │   log_sets   │                          │  │
│  │                                 │   │  └──────────────┘   └──────────────┘                          │  │
│  └─────────────────────────────────┘   └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                              ┌─────────────────────────────────────────┐
                              │     EXTERNAL  ·  Anthropic Claude API   │
                              │     Model: claude-opus-4-6              │
                              │     Used by: /ai router → SSE stream    │
                              └─────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║  DATA FLOWS                                                                                                  ║
║  ①  User logs in  ──►  Supabase Auth  ──►  JWT returned and stored in frontend                             ║
║  ②  All API calls: Frontend + JWT  ──►  FastAPI verifies JWT  ──►  Supabase DB  ──►  JSON response         ║
║  ③  AI chat: Frontend  ──►  FastAPI /ai  ──►  Anthropic Claude  ──►  SSE streamed back to screen           ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Expo React Native 55 · React 19 · TypeScript | Vercel |
| Backend | Python FastAPI · Uvicorn | Railway |
| Database | Supabase PostgreSQL | Supabase Cloud |
| Auth | Supabase Auth (JWT) | Supabase Cloud |
| AI | Anthropic Claude (`claude-opus-4-6`) | Anthropic API |

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | User profile — name, age, weight, height, goal, units, fitness level, rest timer |
| `muscle_groups` | Muscle group catalogue — name, body region |
| `exercises` | Exercise library — name, muscle group, difficulty, equipment, sets/reps suggestion |
| `workout_plans` | User-created plans — name, goal, user_id |
| `plan_sessions` | Exercise-to-day assignments within a plan |
| `session_sets` | Configured sets per session (reps, weight) |
| `workout_logs` | Completed workout records — duration, date, plan |
| `log_sets` | Actual sets logged during a workout — exercise, reps, weight |

---

## API Endpoints

All endpoints require `Authorization: Bearer <JWT>` except `/health`, `/muscles`, and `/exercises` (GET).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/muscles` | List all muscle groups |
| GET | `/exercises` | List exercises (filter by muscle, difficulty, equipment, query) |
| POST | `/exercises` | Create a custom exercise |
| GET | `/profile` | Get current user's profile |
| PATCH | `/profile` | Update profile (units, goal, weight, rest timer, etc.) |
| GET | `/plans` | List user's workout plans |
| POST | `/plans` | Create a new plan |
| PATCH | `/plans/:id` | Rename or update plan goal |
| DELETE | `/plans/:id` | Delete a plan |
| POST | `/plans/:id/sessions` | Add an exercise to a day |
| DELETE | `/plans/:id/sessions/:sid` | Remove an exercise from a day |
| GET | `/plans/:id/sessions/:sid/sets` | Get configured sets for a session |
| POST | `/plans/:id/sessions/:sid/sets` | Add a set |
| PATCH | `/plans/:id/sessions/:sid/sets/:setid` | Update set reps/weight |
| DELETE | `/plans/:id/sessions/:sid/sets/:setid` | Delete a set |
| GET | `/logs` | List recent workout logs (last 30) |
| POST | `/logs` | Save a completed workout |
| DELETE | `/logs/:id` | Delete a workout log |
| POST | `/ai/chat` | Stream AI fitness advice (SSE) |

---

## Project Structure

```
kinetic/
├── kinetic-app/                  # Expo React Native frontend
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login.tsx         # Login / sign-up screen
│   │   └── (app)/
│   │       ├── dashboard.tsx     # Home — weekly chart, today's session, plan switcher
│   │       ├── active-workout.tsx# Live workout — set tracking, rest timer, summary
│   │       ├── workout-builder.tsx# Plan creation, exercise assignment, templates
│   │       ├── exercise-list.tsx # Exercise library with search and filters
│   │       ├── muscle-selector.tsx# Interactive body diagram
│   │       ├── progress.tsx      # Charts, calendar, workout history
│   │       ├── profile.tsx       # User settings and unit toggle
│   │       └── ai-advisor.tsx    # Claude-powered fitness chat
│   ├── components/               # Shared UI components
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client (native)
│   │   └── supabase.web.ts       # Supabase client (web/localStorage)
│   ├── theme/
│   │   └── colors.ts             # Design tokens — dark theme + neon green
│   └── vercel.json               # Vercel deployment config
│
└── kinetic-api/                  # Python FastAPI backend
    ├── main.py                   # App entry point, CORS, router registration
    ├── auth.py                   # JWT extraction and Supabase verification
    ├── database.py               # Supabase client (service key)
    ├── routers/
    │   ├── health.py
    │   ├── muscles.py
    │   ├── exercises.py
    │   ├── plans.py
    │   ├── profile.py
    │   ├── session_sets.py
    │   ├── logs.py
    │   └── ai.py                 # Claude SSE streaming endpoint
    ├── requirements.txt
    └── railway.toml              # Railway deployment config
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

### Frontend Setup

```bash
cd kinetic-app
npm install

# Create .env
cp .env.example .env
# Fill in EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

npx expo start --web
```

### Backend Setup

```bash
cd kinetic-api
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY

uvicorn main:app --reload
```

### Environment Variables

**kinetic-app `.env`**
```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**kinetic-api `.env`**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Deployment

### Frontend → Vercel
```bash
cd kinetic-app
npx expo export --platform web
# Push to GitHub — Vercel auto-deploys on push to main
```

### Backend → Railway
```bash
# Push to GitHub — Railway auto-deploys on push to main
# Set environment variables in Railway dashboard
```

---

## License

MIT
