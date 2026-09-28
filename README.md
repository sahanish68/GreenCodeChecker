# GreenCode

GreenCode analyzes public GitHub repositories and estimates environmental impact from repository configuration, infrastructure assumptions, and grid-intensity data. Estimates are not measurements of real-world emissions.

## Local development

Use Node.js 20.19+ or 22.12+, and npm.

```sh
npm install
```

Copy `.env.example` to `.env` and fill in the Supabase project URL and publishable key. The `VITE_` versions are used by the browser; the unprefixed versions are used by server code. Never put secret keys behind a `VITE_` name.

```sh
npm run dev
```

Run the focused tests and production build with:

```sh
npm test
npm run build
```

## Vercel deployment

Import this repository into Vercel and deploy with the default build command, `npm run build`. The Nitro adapter is configured for Vercel. Add the four required Supabase variables from `.env.example` in **Project Settings → Environment Variables** for Development, Preview, and Production as needed, then redeploy. Optional `GITHUB_TOKEN` and `CARBON_API_KEY` values can also be configured there.

The Supabase `analyses` table migration is in `drizzle/migrations/`. Apply it to the connected Supabase project before using repository analysis. Public analysis inserts and reads are controlled by that table's row-level security policies.
