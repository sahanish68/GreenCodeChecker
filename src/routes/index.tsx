import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Boxes,
  Cpu,
  Gauge,
  GitBranch,
  Info,
  Loader2,
  Package,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import { Brand } from "@/components/greencode/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { analyzeRepository } from "@/lib/greencode/analyze.functions";
import { REGIONS } from "@/lib/greencode/regions";

const DEMO_REPO = "https://github.com/dockersamples/example-voting-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GreenCode — Estimate your repository's carbon efficiency" },
      {
        name: "description",
        content:
          "Paste a public GitHub repository URL and get an estimated Code Carbon Score from its dependencies, Docker setup, cloud region and deployment configuration.",
      },
      { property: "og:title", content: "GreenCode — Make your code greener" },
      {
        property: "og:description",
        content:
          "Estimated environmental impact of a GitHub repository, based on configuration, infrastructure assumptions and public grid-intensity data.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeRepository);

  const mutation = useMutation({
    mutationFn: (repoUrl: string) => analyze({ data: { url: repoUrl } }),
    onSuccess: (res) => navigate({ to: "/analysis/$id", params: { id: res.id } }),
    onError: (e: Error) => setError(e.message || "Analysis failed. Please try again."),
  });

  const recent = useQuery({
    queryKey: ["recent-analyses"],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("analyses")
        .select("id, owner, name, carbon_score, region, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (err) throw err;
      return data;
    },
  });

  function submit(value: string) {
    setError(null);
    if (!value.trim()) {
      setError("Paste a public GitHub repository URL to start.");
      return;
    }
    mutation.mutate(value.trim());
  }

  return (
    <TooltipProvider>
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-lines" aria-hidden />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Brand />
          <a
            href="#how-it-works"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </a>
        </header>

        <main className="relative mx-auto max-w-6xl px-6 pb-24">
          <section className="pt-14 pb-16 text-center sm:pt-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <Gauge className="size-3.5 text-primary" /> Code carbon analysis
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] sm:text-6xl">
              Make Your Code <span className="text-gradient-eco">Greener.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              Analyze your repository's infrastructure, dependencies and deployment configuration to
              understand its estimated environmental impact.
            </p>

            <form
              className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                submit(url);
              }}
            >
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/username/project"
                className="h-14 flex-1 rounded-xl border-border bg-card px-5 font-mono text-sm"
                aria-label="GitHub repository URL"
              />
              <Button type="submit" size="lg" className="h-14 rounded-xl px-6 text-base font-semibold" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    Analyze Repository <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                disabled={mutation.isPending}
                onClick={() => {
                  setUrl(DEMO_REPO);
                  submit(DEMO_REPO);
                }}
              >
                View Demo
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    <Info className="size-3.5" /> Estimated impact
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Carbon estimates are approximate and depend on actual runtime, hardware utilization,
                  workload, data-center efficiency, and geographic electricity mix.
                </TooltipContent>
              </Tooltip>
            </div>

            {error && (
              <p className="mx-auto mt-5 max-w-xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {error}
              </p>
            )}
            {mutation.isPending && (
              <p className="mt-5 font-mono text-xs text-muted-foreground">
                Fetching repository tree · parsing manifests · scanning infrastructure files…
              </p>
            )}
          </section>

          <section id="how-it-works" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: GitBranch, title: "Repository scan", body: "Manifests, Dockerfiles, Terraform, Kubernetes and deployment configs are read from the public repo." },
              { icon: Package, title: "Dependency signal", body: "Production vs development packages, heavy frameworks and overlapping libraries." },
              { icon: Boxes, title: "Container review", body: "Base images, multi-stage builds, package caches and build context size." },
              { icon: Cpu, title: "Carbon estimate", body: "Deterministic energy model multiplied by public grid intensity for the detected region." },
            ].map((f) => (
              <div key={f.title} className="panel p-5">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-16 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="panel p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent analyses</h2>
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Public
                </span>
              </div>
              <div className="mt-4 divide-y divide-border">
                {recent.isLoading && <p className="py-6 text-sm text-muted-foreground">Loading…</p>}
                {recent.data?.length === 0 && (
                  <p className="py-6 text-sm text-muted-foreground">No analyses yet. Run the first one.</p>
                )}
                {recent.data?.map((a) => (
                  <Link
                    key={a.id}
                    to="/analysis/$id"
                    params={{ id: a.id }}
                    className="flex items-center justify-between py-3 transition-colors hover:text-primary"
                  >
                    <span className="font-mono text-sm">
                      {a.owner}/{a.name}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{a.region ?? "no region"}</span>
                      <span className="rounded-md bg-secondary px-2 py-1 font-mono text-sm text-foreground">
                        {a.carbon_score}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="panel p-6">
              <ShieldCheck className="size-5 text-accent" />
              <h2 className="mt-3 text-lg font-semibold">What this is — and is not</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                GreenCode reports an <strong className="text-foreground">estimated environmental impact</strong>{" "}
                calculated from repository configuration, infrastructure assumptions and public
                grid-intensity data. It is not a measurement of real emissions.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Every number is produced by a documented, deterministic formula and the assumptions are
                shown alongside the result. {REGIONS.length} cloud regions are supported today.
              </p>
            </div>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}
