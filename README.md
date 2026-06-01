# Flow

A personal task / project board + scheduler PWA, installable to your iPhone home
screen. Frosted-glass iOS aesthetic, a Kanban board as the main view, and a
lightweight schedule view. Built with **React + Vite**, **Supabase** (data + auth),
and **vite-plugin-pwa** (installable + offline).

The visual design follows `kanban-app.html` (the original prototype, kept in the
repo for reference).

---

## Running it on your computer

You only need to do step 1 once.

1. **Install the dependencies** (downloads the building blocks the app needs):
   ```bash
   npm install
   ```

2. **Start the app:**
   ```bash
   npm run dev
   ```
   This prints a line like `Local: http://localhost:5173/`. Open that address in
   your browser. To stop the app, press `Ctrl + C` in the terminal.

The Supabase connection values live in a file called `.env` (already created for
you). That file is intentionally **not** committed to git, so your keys stay
private.

---

## Logging in

Flow uses **passwordless email magic links**:

1. Enter your email on the login screen and tap **Send magic link**.
2. Open the email and click the link **on the same device**. You're in.
3. Your data is tied to your account, so logging in on any device shows the same
   board.

> **One-time Supabase setting:** In the Supabase dashboard go to
> **Authentication → URL Configuration** and add your app's addresses to
> **Redirect URLs**, e.g. `http://localhost:5173` (for local dev) and your
> deployed URL (e.g. `https://flow-xyz.vercel.app`). Also set **Site URL** to your
> deployed URL. Without this, the magic-link click may be rejected.

---

## The database

Two tables in Supabase, both protected by **Row Level Security** so each account
can only ever see and edit its own rows:

- **`columns`** — the Kanban lists (To Do, In Progress, Done, …).
- **`tasks`** — the cards.

These tables and their security policies are already created in your Supabase
project. The exact SQL is saved in [`supabase/schema.sql`](./supabase/schema.sql)
for reference (you don't need to run it again).

The three starter columns (To Do / In Progress / Done) are created automatically
the first time you log in.

### The "dump" workflow (connecting Claude directly to Supabase)

You can paste a messy brain-dump into a Claude chat that's connected to this
Supabase project and have it write tasks straight into the `tasks` table. A task
row only needs four things to be valid:

- `title` (text)
- `column_id` (the UUID of the list it belongs to — usually your "To Do" column)
- `user_id` (your account's UUID — `auth.uid()`)
- `position` (an integer for ordering within the column)

Everything else (`priority`, `due_date`, `notes`) is optional with sensible
defaults (`priority` defaults to `med`).

**How to set `position`:** append new tasks to the end of the target column. Find
the current highest position in that column and add 1:

```sql
insert into tasks (user_id, column_id, title, position)
select
  '<your-user-id>',
  '<to-do-column-id>',
  'Buy milk',
  coalesce(max(position) + 1, 0)
from tasks
where column_id = '<to-do-column-id>';
```

Dumped tasks appear in the app on the next refresh (and live, if it's open).

---

## Installing on your iPhone

1. Deploy the app (see below) so you have a public `https://` URL.
2. Open that URL in **Safari** on your iPhone.
3. Tap the **Share** button → **Add to Home Screen**.
4. Launch it from the home screen — it opens fullscreen, no Safari chrome.

---

## Deploying (free)

Either Vercel or Netlify works. **Vercel** is the simplest:

1. Push this repo to GitHub (already set up).
2. Go to [vercel.com](https://vercel.com), "Add New Project", import the repo.
3. Framework preset: **Vite**. Build command `npm run build`, output dir `dist`
   (Vercel detects these automatically).
4. Add the two environment variables (same as your `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Copy the resulting URL into Supabase's Redirect URLs / Site URL (see
   the login section above).

---

## Project layout

```
index.html              app shell + iOS meta tags + fonts + background blobs
vite.config.js          Vite + PWA (manifest, service worker, offline cache)
scripts/gen-icons.mjs   regenerates the app icons (npm run icons)
public/                 generated PWA icons
supabase/schema.sql     reference copy of the database schema + RLS policies
src/
  main.jsx              entry point
  App.jsx               session handling + layout + view switching
  index.css             all styling (ported from the prototype)
  lib/supabase.js       Supabase client
  lib/format.js         priority styles + due-date helpers
  hooks/useFlowData.js  load/seed data, realtime sync, all CRUD + reordering
  components/
    Auth.jsx            magic-link login
    Board.jsx           drag-and-drop Kanban board
    Column.jsx          a single list
    Card.jsx            a single card
    Sheet.jsx           reusable slide-up sheet
    EditSheet.jsx       add/edit/delete a task
    ColumnSheet.jsx     add/rename/recolour/reorder/delete a list
    AccountSheet.jsx    account info + sign out
    CalendarView.jsx    schedule view (tasks grouped by due date)
```
