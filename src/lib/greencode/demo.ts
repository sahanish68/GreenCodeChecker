import {
  analyzeContainer,
  analyzeDependencies,
  analyzeInfrastructure,
  buildRecommendations,
  buildScore,
  estimateCarbon,
  type FileMap,
} from "./engine";
import { findRegion } from "./regions";
import type { AnalysisResult, RepositoryInfo } from "./types";

const files: FileMap = {
  "package.json": JSON.stringify({
    dependencies: {
      next: "*",
      react: "*",
      "react-dom": "*",
      webpack: "*",
      parcel: "*",
      axios: "*",
      got: "*",
      moment: "*",
      "date-fns": "*",
      lodash: "*",
      underscore: "*",
      puppeteer: "*",
    },
    devDependencies: { typescript: "*", vitest: "*" },
  }),
  Dockerfile: "FROM node:latest\nWORKDIR /app\nCOPY . .\nRUN npm ci && npm run build\nCMD [\"npm\", \"start\"]\n",
  "main.tf": 'provider "aws" {\n  region = "us-east-2"\n}\n',
};

const repository: RepositoryInfo = {
  url: "https://github.com/greencode/demo-project",
  owner: "greencode",
  name: "demo-project",
  branch: "main",
  commitSha: null,
  description: "Illustrative GreenCode demo data",
  stars: 0,
  sizeKb: 0,
  languages: [
    { name: "TypeScript", percent: 76 },
    { name: "JavaScript", percent: 24 },
  ],
  fileCount: 3,
};

const paths = Object.keys(files);
const dependencies = analyzeDependencies(files);
const container = analyzeContainer(files, paths);
const infrastructure = analyzeInfrastructure(files, paths, repository.languages);
const region = findRegion(infrastructure.region);
const carbon = estimateCarbon(
  infrastructure,
  container,
  dependencies,
  region.intensity,
  "Demo dataset — annual average estimate, not live data",
  false,
  region.pue,
);
const score = buildScore(infrastructure, dependencies, container, carbon);

export const DEMO_ANALYSIS: AnalysisResult = {
  id: "demo",
  createdAt: "2026-01-01T00:00:00.000Z",
  repository,
  dependencies,
  container,
  infrastructure,
  carbon,
  score,
  recommendations: buildRecommendations(infrastructure, dependencies, container, carbon),
  detectedFiles: paths,
};