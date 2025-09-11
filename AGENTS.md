# Repository Guidelines

## Project Structure & Modules
- `src/app`: Next.js App Router pages (`page.tsx`), layouts, and API routes (`api/*/route.ts`).
- `src/app/components` and `components/ui`: Reusable React components (PascalCase files).
- `src/app/lib` and `lib/*`: Business logic, validation, engines, and clients (TypeScript modules).
- `public`: Static assets. `docs/`: supplemental documentation. `scripts/`: local utilities (e.g., engine checks).
- Styling: Tailwind tokens in `src/app/globals.css`; config in `tailwind.config.ts`.

## Build, Test, and Dev Commands
- `npm run dev`: Start the Next.js dev server at `http://localhost:3000`.
- `npm run dev:clean`: Remove `.next/.turbo` and run dev fresh.
- `npm run build`: Production build.
- `npm start`: Serve the production build.
- `npm run lint`: ESLint (Next.js config).
- Engine checks: in one terminal run `NEXT_PUBLIC_PROSPER_ENGINE=v2 npm run dev`; in another run `npm run engine:test`.

## Coding Style & Naming
- Language: TypeScript + React 19 + Next.js 15 (App Router).
- Linting: ESLint (`eslint.config.mjs`). Aim for zero warnings before PR.
- Indentation: 2 spaces; prefer explicit types for exported functions.
- Naming: Components `PascalCase` (e.g., `TopVoiceControls.tsx`); functions/vars `camelCase`; route folders `kebab-case`; API handlers use `route.ts`.
- Tailwind: Use semantic utility groups; prefer tokens defined in `globals.css`.

## Testing Guidelines
- Framework: No unit test harness is bundled yet. Use `npm run engine:test` to assert engine scenarios against `/api/dev/engine-v2`.
- Local flow: start dev with `NEXT_PUBLIC_PROSPER_ENGINE=v2`, then run the engine test script.
- Suggested pattern (when adding tests): colocate `*.test.ts(x)` near modules or under `src/__tests__`.

## Commit & PR Guidelines
- Commits: Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`). Use imperative mood and keep scope small.
- PRs must include: concise description, linked issues, screenshots/GIFs for UI changes, testing steps, and any env/config notes.
- Keep diffs focused; run `npm run lint` before requesting review.

## Security & Configuration
- Secrets: Never commit `.env`. Use `.env.sample` as reference. Required keys include `OPENAI_API_KEY`, Supabase, and Stripe variables (see README).
- Realtime keys: `/api/session` issues ephemeral OpenAI keys; keep server-side keys private and respect same-origin checks.
- Guardrails: Output moderation is handled in `src/app/App.tsx` (search `guardrail_tripped`).

