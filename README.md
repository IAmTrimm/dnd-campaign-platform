# D&D Campaign Platform

A small personal website for running our D&D campaign. Built with React, Vite, TypeScript and Tailwind CSS.

## Getting started

You need [Node.js](https://nodejs.org/) (version 20 or newer) installed.

```bash
npm install      # first time only: installs dependencies
npm run dev      # starts the site at http://localhost:5173
```

Open http://localhost:5173 in your browser. Changes to the code appear automatically. Press `Ctrl+C` in the terminal to stop.

## Other commands

| Command           | What it does                                    |
| ----------------- | ----------------------------------------------- |
| `npm run build`   | Checks types and builds the site into `dist/`   |
| `npm run preview` | Serves the built `dist/` folder locally         |
| `npm run lint`    | Checks the code for common mistakes             |

## Folder structure

```
src/
  components/   Reusable UI pieces (layout/ holds the nav bar and page frame)
  config/       Site settings, e.g. the navigation sections
  hooks/        Small reusable React hooks (e.g. page routing)
  pages/        One component per page
  index.css     Tailwind setup and the fantasy theme colours/fonts
```

To add a navigation section, add an entry to `src/config/navigation.ts`.
