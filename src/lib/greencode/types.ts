import type { CloudProvider } from "./regions";

export interface RepositoryInfo {
  url: string;
  owner: string;
  name: string;
  branch: string;
  commitSha: string | null;
  description: string | null;
  stars: number;
  sizeKb: number;
  languages: { name: string; percent: number }[];
  fileCount: number;
}

export interface DependencyReport {
  total: number;
  production: number;
  development: number;
  ecosystems: { ecosystem: string; file: string; count: number }[];
  heavyFrameworks: string[];
  possibleRedundancies: string[];
  score: number;
  reasons: string[];
}

export interface DockerFinding {
  id: string;
  title: string;
  detail: string;
  impact: "Low" | "Medium" | "High";
  file: string;
}

export interface ContainerReport {
  containerized: boolean;
  baseImages: string[];
  multiStage: boolean;
  hasDockerignore: boolean;
  findings: DockerFinding[];
  score: number;
}

export interface InfrastructureReport {
  cloudProvider: CloudProvider;
  region: string | null;
  regionSource: string;
  tools: string[];
  kubernetes: boolean;
  serverless: boolean;
  runtime: string;
  database: string | null;
  cpuAllocation: number;
  memoryGb: number | null;
  findings: DockerFinding[];
  score: number;
}

export interface CarbonReport {
  /** Workload basis for the estimate */
  requests: number;
  cpuSecondsPerRequest: number;
  energyKwh: number;
  intensity: number;
  intensitySource: string;
  intensityIsLive: boolean;
  lastUpdated: string;
  emissionsG: number;
  pue: number;
  assumptions: string[];
  history: { time: string; intensity: number }[];
  breakdown: { name: string; value: number }[];
}

export interface Recommendation {
  id: string;
  title: string;
  impact: "Low" | "Medium" | "High";
  issue: string;
  action: string;
  file: string;
  evidence: string;
  example?: string;
}

export interface ScoreReport {
  total: number;
  label: string;
  subscores: { name: string; value: number; weight: number; explanation: string }[];
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  repository: RepositoryInfo;
  dependencies: DependencyReport;
  container: ContainerReport;
  infrastructure: InfrastructureReport;
  carbon: CarbonReport;
  score: ScoreReport;
  recommendations: Recommendation[];
  detectedFiles: string[];
}
