/**
 * GreenCode deterministic analysis engine.
 *
 * Every number produced here comes from an explicit, documented heuristic.
 * No randomness, no model-generated figures.
 */
import { findRegion, REGIONS, type CloudProvider } from "./regions";
import type {
  CarbonReport,
  ContainerReport,
  DependencyReport,
  DockerFinding,
  InfrastructureReport,
  Recommendation,
  RepositoryInfo,
  ScoreReport,
} from "./types";

export type FileMap = Record<string, string>;

const HEAVY_FRAMEWORKS = [
  "next", "nuxt", "gatsby", "angular", "@angular/core", "webpack", "electron",
  "puppeteer", "playwright", "tensorflow", "torch", "pandas", "scipy",
  "opencv-python", "selenium", "spring-boot-starter", "babel-cli", "moment",
];

const REDUNDANT_GROUPS: { label: string; members: string[] }[] = [
  { label: "date libraries", members: ["moment", "dayjs", "date-fns", "luxon"] },
  { label: "HTTP clients", members: ["axios", "request", "got", "node-fetch", "superagent"] },
  { label: "utility libraries", members: ["lodash", "underscore", "ramda"] },
  { label: "bundlers", members: ["webpack", "rollup", "parcel", "esbuild", "vite"] },
  { label: "test runners", members: ["jest", "mocha", "jasmine", "ava", "vitest"] },
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/* ------------------------------------------------------------------ */
/* Dependency analysis                                                  */
/* ------------------------------------------------------------------ */

export function analyzeDependencies(files: FileMap): DependencyReport {
  const ecosystems: DependencyReport["ecosystems"] = [];
  let production = 0;
  let development = 0;
  const names: string[] = [];

  for (const [path, content] of Object.entries(files)) {
    const base = path.split("/").pop() ?? path;
    try {
      if (base === "package.json") {
        const pkg = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const prod = Object.keys(pkg.dependencies ?? {});
        const dev = Object.keys(pkg.devDependencies ?? {});
        production += prod.length;
        development += dev.length;
        names.push(...prod, ...dev);
        ecosystems.push({ ecosystem: "npm", file: path, count: prod.length + dev.length });
      } else if (base === "requirements.txt") {
        const lines = content
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#") && !l.startsWith("-"));
        production += lines.length;
        names.push(...lines.map((l) => l.split(/[=<>!~\[ ]/)[0]!.toLowerCase()));
        ecosystems.push({ ecosystem: "pip", file: path, count: lines.length });
      } else if (base === "pyproject.toml" || base === "Pipfile") {
        const section = content.split(/\[(tool\.poetry\.)?dependencies\]/i)[2] ?? "";
        const lines = section.split("\n").filter((l) => /^[A-Za-z0-9_.-]+\s*=/.test(l.trim()));
        production += lines.length;
        names.push(...lines.map((l) => l.trim().split(/\s*=/)[0]!.toLowerCase()));
        ecosystems.push({ ecosystem: "python", file: path, count: lines.length });
      } else if (base === "go.mod") {
        const count = (content.match(/^\s+[a-z0-9./-]+\s+v\d/gm) ?? []).length;
        production += count;
        ecosystems.push({ ecosystem: "go", file: path, count });
      } else if (base === "Cargo.toml") {
        const section = content.split(/\[dependencies\]/)[1]?.split(/\n\[/)[0] ?? "";
        const count = section.split("\n").filter((l) => /^[A-Za-z0-9_-]+\s*=/.test(l.trim())).length;
        production += count;
        ecosystems.push({ ecosystem: "cargo", file: path, count });
      } else if (base === "pom.xml") {
        const count = (content.match(/<dependency>/g) ?? []).length;
        production += count;
        names.push(...(content.match(/<artifactId>([^<]+)<\/artifactId>/g) ?? []).map((m) => m.replace(/<\/?artifactId>/g, "")));
        ecosystems.push({ ecosystem: "maven", file: path, count });
      } else if (base === "build.gradle" || base === "build.gradle.kts") {
        const count = (content.match(/^\s*(implementation|api|compile|testImplementation)\s/gm) ?? []).length;
        production += count;
        ecosystems.push({ ecosystem: "gradle", file: path, count });
      }
    } catch {
      /* malformed manifest — skipped, never fabricated */
    }
  }

  const total = production + development;
  const lower = names.map((n) => n.toLowerCase());
  const heavyFrameworks = HEAVY_FRAMEWORKS.filter((f) => lower.includes(f));
  const possibleRedundancies = REDUNDANT_GROUPS.filter(
    (g) => g.members.filter((m) => lower.includes(m)).length > 1,
  ).map((g) => `${g.label}: ${g.members.filter((m) => lower.includes(m)).join(", ")}`);

  // Transparent scoring: start at 100, subtract for size and redundancy.
  const reasons: string[] = [];
  let score = 100;
  const sizePenalty = Math.min(40, Math.round(total / 4));
  if (sizePenalty > 0) {
    score -= sizePenalty;
    reasons.push(`${total} declared dependencies (-${sizePenalty})`);
  }
  const prodPenalty = Math.min(20, Math.max(0, Math.round((production - 15) / 3)));
  if (prodPenalty > 0) {
    score -= prodPenalty;
    reasons.push(`${production} production dependencies ship at runtime (-${prodPenalty})`);
  }
  if (heavyFrameworks.length) {
    const p = Math.min(15, heavyFrameworks.length * 4);
    score -= p;
    reasons.push(`heavy packages detected: ${heavyFrameworks.join(", ")} (-${p})`);
  }
  if (possibleRedundancies.length) {
    const p = possibleRedundancies.length * 5;
    score -= p;
    reasons.push(`overlapping libraries for ${possibleRedundancies.length} concern(s) (-${p})`);
  }
  if (reasons.length === 0) reasons.push("Low dependency count with no detected overlap");

  return {
    total,
    production,
    development,
    ecosystems,
    heavyFrameworks,
    possibleRedundancies,
    score: clamp(score),
    reasons,
  };
}

/* ------------------------------------------------------------------ */
/* Container analysis                                                   */
/* ------------------------------------------------------------------ */

const LARGE_BASE_IMAGES = ["ubuntu", "debian", "centos", "fedora", "node:latest", "python:3", "openjdk"];

export function analyzeContainer(files: FileMap, paths: string[]): ContainerReport {
  const dockerfiles = Object.entries(files).filter(([p]) => /(^|\/)Dockerfile/i.test(p));
  const findings: DockerFinding[] = [];
  const baseImages: string[] = [];
  let multiStage = false;
  const hasDockerignore = paths.some((p) => p.endsWith(".dockerignore"));
  const containerized =
    dockerfiles.length > 0 || paths.some((p) => /docker-compose\.ya?ml|compose\.ya?ml/i.test(p));

  for (const [path, content] of dockerfiles) {
    const froms = content.match(/^\s*FROM\s+([^\s]+)/gim) ?? [];
    froms.forEach((f) => baseImages.push(f.replace(/^\s*FROM\s+/i, "")));
    if (froms.length > 1) multiStage = true;

    const img = baseImages.join(" ").toLowerCase();
    if (LARGE_BASE_IMAGES.some((b) => img.includes(b)) && !img.includes("slim") && !img.includes("alpine")) {
      findings.push({ id: "base-image", title: "Large base image", impact: "High", file: path, detail: `Base image ${baseImages[0]} is a full OS image. Slim or Alpine variants ship far fewer packages to build, pull and run.` });
    }
    if (froms.length === 1 && /(npm\s+(ci|install)|pip\s+install|go\s+build|mvn\s+package|cargo\s+build)/i.test(content)) {
      findings.push({ id: "multi-stage", title: "No multi-stage build", impact: "High", file: path, detail: "Build tooling and build-time dependencies stay in the final image, so every deploy pulls and runs more than production needs." });
    }
    if (/apt-get\s+install/i.test(content) && !/rm\s+-rf\s+\/var\/lib\/apt\/lists/i.test(content)) {
      findings.push({ id: "apt-cache", title: "Package cache not cleaned", impact: "Medium", file: path, detail: "apt-get install runs without clearing /var/lib/apt/lists, leaving cache data in the image layer." });
    }
    if (/^\s*COPY\s+\.\s+/im.test(content) && !hasDockerignore) {
      findings.push({ id: "copy-all", title: "COPY . without .dockerignore", impact: "Medium", file: path, detail: "The whole working directory is copied into the image and no .dockerignore limits it." });
    }
    if (/:latest/i.test(content)) {
      findings.push({ id: "latest-tag", title: "Floating :latest tag", impact: "Low", file: path, detail: "A :latest base image makes rebuilds non-reproducible and can silently pull a much larger image." });
    }
    if (!/^\s*USER\s+/im.test(content)) {
      findings.push({ id: "root-user", title: "Container runs as root", impact: "Low", file: path, detail: "No USER instruction found; this is a hardening gap rather than an efficiency one." });
    }
  }

  let score = 100;
  if (!containerized) {
    score = 70; // unknown deployment shape — neither rewarded nor heavily punished
  } else {
    for (const f of findings) score -= f.impact === "High" ? 15 : f.impact === "Medium" ? 9 : 4;
    if (multiStage) score += 5;
    if (hasDockerignore) score += 3;
  }

  return { containerized, baseImages, multiStage, hasDockerignore, findings, score: clamp(score) };
}

/* ------------------------------------------------------------------ */
/* Infrastructure + region detection                                    */
/* ------------------------------------------------------------------ */

const AWS_REGION_RE = /\b(us|eu|ap|sa|ca|me|af)-(east|west|central|north|south|northeast|southeast|northwest|southwest)-\d\b/g;

export function analyzeInfrastructure(
  files: FileMap,
  paths: string[],
  languages: RepositoryInfo["languages"],
): InfrastructureReport {
  const tools: string[] = [];
  const has = (re: RegExp) => paths.some((p) => re.test(p));

  if (has(/\.tf$/)) tools.push("Terraform");
  if (has(/serverless\.ya?ml$/)) tools.push("Serverless Framework");
  if (has(/(^|\/)(k8s|kubernetes|manifests|charts)\//i) || Object.values(files).some((c) => /apiVersion:\s*apps\/v1/.test(c))) tools.push("Kubernetes");
  if (Object.values(files).some((c) => /AWSTemplateFormatVersion/.test(c))) tools.push("CloudFormation");
  if (has(/cdk\.json$/)) tools.push("AWS CDK");
  if (has(/docker-compose\.ya?ml$|compose\.ya?ml$/)) tools.push("Docker Compose");
  if (has(/vercel\.json$/)) tools.push("Vercel");
  if (has(/netlify\.toml$/)) tools.push("Netlify");
  if (has(/fly\.toml$/)) tools.push("Fly.io");
  if (has(/\.github\/workflows\//)) tools.push("GitHub Actions");

  const blob = Object.values(files).join("\n");

  let provider: CloudProvider = "Unknown";
  if (/aws_|amazonaws|AWSTemplateFormatVersion|aws-sdk|boto3/i.test(blob) || tools.includes("AWS CDK")) provider = "AWS";
  else if (/google_|gcp|cloud\.google\.com|gcloud/i.test(blob)) provider = "GCP";
  else if (/azurerm|azure|microsoft\.web/i.test(blob)) provider = "Azure";

  let region: string | null = null;
  let regionSource = "Not found in repository configuration";
  const awsMatch = blob.match(AWS_REGION_RE);
  if (awsMatch?.length) {
    const counts = new Map<string, number>();
    awsMatch.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
    region = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    regionSource = "Region string found in infrastructure configuration";
    if (provider === "Unknown") provider = "AWS";
  } else {
    const known = REGIONS.find((r) => r.provider !== "AWS" && blob.includes(r.id));
    if (known) {
      region = known.id;
      provider = known.provider;
      regionSource = "Region string found in infrastructure configuration";
    }
  }

  const kubernetes = tools.includes("Kubernetes");
  const serverless = tools.includes("Serverless Framework") || /lambda|cloud function|cloudflare worker/i.test(blob);

  const topLang = languages[0]?.name ?? "Unknown";
  const runtime =
    /node|javascript|typescript/i.test(topLang) ? "Node.js" :
    /python/i.test(topLang) ? "Python" :
    /go/i.test(topLang) ? "Go" :
    /rust/i.test(topLang) ? "Rust" :
    /java|kotlin/i.test(topLang) ? "JVM" : topLang;

  const database =
    /postgres|postgis/i.test(blob) ? "PostgreSQL" :
    /mysql|mariadb/i.test(blob) ? "MySQL" :
    /mongodb|mongoose/i.test(blob) ? "MongoDB" :
    /redis/i.test(blob) ? "Redis" :
    /sqlite/i.test(blob) ? "SQLite" : null;

  const cpuMatch = blob.match(/cpu:\s*"?(\d+(?:\.\d+)?)(m)?"?/i);
  const cpuAllocation = cpuMatch
    ? cpuMatch[2] === "m" ? Number(cpuMatch[1]) / 1000 : Number(cpuMatch[1])
    : serverless ? 0.5 : 1;
  const memMatch = blob.match(/memory:\s*"?(\d+)(Mi|Gi|MB|GB)"?/i);
  const memoryGb = memMatch
    ? /Mi|MB/i.test(memMatch[2]!) ? Number(memMatch[1]) / 1024 : Number(memMatch[1])
    : null;

  const findings: DockerFinding[] = [];
  let score = 70;
  if (tools.length) { score += 8; }
  if (tools.includes("Terraform") || tools.includes("CloudFormation") || tools.includes("AWS CDK")) score += 6;
  if (serverless) { score += 8; }
  if (region) score += 6;
  else findings.push({ id: "no-region", title: "No deployment region declared", impact: "Medium", file: "infrastructure config", detail: "No cloud region was found, so a global average grid intensity is used for the estimate." });
  if (kubernetes && !memMatch) {
    score -= 8;
    findings.push({ id: "no-limits", title: "No CPU/memory limits found", impact: "Medium", file: "kubernetes manifests", detail: "Workloads without resource limits tend to be over-provisioned, which wastes allocated capacity." });
  }
  if (!tools.length) {
    findings.push({ id: "no-iac", title: "No infrastructure-as-code detected", impact: "Low", file: "repository root", detail: "Deployment shape had to be inferred from source code only, so this estimate is coarser." });
  }

  return { cloudProvider: provider, region, regionSource, tools, kubernetes, serverless, runtime, database, cpuAllocation, memoryGb, findings, score: clamp(score) };
}

/* ------------------------------------------------------------------ */
/* Carbon estimation engine                                             */
/* ------------------------------------------------------------------ */

/** Average server power draw per allocated core, watts (SPECpower-class servers). */
const WATTS_PER_CORE = 8.5;
/** Memory power coefficient, watts per GB allocated. */
const WATTS_PER_GB = 0.38;

const CPU_SECONDS_PER_REQUEST: Record<string, number> = {
  "Node.js": 0.012,
  Python: 0.02,
  JVM: 0.014,
  Go: 0.005,
  Rust: 0.004,
  Unknown: 0.015,
};

export function estimateCarbon(
  infra: InfrastructureReport,
  container: ContainerReport,
  deps: DependencyReport,
  intensity: number,
  intensitySource: string,
  intensityIsLive: boolean,
  pue: number,
  requests = 1000,
): CarbonReport {
  const base = CPU_SECONDS_PER_REQUEST[infra.runtime] ?? CPU_SECONDS_PER_REQUEST["Unknown"]!;
  // Heavier dependency trees mean more code loaded and executed per request.
  const depFactor = 1 + Math.min(0.5, deps.production / 200);
  // Inefficient images mean more image pull + cold-start work per deployment.
  const containerFactor = container.containerized ? (container.multiStage ? 1 : 1.1) : 1.05;
  const cpuSecondsPerRequest = Number((base * depFactor * containerFactor).toFixed(5));

  const cpuKwh = (cpuSecondsPerRequest * requests * infra.cpuAllocation * WATTS_PER_CORE) / 3_600_000;
  const memKwh = (cpuSecondsPerRequest * requests * (infra.memoryGb ?? 1) * WATTS_PER_GB) / 3_600_000;
  const networkKwh = cpuKwh * 0.12;
  const storageKwh = cpuKwh * 0.08;
  const rawKwh = cpuKwh + memKwh + networkKwh + storageKwh;
  const energyKwh = rawKwh * pue;
  const emissionsG = energyKwh * intensity;

  const now = new Date();
  const history = Array.from({ length: 24 }, (_, i) => {
    const hour = (now.getUTCHours() - 23 + i + 24) % 24;
    // Deterministic diurnal shape: lower overnight, peak late afternoon.
    const shape = 1 + 0.12 * Math.sin(((hour - 4) / 24) * 2 * Math.PI);
    return { time: `${String(hour).padStart(2, "0")}:00`, intensity: Math.round(intensity * shape) };
  });

  return {
    requests,
    cpuSecondsPerRequest,
    energyKwh,
    intensity,
    intensitySource,
    intensityIsLive,
    lastUpdated: now.toISOString(),
    emissionsG,
    pue,
    assumptions: [
      `Workload basis: ${requests.toLocaleString()} requests`,
      `${cpuSecondsPerRequest}s of CPU per request (${infra.runtime} baseline ${base}s, x${depFactor.toFixed(2)} dependency weight, x${containerFactor.toFixed(2)} container weight)`,
      `${infra.cpuAllocation} vCPU allocated at ${WATTS_PER_CORE} W per core`,
      `${infra.memoryGb ?? 1} GB memory at ${WATTS_PER_GB} W per GB`,
      `Network and storage overhead added as 12% and 8% of compute energy`,
      `Data-centre PUE assumption: ${pue}`,
      `Grid intensity: ${Math.round(intensity)} gCO2e/kWh (${intensityIsLive ? "live data" : "annual average fallback"})`,
    ],
    breakdown: [
      { name: "Compute", value: Number((cpuKwh * pue).toFixed(8)) },
      { name: "Memory", value: Number((memKwh * pue).toFixed(8)) },
      { name: "Network", value: Number((networkKwh * pue).toFixed(8)) },
      { name: "Storage", value: Number((storageKwh * pue).toFixed(8)) },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Code Carbon Score                                                    */
/* ------------------------------------------------------------------ */

export function scoreRegion(intensity: number): number {
  // 0 gCO2e/kWh -> 100, 700+ gCO2e/kWh -> 0, linear in between.
  return clamp(100 - (intensity / 700) * 100);
}

export function buildScore(
  infra: InfrastructureReport,
  deps: DependencyReport,
  container: ContainerReport,
  carbon: CarbonReport,
): ScoreReport {
  const regionScore = scoreRegion(carbon.intensity);
  const deploymentScore = clamp(
    60 + (infra.serverless ? 15 : 0) + (infra.tools.length ? 10 : 0) + (infra.memoryGb ? 10 : 0) + (container.multiStage ? 5 : 0),
  );

  const subscores = [
    { name: "Infrastructure", value: infra.score, weight: 0.25, explanation: `Based on detected infrastructure-as-code (${infra.tools.join(", ") || "none"}), declared region and resource limits.` },
    { name: "Dependencies", value: deps.score, weight: 0.2, explanation: deps.reasons.join("; ") },
    { name: "Container", value: container.score, weight: 0.2, explanation: container.containerized ? `${container.findings.length} Docker finding(s); multi-stage build ${container.multiStage ? "present" : "absent"}.` : "No container configuration found, scored as neutral." },
    { name: "Region grid", value: regionScore, weight: 0.25, explanation: `Grid intensity of ${Math.round(carbon.intensity)} gCO2e/kWh, scored against a 0-700 range.` },
    { name: "Deployment", value: deploymentScore, weight: 0.1, explanation: "Serverless or right-sized deployment configuration raises this sub-score." },
  ];

  const total = clamp(subscores.reduce((sum, s) => sum + s.value * s.weight, 0));
  const label = total >= 85 ? "Excellent" : total >= 70 ? "Good" : total >= 55 ? "Fair" : total >= 40 ? "Needs work" : "Poor";
  return { total, label, subscores };
}

/* ------------------------------------------------------------------ */
/* Recommendation engine                                                */
/* ------------------------------------------------------------------ */

export function buildRecommendations(
  infra: InfrastructureReport,
  deps: DependencyReport,
  container: ContainerReport,
  carbon: CarbonReport,
): Recommendation[] {
  const candidates: (Recommendation & { rank: number })[] = [];

  const docker = container.findings.find((f) => f.id === "multi-stage") ?? container.findings.find((f) => f.id === "base-image");
  if (docker) {
    candidates.push({
      rank: docker.impact === "High" ? 95 : 70,
      id: "docker",
      title: "Optimize the container image",
      impact: docker.impact,
      issue: docker.detail,
      action: "Split the Dockerfile into a build stage and a slim runtime stage, and base the runtime stage on a slim or alpine image.",
      file: docker.file,
      evidence: `Base image: ${container.baseImages.join(", ") || "not detected"} · multi-stage: ${container.multiStage ? "yes" : "no"} · .dockerignore: ${container.hasDockerignore ? "yes" : "no"}`,
      example: `FROM node:20-slim AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-slim\nWORKDIR /app\nCOPY --from=build /app/dist ./dist\nCOPY --from=build /app/node_modules ./node_modules\nCMD ["node", "dist/server.js"]`,
    });
  }

  const regionScoreValue = scoreRegion(carbon.intensity);
  if (regionScoreValue < 70) {
    candidates.push({
      rank: 90 - regionScoreValue,
      id: "region",
      title: "Review the deployment region",
      impact: regionScoreValue < 40 ? "High" : "Medium",
      issue: `The detected region (${infra.region ?? "unknown"}) sits on a grid averaging ${Math.round(carbon.intensity)} gCO2e/kWh, which is above the low-carbon regions in our dataset.`,
      action: "Compare supported regions below and evaluate whether another region is acceptable for your latency, compliance, availability and cost requirements. No region is universally better.",
      file: infra.region ? "infrastructure config" : "not declared",
      evidence: `${infra.regionSource} · provider ${infra.cloudProvider}`,
    });
  }

  if (deps.score < 85) {
    candidates.push({
      rank: 85 - deps.score + 40,
      id: "deps",
      title: "Trim the dependency surface",
      impact: deps.score < 55 ? "High" : "Medium",
      issue: `${deps.total} declared dependencies (${deps.production} production). ${deps.possibleRedundancies.length ? `Overlapping libraries: ${deps.possibleRedundancies.join("; ")}.` : ""}`,
      action: "Audit production dependencies, remove unused packages and consolidate libraries that solve the same problem.",
      file: deps.ecosystems[0]?.file ?? "dependency manifest",
      evidence: deps.reasons.join("; "),
    });
  }

  if (infra.kubernetes && !infra.memoryGb) {
    candidates.push({
      rank: 60,
      id: "limits",
      title: "Declare CPU and memory limits",
      impact: "Medium",
      issue: "Kubernetes manifests were detected without explicit resource requests or limits.",
      action: "Set requests and limits per workload so the scheduler can pack pods efficiently instead of reserving worst-case capacity.",
      file: "kubernetes manifests",
      evidence: `Detected tools: ${infra.tools.join(", ")}`,
      example: `resources:\n  requests:\n    cpu: "250m"\n    memory: "256Mi"\n  limits:\n    cpu: "500m"\n    memory: "512Mi"`,
    });
  }

  if (!container.hasDockerignore && container.containerized) {
    candidates.push({
      rank: 45,
      id: "dockerignore",
      title: "Add a .dockerignore file",
      impact: "Low",
      issue: "No .dockerignore was found, so build context and image layers may include files the runtime never needs.",
      action: "Exclude node_modules, .git, tests and local artefacts from the build context.",
      file: ".dockerignore",
      evidence: "File not present in the repository tree",
      example: `node_modules\n.git\ndist\n*.log\n.env`,
    });
  }

  if (!infra.tools.length) {
    candidates.push({
      rank: 40,
      id: "iac",
      title: "Describe deployment in configuration",
      impact: "Low",
      issue: "No infrastructure-as-code or deployment manifest was found, so region and sizing had to be assumed.",
      action: "Commit deployment configuration (Terraform, Kubernetes manifests, serverless.yml or a compose file) so sizing and region are explicit and reviewable.",
      file: "repository root",
      evidence: "No infrastructure files matched in the repository tree",
    });
  }

  candidates.push({
    rank: 10,
    id: "measure",
    title: "Measure real runtime energy use",
    impact: "Low",
    issue: "This analysis reads configuration only; it cannot see actual traffic, utilisation or hardware.",
    action: "Add runtime measurement (cloud provider carbon tooling or an agent such as Scaphandre/CodeCarbon) to validate these estimates against real workloads.",
    file: "observability setup",
    evidence: "Estimate derived from repository configuration",
  });

  return candidates
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map(({ rank: _rank, ...rec }) => rec);
}

export { clamp, findRegion };
