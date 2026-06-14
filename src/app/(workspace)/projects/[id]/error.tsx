"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the workflow step pages. Lives below the project [id]
 * layout, so the project chrome (header/stepper) stays mounted while just the
 * step content shows this fallback.
 */
export default function ProjectStepError({
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <CircleAlert className="w-10 h-10 text-destructive" />
      <h2 className="text-lg font-semibold">This step hit an error</h2>
      <p className="max-w-md text-muted-foreground">
        Something went wrong rendering this step. You can retry, or go back to
        your projects.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    </div>
  );
}
