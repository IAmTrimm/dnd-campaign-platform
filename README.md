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
  features/     Larger sections with their own components and data (e.g. codex/)
  hooks/        Small reusable React hooks (e.g. page routing)
  pages/        One component per simple page
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

## Player accounts (DM only)

Players sign in with a username and password. There is no public sign-up; the DM creates accounts on their own computer:

```bash
node scripts/accounts.mjs create aria "Aria Vel'dran"   # new account; password copied to clipboard
node scripts/accounts.mjs reset-password aria            # new password; copied to clipboard
node scripts/accounts.mjs list                           # show all accounts
node scripts/accounts.mjs campaigns                      # show campaigns and their members
node scripts/accounts.mjs add-member aria "The Campaign Name"        # add as a player
node scripts/accounts.mjs add-member aria "The Campaign Name" dm     # add (or promote) as a DM
node scripts/accounts.mjs remove-member aria "The Campaign Name"
node scripts/auth-smoke-test.mjs                         # test login end to end with a temporary account
node scripts/access-test.mjs                             # test who can see/change what, with temporary data
node scripts/codex-test.mjs                              # test Codex visibility rules, with temporary data
```

These scripts need the Supabase **secret** key in `scripts/.env.local` (`SUPABASE_SECRET_KEY=...`). That file is ignored by Git. Never commit it or put the secret key anywhere in `src/`.

Behind the scenes, a username like `aria` is stored as `aria@dnd-campaign-platform.invalid`. The `.invalid` domain is reserved and can never receive email. Accounts created with a real email (such as the original DM account) can sign in with that email instead.
