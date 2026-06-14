"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  Clock,
  FolderOpen,
  Gauge,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardSnapshot } from "@/lib/analytics/aggregate";
import { donutSegments } from "@/lib/analytics/donut";

const STEP_LABELS = [
  "Research",
  "Content",
  "Slides",
  "Script",
  "Recording",
  "Analysis",
  "Video",
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/dashboard")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json();
      })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" aria-label="Back to home">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Studio Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Workflow health across every project
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/projects">
              <Button variant="outline" size="sm">
                <FolderOpen className="w-4 h-4 mr-2" />
                All projects
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-6 py-8" data-testid="dashboard">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading dashboard…</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {data && data.totalProjects === 0 && (
          <Card className="max-w-xl mx-auto">
            <CardContent>
              <EmptyState
                icon={<Sparkles className="w-8 h-8" />}
                title="Nothing to chart yet"
                description="Create your first project and the dashboard will fill in automatically."
                action={
                  <Link href="/">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create a project
                    </Button>
                  </Link>
                }
              />
            </CardContent>
          </Card>
        )}
        {data && data.totalProjects > 0 && <DashboardBody data={data} />}
      </main>
    </div>
  );
}

function DashboardBody({ data }: { data: DashboardSnapshot }) {
  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Projects"
          value={data.totalProjects}
          sub={`${data.newProjectsLastWeek} new this week`}
          icon={<FolderOpen className="w-4 h-4" />}
        />
        <KpiTile
          label="Completion avg"
          value={`${data.completionAvg}%`}
          sub={`${data.byStatus.completed} completed total`}
          icon={<Gauge className="w-4 h-4" />}
        />
        <KpiTile
          label="In progress"
          value={data.byStatus.in_progress}
          sub={`${data.byStatus.draft} drafts queued`}
          icon={<Clock className="w-4 h-4" />}
        />
        <KpiTile
          label="Completed last week"
          value={data.completedProjectsLastWeek}
          sub={data.weeklyTrend.reduce((a, b) => a + b, 0).toString() + " in last 8 weeks"}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step funnel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Where projects are right now</CardTitle>
            <p className="text-xs text-muted-foreground">
              Bars show how many projects sit at each step of the pipeline.
            </p>
          </CardHeader>
          <CardContent>
            <StepFunnel data={data.byStep} />
          </CardContent>
        </Card>

        {/* Trend + status donut */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completions, last 8 weeks</CardTitle>
              <p className="text-xs text-muted-foreground">
                Oldest week on the left → most recent on the right.
              </p>
            </CardHeader>
            <CardContent>
              <Sparkline values={data.weeklyTrend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status mix</CardTitle>
              <p className="text-xs text-muted-foreground">
                How your projects split across the pipeline.
              </p>
            </CardHeader>
            <CardContent>
              <StatusDonut byStatus={data.byStatus} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectList
          title="Recently updated"
          icon={<Clock className="w-4 h-4 text-indigo-500" />}
          projects={data.recentlyUpdated}
          empty="No project activity yet."
        />
        <ProjectList
          title="Blocked or stuck"
          icon={<CircleAlert className="w-4 h-4 text-amber-500" />}
          projects={data.blockedProjects}
          empty="Nothing blocked — great work."
          highlight="blockers"
        />
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StepFunnel({ data }: { data: number[] }) {
  // data is length 8 (index 0 unused); use 1..7
  const counts = data.slice(1, 8);
  const max = Math.max(1, ...counts);
  return (
    <div className="space-y-2.5" data-testid="step-funnel">
      {counts.map((n, i) => (
        <div key={i} className="group flex items-center gap-3 text-sm">
          <div className="w-24 shrink-0 text-muted-foreground tabular-nums">
            {i + 1}. {STEP_LABELS[i]}
          </div>
          <div className="flex-1 h-7 bg-muted/70 rounded-md overflow-hidden">
            <div
              className="bar-grow h-full rounded-md bg-gradient-to-r from-indigo-500 to-violet-500 transition-[filter] group-hover:brightness-110"
              style={{ width: `${(n / max) * 100}%`, animationDelay: `${i * 55}ms` }}
            />
          </div>
          <div className="w-8 text-right tabular-nums font-semibold">{n}</div>
        </div>
      ))}
    </div>
  );
}

const STATUS_META: Array<{
  key: "completed" | "in_progress" | "draft";
  label: string;
  color: string;
}> = [
  { key: "completed", label: "Completed", color: "#10b981" },
  { key: "in_progress", label: "In progress", color: "#6366f1" },
  { key: "draft", label: "Draft", color: "#94a3b8" },
];

function StatusDonut({
  byStatus,
}: {
  byStatus: DashboardSnapshot["byStatus"];
}) {
  const size = 132;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const values = STATUS_META.map((s) => byStatus[s.key] ?? 0);
  const total = values.reduce((a, b) => a + b, 0);
  const segments = donutSegments(values, c);

  return (
    <div className="flex items-center gap-5" data-testid="status-donut">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          {total > 0 &&
            segments.map((seg, i) => (
              <circle
                key={STATUS_META[i].key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={stroke}
                stroke={STATUS_META[i].color}
                strokeDasharray={`${seg.length} ${c - seg.length}`}
                strokeDashoffset={seg.offset}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums leading-none">{total}</span>
          <span className="text-[11px] text-muted-foreground">projects</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {STATUS_META.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto tabular-nums font-medium">{values[i]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const width = 280;
  const height = 80;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div data-testid="sparkline">
      <svg viewBox={`0 0 ${width} ${height + 30}`} className="w-full">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#spark-fill)" stroke="none" />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-indigo-500"
        />
        {values.map((v, i) => {
          const x = i * step;
          const y = height - (v / max) * height;
          const isNow = i === values.length - 1;
          return (
            <g key={i}>
              {isNow && (
                <circle cx={x} cy={y} r={6} className="fill-indigo-500/25" />
              )}
              <circle
                cx={x}
                cy={y}
                r={isNow ? 4 : 3}
                className="fill-indigo-500"
              />
              <text
                x={x}
                y={height + 18}
                fontSize={9}
                textAnchor="middle"
                className="fill-muted-foreground"
              >
                {i === values.length - 1 ? "now" : `-${values.length - 1 - i}w`}
              </text>
              <text
                x={x}
                y={y - 6}
                fontSize={9}
                textAnchor="middle"
                className="fill-foreground tabular-nums"
              >
                {v}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface ProjectListProps {
  title: string;
  icon: React.ReactNode;
  projects: Array<{
    id: string;
    name: string;
    completionPct: number;
    currentStep: number;
    blockers: number;
    status: "draft" | "in_progress" | "completed";
    updatedAt: number;
  }>;
  empty: string;
  highlight?: "blockers";
}

function ProjectList({ title, icon, projects, empty, highlight }: ProjectListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{empty}</p>
        ) : (
          <ul className="divide-y">
            {projects.map((p) => (
              <li key={p.id} className="py-2">
                <Link
                  href={`/projects/${p.id}/research`}
                  className="flex items-center justify-between gap-3 hover:bg-muted/50 rounded px-2 py-1"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Step {p.currentStep}/7 · {p.status} ·{" "}
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {highlight === "blockers" && p.blockers > 0 && (
                      <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 text-[10px] font-mono px-2 py-0.5">
                        {p.blockers} blocked
                      </span>
                    )}
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${p.completionPct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">
                      {p.completionPct}%
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
