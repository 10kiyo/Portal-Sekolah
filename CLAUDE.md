# Project Rules for Claude

## Project Context & Architecture
- Workspace: Portal Sekolah / Cloudflare Workers project.
- Backend/Edge: Cloudflare Workers (configured via `wrangler.jsonc`) & Supabase.
- Frontend: HTML, Vanilla JavaScript (`modul-*.js`), & CSS inside `/public`.

## Commands
- Dev: `npx wrangler dev`
- Deploy: `npx wrangler deploy`

## Code Style & Conventions
- Avoid adding unnecessary npm build tools or frameworks unless requested.
- Modular JS: Logic is split into functional modules (e.g., `modul-bk.js`, `modul-staf.js`).
- Database: Use Supabase client directly in client JS or Worker routes.

## Response Preferences (Save Tokens)
- Skip CoT (Chain of Thought) summaries, intro text, or unnecessary pleasantries.
- Provide targeted code snippets or diffs only. Do not rewrite unchanged files.
- Keep responses compact and direct to the code.