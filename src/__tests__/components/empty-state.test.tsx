import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

describe("EmptyState (#70)", () => {
  it("renders title, description, icon and an action", () => {
    render(
      <EmptyState
        icon={<svg data-testid="icon" />}
        title="No projects yet"
        description="Create your first project."
        action={<Button>Create Project</Button>}
      />
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first project.")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeInTheDocument();
  });

  it("fires the action callback", () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="Empty" action={<Button onClick={onClick}>Go</Button>} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders without optional props (title only)", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    // no description/action present
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
