import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Cloud,
  Cpu,
  ExternalLink,
  Github,
  Info,
  Leaf,
  Package,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Brand, EstimateBadge } from "@/components/greencode/brand";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_ANALYSIS } from "@/lib/greencode/demo";
import { scoreRegion } from "@/lib/greencode/engine";
import { REGIONS } from "@/lib/greencode/regions";
import type { AnalysisResult } from "@/lib/greencode/types";

export const Route = createFileRoute("/analysis/$id")({
  head: () => ({
    meta: [
      { title: "Repository analysis — GreenCode" },
      {
        name: "description",
        content:
          "Estimated Code Carbon Score, grid intensity, infrastructure findings and optimization recommendations for a GitHub repository.",
      },
      { property: "og:title", content: "Repository analysis — GreenCode" },
      {
        property: "og:description",
        content: "Estimated carbon efficiency of a GitHub repository's configuration and infrastructure.",
      },
    ],
  }),
  component: AnalysisPage,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function AnalysisPage() {
  const { id } = useParams({ from: "/analysis/$id" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis", id],
    queryFn: async () => {
      if (id === "demo") return DEMO_ANALYSIS;
      const { data: row, error: err } = await supabase
        .from("analyses")
        .select("id, created_at, result")
        .eq("id", id)
        .maybeSingle();
      if (err) throw err;
      if (!row) throw new Error("Analysis not found");
      return { id: row.id, createdAt: row.created_at, ...(row.result as object) } as AnalysisResult;
    },
  });

  if (isLoading) {
    return <Centered text="Loading analysis…" />;
  }
  if (error || !data) {
    return <Centered text="We couldn't find that analysis." action />;
  }

  const { repository, score, carbon, dependencies, container, infrastructure, recommendations } = data;

  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-4">
              <Brand />
              {id === "demo" && (
                <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                  Demo data
                </span>
              )}
              <span className="hidden font-mono text-sm text-muted-foreground sm:inline">
                {repository.owner}/{repository.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {id !== "demo" && (
                <a href={repository.url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Github className="size-4" /> Repo <ExternalLink className="size-3" />
                  </Button>
                </a>
              )}
              <Link to="/">
                <Button size="sm">
                  <ArrowLeft className="size-4" /> Analyze another
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          {id === "demo" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              Demo data: these repository details and findings are illustrative and are not a live GitHub analysis.
            </div>
          )}
          {/* top row */}
          <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="panel flex flex-col items-center p-6">
              <ScoreRing value={score.total} />
              <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Code Carbon Score
              </p>
              <p className="mt-1 text-xl font-semibold text-primary">{score.label}</p>
              <Accordion type="single" collapsible className="mt-4 w-full">
                <AccordionItem value="why" className="border-border">
                  <AccordionTrigger className="text-sm">Why did I get this score?</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {score.subscores.map((s) => (
                      <div key={s.name}>
                        <div className="flex justify-between font-mono text-xs">
                          <span>
                            {s.name} · weight {Math.round(s.weight * 100)}%
                          </span>
                          <span className="text-primary">{s.value}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.explanation}</p>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                icon={Leaf}
                label="Estimated carbon impact"
                value={`${carbon.emissionsG < 1 ? carbon.emissionsG.toFixed(3) : carbon.emissionsG.toFixed(1)} gCO₂e`}
                sub={`per ${carbon.requests.toLocaleString()} requests`}
                badge
              />
              <StatCard
                icon={Zap}
                label="Estimated energy"
                value={`${(carbon.energyKwh * 1000).toFixed(3)} Wh`}
                sub={`PUE ${carbon.pue} · ${carbon.cpuSecondsPerRequest}s CPU/request`}
              />
              <StatCard
                icon={Cloud}
                label="Grid intensity"
                value={`${Math.round(carbon.intensity)} gCO₂e/kWh`}
                sub={`${infrastructure.region ?? "no region detected"} · ${carbon.intensityIsLive ? "live" : "annual average"}`}
              />
              <StatCard
                icon={Cpu}
                label="Deployment"
                value={infrastructure.cloudProvider}
                sub={`${infrastructure.runtime}${infrastructure.serverless ? " · serverless" : ""}${infrastructure.kubernetes ? " · kubernetes" : ""}`}
              />
              <div className="panel col-span-full p-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 text-warning">
                  <AlertTriangle className="size-3.5" /> Estimated environmental impact.
                </span>{" "}
                Calculated from repository configuration, infrastructure assumptions and public
                grid-intensity data — not a measurement of real emissions. Source:{" "}
                {carbon.intensitySource}. Last updated {new Date(carbon.lastUpdated).toLocaleString()}.
              </div>
            </div>
          </section>

          {/* charts */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="panel p-5 lg:col-span-2">
              <PanelTitle>Grid carbon intensity (24h shape)</PanelTitle>
              <p className="mb-3 text-xs text-muted-foreground">
                {carbon.intensityIsLive
                  ? "Live intensity with a modelled daily shape."
                  : "Annual average with a modelled daily shape — illustrative, not measured hourly data."}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={carbon.history}>
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={3} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={40} />
                  <RTooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="intensity" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="panel p-5">
              <PanelTitle>Energy breakdown</PanelTitle>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={carbon.breakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {carbon.breakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => `${(v * 1000).toFixed(4)} Wh`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                {carbon.breakdown.map((b, i) => (
                  <span key={b.name} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: CHART_COLORS[i % 4] }} />
                    {b.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="panel p-5 lg:col-span-3">
              <PanelTitle>Score breakdown</PanelTitle>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={score.subscores} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <RTooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* recommendations */}
          <section className="panel p-6">
            <h2 className="text-xl font-semibold">🌱 Top optimization opportunities</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {recommendations.map((r) => (
                <article key={r.id} className="rounded-xl border border-border bg-secondary/40 p-5">
                  <div className="flex items-center justify-between">
                    <Leaf className="size-5 text-primary" />
                    <ImpactPill impact={r.impact} />
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{r.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{r.issue}</p>
                  <p className="mt-3 text-sm">
                    <span className="font-medium text-primary">Action: </span>
                    {r.action}
                  </p>
                  <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                    file: {r.file}
                    <br />
                    evidence: {r.evidence}
                  </p>
                  {r.example && (
                    <Accordion type="single" collapsible className="mt-2">
                      <AccordionItem value="fix" className="border-0">
                        <AccordionTrigger className="py-2 text-sm">View fix</AccordionTrigger>
                        <AccordionContent>
                          <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground">
                            {r.example}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* insights */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="panel p-5">
              <PanelTitle>Repository insights</PanelTitle>
              <dl className="space-y-2 text-sm">
                {repository.languages.map((l) => (
                  <div key={l.name} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-muted-foreground">{l.name}</span>
                    <span className="h-1.5 flex-1 rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(3, l.percent)}%` }}
                      />
                    </span>
                    <span className="w-12 text-right font-mono text-xs">{l.percent}%</span>
                  </div>
                ))}
                <Row label="Files scanned" value={String(repository.fileCount)} />
                <Row label="Branch" value={repository.branch} />
                <Row label="Containerized" value={container.containerized ? "Yes" : "No"} />
                <Row label="Infrastructure" value={infrastructure.tools.join(", ") || "none detected"} />
                <Row label="Database" value={infrastructure.database ?? "not detected"} />
              </dl>
            </div>

            <div className="panel p-5">
              <PanelTitle>
                <Package className="mr-2 inline size-4 text-primary" />
                Dependencies · {dependencies.score}/100
              </PanelTitle>
              <dl className="space-y-2 text-sm">
                <Row label="Total declared" value={String(dependencies.total)} />
                <Row label="Production" value={String(dependencies.production)} />
                <Row label="Development" value={String(dependencies.development)} />
                <Row label="Manifests" value={dependencies.ecosystems.map((e) => e.ecosystem).join(", ") || "none"} />
              </dl>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {dependencies.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>

            <div className="panel p-5">
              <PanelTitle>
                <Boxes className="mr-2 inline size-4 text-primary" />
                Container · {container.score}/100
              </PanelTitle>
              <dl className="space-y-2 text-sm">
                <Row label="Base images" value={container.baseImages.join(", ") || "none"} />
                <Row label="Multi-stage" value={container.multiStage ? "Yes" : "No"} />
                <Row label=".dockerignore" value={container.hasDockerignore ? "Present" : "Missing"} />
              </dl>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {container.findings.length === 0 && <li>No Docker inefficiency patterns detected.</li>}
                {container.findings.map((f) => (
                  <li key={f.id}>
                    <span className="text-foreground">{f.title}</span> — {f.detail}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* region comparison */}
          <section className="panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PanelTitle>Region comparison</PanelTitle>
              <EstimateBadge />
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Same workload, different grids. No region is universally better — latency, compliance,
              availability and cost still decide.
            </p>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Intensity</TableHead>
                    <TableHead className="text-right">Est. energy</TableHead>
                    <TableHead className="text-right">Est. carbon</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REGIONS.map((r) => {
                    const energy = (carbon.energyKwh / carbon.pue) * r.pue;
                    const isCurrent = r.id === infrastructure.region;
                    return (
                      <TableRow key={`${r.provider}-${r.id}`} className={isCurrent ? "bg-primary/10" : ""}>
                        <TableCell className="font-mono text-xs">
                          {r.id}
                          <span className="block text-muted-foreground">{r.label}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{r.intensity}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(energy * 1000).toFixed(3)} Wh
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(energy * r.intensity).toFixed(3)} g
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.notes}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* assumptions */}
          <section className="panel p-6">
            <div className="flex items-center gap-2">
              <PanelTitle>Calculation assumptions</PanelTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-4 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Carbon estimates are approximate and depend on actual runtime, hardware utilization,
                  workload, data-center efficiency, and geographic electricity mix.
                </TooltipContent>
              </Tooltip>
            </div>
            <ul className="space-y-1.5 font-mono text-xs text-muted-foreground">
              {carbon.assumptions.map((a) => (
                <li key={a}>— {a}</li>
              ))}
              <li>
                — Region sub-score: {scoreRegion(carbon.intensity)}/100, derived from a 0–700 gCO₂e/kWh
                range
              </li>
              <li>— Files read from the repository: {data.detectedFiles.join(", ") || "none"}</li>
            </ul>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}

function tooltipStyleFn() {
  return {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "var(--foreground)",
  };
}
const tooltipStyle = tooltipStyleFn();

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border pt-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-xs">{value}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  badge?: boolean;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-primary" />
        {badge && <EstimateBadge />}
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function ImpactPill({ impact }: { impact: "Low" | "Medium" | "High" }) {
  const tone =
    impact === "High"
      ? "border-destructive/40 bg-destructive/15 text-destructive"
      : impact === "Medium"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-accent/40 bg-accent/15 text-accent";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}>
      Impact: {impact}
    </span>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-48">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--secondary)" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-bold">{value}</span>
        <span className="font-mono text-[11px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function Centered({ text, action }: { text: string; action?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {action && (
        <Link to="/">
          <Button>Analyze a repository</Button>
        </Link>
      )}
    </div>
  );
}
