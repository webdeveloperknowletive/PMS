# PMS Frontend — Project Management System

Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui frontend for the FastAPI PMS backend.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then point NEXT_PUBLIC_API_URL at your running backend
npm run dev
```

Backend must be running with CORS allowing this app's origin (see `backend/app/core/config.py`).
Default expected backend URL: `http://localhost:8000/api/v1`.

## Workspace permissions

Workspace roles have separate database-backed module grants (`modules.<module>.access`) and action grants (for example, `tasks.create`). The Roles & Permissions editor manages both. Module grants control navigation and route access; action grants continue to control operations within an enabled module. Effective grants combine role permissions and direct user permissions. Platform Super Admin access remains on its separate platform flow.

## What this mirrors from the backend

- Every `types/*.ts` file mirrors a `app/modules/<module>/schema.py` 1:1 (Base/Create/Update/Read split preserved).
- Every `lib/api/*.ts` file mirrors a `app/modules/<module>/router.py`'s actual routes and prefixes exactly,
  including two quirks kept intentional (matching backend logic, not "fixed"):
  - `POST /auth/login` requires `application/x-www-form-urlencoded` (OAuth2PasswordRequestForm), not JSON —
    handled in `lib/api/auth.ts`.
  - `/kanban/tasks/{task_id}` actually does a primary-key lookup on `kanban_task_id`, not the real task's
    `task_id` — documented with a warning comment in `lib/api/kanban.ts`. Always pass the `kanban_task_id`
    from a `KanbanTaskRead`, not `task.task_id`.
- `lib/constants.ts` mirrors every `app/modules/<module>/constants.py` enum tuple exactly (status/priority
  string values sent to the backend must match verbatim).

## Build progress

**Done:**
- Project scaffold (Next.js, Tailwind, TypeScript configs)
- Design tokens matching the approved UI mockups (indigo/violet primary, lavender sidebar-active state)
- All 18 modules' TypeScript types (`src/types/`)
- All 18 modules' API clients (`src/lib/api/`), plus a shared CRUD factory
- Axios client with JWT attach + silent refresh-token-on-401
- Zustand auth store + React Query provider + auth bootstrap provider
- Route-protection middleware
- `useAuth` hook (login/register/logout)
- shadcn/ui primitives: Button, Input, Label, Card, Badge, Avatar, Dialog, DropdownMenu

**Next up (continuing module by module):**
- Remaining shadcn/ui primitives (Select, Tabs, Table, Separator, Progress, Checkbox, Textarea, Toast wiring, Tooltip, Popover, Skeleton, Alert Dialog, Scroll Area)
- Dashboard shell: Sidebar + Header (matching the mockup exactly)
- Auth pages: login, register, forgot-password, reset-password
- Dashboard home page
- Then one module at a time: Projects → Tasks → Teams → Kanban → Gantt → Milestones → Calendar →
  Documentation → Workflow → Reports → Notifications → Roles → Users → 5 AI modules → Settings

## Folder structure

See the folder-structure explanation given alongside this project for the full rationale behind each directory.
