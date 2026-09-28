import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  analyzeContainer,
  analyzeDependencies,
  analyzeInfrastructure,
  buildRecommendations,
  buildScore,
  estimateCarbon,
  type FileMap,
} from "./engine";
import { parseRepoUrl } from "./github";
import type { AnalysisResult, RepositoryInfo } from "./types";

export { parseRepoUrl } from "./github";

const INTERESTING = [
  "package.json", "requirements.txt", "pyproject.toml", "Pipfile", "pom.xml",
  "build.gradle", "build.gradle.kts", "go.mod", "Cargo.toml", "Dockerfile",
  "docker-compose.yml", "docker-compose.yaml", "compose.yaml", "serverless.yml",
  "serverless.yaml", "vercel.json", "netlify.toml", "fly.toml", "cdk.json",
  "app.yaml", "CMakeLists.txt", "Makefile",
];

function isInteresting(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  if (INTERESTING.includes(base)) return true;
  if (/^Dockerfile(\..+)?$/i.test(base)) return true;
  if (base.endsWith(".tf") || base.endsWith(".tfvars")) return true;
  if (/\.(ya?ml)$/i.test(base) && /(k8s|kube|deploy|infra|manifest|chart|cloudformation|template|stack)/i.test(path)) return true;
  return false;
}

export const analyzeRepository = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ url: z.string().min(5) }).parse(input))
  .handler(async ({ data }): Promise<{ id: string; analysis: AnalysisResult }> => {
    const { owner, name, branch: requestedBranch } = parseRepoUrl(data.url);

    const token = process.env["GITHUB_TOKEN"];
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "GreenCode-Analyzer",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const gh = async (path: string) => {
      let res: Response;
      try {
        res = await fetch(`https://api.github.com${path}`, {
          headers,
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error("GitHub did not respond in time. Please try again.");
        }
        throw new Error("Could not reach GitHub. Check your connection and try again.");
      }
      if (res.status === 404) throw new Error("Repository not found. GreenCode supports public GitHub repositories.");
      if (res.status === 403) throw new Error("GitHub rate limit reached. Please try again in a few minutes.");
      if (!res.ok) throw new Error(`GitHub request failed (${res.status}).`);
      return res.json();
    };

    const repo = (await gh(`/repos/${owner}/${name}`)) as {
      default_branch: string; description: string | null; stargazers_count: number; size: number;
    };
    const branch = requestedBranch ?? repo.default_branch;

    const langRaw = (await gh(`/repos/${owner}/${name}/languages`)) as Record<string, number>;
    const langTotal = Object.values(langRaw).reduce((a, b) => a + b, 0) || 1;
    const languages = Object.entries(langRaw)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([n, bytes]) => ({ name: n, percent: Math.round((bytes / langTotal) * 1000) / 10 }));

    const tree = (await gh(`/repos/${owner}/${name}/git/trees/${encodeURIComponent(branch)}?recursive=1`)) as {
      sha: string;
      tree: { path: string; type: string }[];
      truncated?: boolean;
    };
    const paths = (tree.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);

    const targets = paths.filter(isInteresting).slice(0, 25);
    const files: FileMap = {};
    await Promise.all(
      targets.map(async (p) => {
        try {
          const res = await fetch(
            `https://raw.githubusercontent.com/${owner}/${name}/${encodeURIComponent(branch)}/${p.split("/").map(encodeURIComponent).join("/")}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (!res.ok) return;
          const text = await res.text();
          if (text.length < 200_000) files[p] = text;
        } catch {
          /* unreadable file is simply skipped */
        }
      }),
    );

    const repository: RepositoryInfo = {
      url: `https://github.com/${owner}/${name}`,
      owner,
      name,
      branch,
      commitSha: tree.sha ?? null,
      description: repo.description,
      stars: repo.stargazers_count,
      sizeKb: repo.size,
      languages,
      fileCount: paths.length,
    };

    const dependencies = analyzeDependencies(files);
    const container = analyzeContainer(files, paths);
    const infrastructure = analyzeInfrastructure(files, paths, languages);

    const { getCurrentIntensity } = await import("./carbon-intensity.server");
    const intensity = await getCurrentIntensity(infrastructure.region);

    const carbon = estimateCarbon(
      infrastructure,
      container,
      dependencies,
      intensity.intensity,
      intensity.source,
      intensity.isLive,
      intensity.region.pue,
    );
    const score = buildScore(infrastructure, dependencies, container, carbon);
    const recommendations = buildRecommendations(infrastructure, dependencies, container, carbon);

    const partial = {
      repository,
      dependencies,
      container,
      infrastructure,
      carbon,
      score,
      recommendations,
      detectedFiles: Object.keys(files),
    };

    const { analysisStore } = await import("./analysis-store.server");
    const { data: row, error } = await analysisStore
      .from("analyses")
      .insert({
        github_url: repository.url,
        owner,
        name,
        branch,
        commit_sha: repository.commitSha,
        cloud_provider: infrastructure.cloudProvider,
        region: infrastructure.region,
        carbon_score: score.total,
        estimated_energy_kwh: carbon.energyKwh,
        estimated_emissions_g: carbon.emissionsG,
        carbon_intensity: carbon.intensity,
        languages: languages as unknown as Record<string, unknown>,
        result: partial as unknown as Record<string, unknown>,
      })
      .select("id, created_at")
      .single();

    if (error || !row) throw new Error("Analysis completed but could not be saved. Please try again.");

    return { id: row.id, analysis: { id: row.id, createdAt: row.created_at, ...partial } };
  });
