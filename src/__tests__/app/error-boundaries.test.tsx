import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// next/link's prefetch uses IntersectionObserver, which the jsdom test setup
// stubs as a non-constructor; render a plain anchor instead for these tests.
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import WorkspaceError from "@/app/(workspace)/error";
import ProjectStepError from "@/app/(workspace)/projects/[id]/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";

const fakeError = Object.assign(new Error("boom"), { digest: "abc" });

describe("App Router error boundaries", () => {
  it("WorkspaceError renders a fallback and reset() fires on 'Try again'", () => {
    const reset = vi.fn();
    render(<WorkspaceError error={fakeError} reset={reset} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /back to projects/i })).toHaveAttribute(
      "href",
      "/projects"
    );
  });

  it("ProjectStepError renders a step-scoped fallback with retry", () => {
    const reset = vi.fn();
    render(<ProjectStepError error={fakeError} reset={reset} />);
    expect(screen.getByText(/this step hit an error/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("GlobalError renders a self-contained fallback with retry", () => {
    const reset = vi.fn();
    render(<GlobalError error={fakeError} reset={reset} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("NotFound renders a themed 404 linking back to projects", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to projects/i })).toHaveAttribute(
      "href",
      "/projects"
    );
  });
});
