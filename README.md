# D&D Campaign Platform

A small personal website for running our D&D campaign. Built with React, Vite, TypeScript and Tailwind CSS.

## Getting started

You need [Node.js](https://nodejs.org/) (version 20 or newer) installed.

```bash
npm install      # first time only: installs dependencies
npm run dev      # starts the site at http://localhost:5173/dnd-campaign-platform/
```

Open http://localhost:5173/dnd-campaign-platform/ in your browser. Changes to the code appear automatically. Press `Ctrl+C` in the terminal to stop.

## Live site

The site is published at https://iamtrimm.github.io/dnd-campaign-platform/

Every push to the `main` branch automatically rebuilds and redeploys it (see `.github/workflows/deploy.yml`). You can follow progress on the repository's **Actions** tab.

## Other commands

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `npm run build`   | Checks types and builds the site into `dist/`   |
| `npm run preview` | Serves the built `dist/` folder locally         |
| `npm run lint`    | Checks the code for common mistakes             |

## Folder structure

```
src/
  components/   Reusable UI pieces (layout/ = sidebar and page frame, ui/ = panels etc.)
  config/       Site settings, e.g. the navigation sections
  hooks/        Small reusable React hooks (e.g. page routing)
  pages/        One component per page
  index.css     Tailwind setup and the fantasy theme colours/fonts
```

To add a navigation section, add an entry to `src/config/navigation.ts`.

## Database (Supabase)

Migrations are in `supabase/migrations/`, explained in [docs/data-model.md](docs/data-model.md). They are applied to the live project with the Supabase CLI, never automatically from GitHub:

```bash
npx supabase@2.120.0 login                                      # once per computer (browser sign-in)
npx supabase@2.120.0 link --project-ref hjzslqjqgbaqqqoypjln    # once per checkout
npx supabase@2.120.0 db push --dry-run                          # preview what would change
npx supabase@2.120.0 db push                                    # apply
```

On Windows PowerShell, use `npx.cmd` instead of `npx`. Never use `db reset` against the live project.
