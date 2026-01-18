"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Video, Trash2, Search, ArrowLeft, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/stores/project-store";

type SortOption = "date-desc" | "date-asc" | "name-asc" | "name-desc";

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, loadProjects, createProject, deleteProject, isLoading } = useProjectStore();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Clear selection when projects change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [projects]);

  const handleCreateProject = async () => {
    const project = await createProject("Untitled Project");
    router.push(`/projects/${project.id}/research`);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      // Delete all selected projects
      for (const id of selectedIds) {
        await deleteProject(id);
      }
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete projects:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedProjects.map((p) => p.id)));
    }
  };

  // Filter and sort projects
  const sortedProjects = useMemo(() => {
    const filtered = projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });
  }, [projects, search, sortBy]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Projects</h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedIds.size})
              </Button>
            )}
            <Button onClick={handleCreateProject}>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selection Controls */}
        {sortedProjects.length > 0 && (
          <div className="flex items-center gap-4 mb-4 px-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedIds.size === sortedProjects.length && sortedProjects.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                {selectedIds.size === sortedProjects.length && sortedProjects.length > 0
                  ? "Deselect all"
                  : "Select all"}
              </label>
            </div>
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} of {sortedProjects.length} selected
              </span>
            )}
          </div>
        )}

        {/* Projects Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading projects...
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-4">
              Create your first video project to get started.
            </p>
            <Button onClick={handleCreateProject}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map((project) => (
              <Card
                key={project.id}
                className={`group cursor-pointer transition-colors ${
                  selectedIds.has(project.id)
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-primary"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center"
                        onClick={(e) => toggleSelect(project.id, e)}
                      >
                        <Checkbox
                          checked={selectedIds.has(project.id)}
                          onCheckedChange={() => toggleSelect(project.id)}
                          className="mr-2"
                        />
                      </div>
                      <Link href={`/projects/${project.id}/research`} className="flex items-center gap-3 flex-1">
                        <Video className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className="font-medium line-clamp-1">{project.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className={`w-2 h-2 rounded-full ${getStatusColor(
                                project.status
                              )}`}
                            />
                            <span className="capitalize">{project.status.replace("_", " ")}</span>
                          </div>
                        </div>
                      </Link>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleSelect(project.id, e);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  <Link href={`/projects/${project.id}/research`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{Math.round((project.currentStep / 7) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${(project.currentStep / 7) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Step {project.currentStep} of 7 • Created{" "}
                        {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.size === 1 ? "Project" : `${selectedIds.size} Projects`}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              {selectedIds.size === 1
                ? "this project"
                : `these ${selectedIds.size} projects`}
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedIds.size > 0 && (
            <div className="max-h-[200px] overflow-auto border rounded-md p-2">
              <ul className="space-y-1">
                {Array.from(selectedIds).map((id) => {
                  const project = projects.find((p) => p.id === id);
                  return (
                    <li key={id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      {project?.name || "Unknown project"}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isDeleting || selectedIds.size === 0}
            >
              {isDeleting ? "Deleting..." : `Delete ${selectedIds.size === 1 ? "Project" : "Projects"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
