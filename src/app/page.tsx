"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Settings, Video, Sparkles, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectStore } from "@/stores/project-store";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const { projects, loadProjects, createProject } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    const project = await createProject("Untitled Project");
    router.push(`/projects/${project.id}/research`);
  };

  const recentProjects = projects.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-12 w-12 text-primary" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Luminate
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create professional YouTube videos with AI-powered research, content generation, and production tools.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl mx-auto mb-16">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={handleCreateProject}
          >
            <CardHeader className="text-center">
              <Plus className="h-12 w-12 mx-auto text-primary mb-2" />
              <CardTitle>New Project</CardTitle>
              <CardDescription>Start a new video from scratch</CardDescription>
            </CardHeader>
          </Card>

          <Link href="/projects">
            <Card className="cursor-pointer hover:border-primary transition-colors h-full">
              <CardHeader className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>All Projects</CardTitle>
                <CardDescription>Browse and manage your projects</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard">
            <Card className="cursor-pointer hover:border-primary transition-colors h-full">
              <CardHeader className="text-center">
                <Gauge className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>Dashboard</CardTitle>
                <CardDescription>Pipeline health & throughput at a glance</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/settings">
            <Card className="cursor-pointer hover:border-primary transition-colors h-full">
              <CardHeader className="text-center">
                <Settings className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>Settings</CardTitle>
                <CardDescription>Configure API keys and preferences</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6">Recent Projects</h2>
            <div className="grid gap-4">
              {recentProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}/research`}>
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <Video className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <h3 className="font-medium">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Step {project.currentStep} of 7 • Updated{" "}
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${(project.currentStep / 7) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((project.currentStep / 7) * 100)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Overview */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-2xl font-semibold mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { step: 1, name: "Research", icon: "🔍" },
              { step: 2, name: "Content", icon: "📝" },
              { step: 3, name: "Slides", icon: "🎨" },
              { step: 4, name: "Script", icon: "📜" },
              { step: 5, name: "Record", icon: "🎙️" },
              { step: 6, name: "Analyze", icon: "📊" },
              { step: 7, name: "Export", icon: "🎬" },
            ].map((item) => (
              <div
                key={item.step}
                className="text-center p-4 rounded-lg bg-card border"
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-sm font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">Step {item.step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
