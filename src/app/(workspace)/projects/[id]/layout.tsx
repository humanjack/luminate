"use client";

import { useEffect, use } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings, MoreVertical, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowStepper } from "@/components/workflow/workflow-stepper";
import { AgentRunPanel } from "@/components/workflow/agent-run-panel";
import { useProjectStore } from "@/stores/project-store";
import { useWorkflowStore } from "@/stores/workflow-store";
import { debug } from "@/lib/debug";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const { currentProject, loadProject, updateProject, deleteProject } = useProjectStore();
  const { setMaxCompletedStep, setCurrentStep } = useWorkflowStore();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newName, setNewName] = useState("");

  // Load project on mount and reload on step navigation to ensure fresh data
  useEffect(() => {
    debug.log("workflow", `Layout: Loading project ${id}, pathname: ${pathname}`);
    loadProject(id).then((project) => {
      if (project) {
        debug.log("workflow", `Layout: Project loaded - scripts: ${project.scripts?.length || 0}, slides: ${project.slides?.length || 0}`);
        setMaxCompletedStep((project.currentStep - 1) as any);
        setCurrentStep(project.currentStep as any);
        setNewName(project.name);
      }
    });
  }, [id, pathname, loadProject, setMaxCompletedStep, setCurrentStep]);

  const handleRename = async () => {
    if (newName.trim()) {
      await updateProject(id, { name: newName.trim() });
      setIsRenameOpen(false);
    }
  };

  const handleDelete = async () => {
    await deleteProject(id);
    router.push("/projects");
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{currentProject.name}</h1>
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(currentProject.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Rename Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Workflow stepper */}
      <WorkflowStepper projectId={id} />

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>

      {/* Floating AI agent panel (S1) */}
      <AgentRunPanel projectId={id} />

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for your project.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
