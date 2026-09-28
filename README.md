# GreenCode

GreenCode analyzes public GitHub repositories and estimates environmental impact from repository configuration, infrastructure assumptions, and grid-intensity data. Results are estimates, not measurements of real-world emissions.

## What it does

- Scans public GitHub repository metadata, languages, dependency manifests, Docker files, and infrastructure configuration.
- Calculates a deterministic Code Carbon Score and estimated energy/emissions from documented assumptions.
- Uses Electricity Maps live intensity when `CARBON_API_KEY` is configured; otherwise uses a labeled annual-average fallback dataset.
- Displays repository insights, score breakdown, carbon estimate, region comparison, and exactly three recommendations.
- Includes an isolated demo analysis that does not call GitHub or save a result as a real analysis.

## Step-by-step: run locally

### 1. Install prerequisites

Install Git and Node.js 20.19+ or 22.12+ (npm is included with Node.js).

### 2. Clone the repository

```sh
git clone https://github.com/sahanish68/prompt-whisperer-ai-10.git
cd prompt-whisperer-ai-10
npm install
```

### 3. Create the local environment file

In PowerShell, run:

```powershell
Copy-Item .env.example .env
```

If `.env` already exists, edit it instead of replacing it. It is ignored by Git and should remain local.

### 4. Connect Supabase

In Supabase, open your project and find **Project Settings → API**. Copy the **Project URL** and **Publishable key** into `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

The `VITE_` values are included in browser code, so only use the Supabase publishable key there. Do not use a service-role key. Analysis saving uses the publishable key and the `analyses` table's row-level security policies.

If the `analyses` table does not exist yet, open the Supabase **SQL Editor** and run the contents of [`drizzle/migrations/0000_create_greencode_analyses.sql`](drizzle/migrations/0000_create_greencode_analyses.sql) once.

### 5. Start the application

```sh
npm run dev
```

Open the local URL printed in the terminal (usually `http://localhost:8080`).

### 6. Analyze a repository

Paste a public GitHub repository URL, such as `https://github.com/vercel/next.js`, then select **Analyze Repository**. The app scans the repository and opens its analysis dashboard. Select **View Demo** to open the local demo analysis instead; it is labeled **Demo data**.

### 7. Run checks

```sh
npm test
npm run build
```

## Step-by-step: deploy to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. Keep the build command as `npm run build`. The Nitro adapter is configured for Vercel; no separate `vercel.json` is needed.
3. In Vercel, open **Project Settings → Environment Variables**.
4. Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. Use the values from the connected Supabase project's API settings.
5. Apply the database migration if the `analyses` table has not already been created.
6. Redeploy after adding or changing environment variables.

Add these optional server-side variables only if needed:

- `GITHUB_TOKEN`: a GitHub token for higher API rate limits. The analyzer only needs public repository access.
- `CARBON_API_KEY`: an Electricity Maps API key for live carbon-intensity data. Without it, GreenCode uses its labeled annual-average fallback.

## Environment variables

| Variable                        | Required | Purpose                                                  |
| ------------------------------- | -------- | -------------------------------------------------------- |
| `SUPABASE_URL`                  | Yes      | Supabase project URL for server operations               |
| `SUPABASE_PUBLISHABLE_KEY`      | Yes      | Supabase publishable key used server-side with RLS       |
| `VITE_SUPABASE_URL`             | Yes      | Supabase project URL used by the browser                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes      | Publishable key used by the browser; safe for client use |
| `GITHUB_TOKEN`                  | No       | Raises GitHub API rate limits                            |
| `CARBON_API_KEY`                | No       | Enables live Electricity Maps grid intensity             |

`SUPABASE_PROJECT_ID` is not currently required by the application. Never put a secret, such as a Supabase service-role key, in a `VITE_` variable.

## Available endpoints

- `GET /api/public/health`: service health check.
- `GET /api/public/regions`: supported regions and fallback-data disclaimer.
- Repository analysis and retrieval use the app's TanStack Start server functions and stored analysis IDs; this version does not expose the prompt's separate `/api/analyze` REST endpoint.

## Estimation and limitations

Energy is estimated from runtime-specific CPU time per request, declared CPU/memory when detected, fixed network/storage overhead assumptions, and a region PUE assumption. Estimated emissions are energy multiplied by grid intensity in gCO2e/kWh. The score combines infrastructure, dependency, container, deployment, and regional sub-scores; the dashboard shows their weights and explanations.
