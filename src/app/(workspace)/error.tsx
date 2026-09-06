"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Error boundary for the workspace pages (dashboard, projects list, settings).
 * A render-time throw shows this calm fallback instead of a blank screen, with
 * a `reset()` retry and a link back to projects.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center bg-background px-4"
    >
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CircleAlert className="w-10 h-10 text-destructive" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">
            This page hit an unexpected error. Your data is safe — you can try
            again.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => reset()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/projects">Back to projects</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
