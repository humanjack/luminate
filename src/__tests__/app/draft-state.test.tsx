import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useDraftState } from "@/hooks/use-draft-state";

it("applies batched edits to the latest hydrated collection and preserves them on refresh", () => {
  const { result, rerender } = renderHook(({ source }) => useDraftState(source), {
    initialProps: { source: [] as string[] },
  });
  rerender({ source: ["Saved slide"] });
  act(() => {
    result.current[1]((previous) => [...previous, "First draft slide"]);
    result.current[1]((previous) => [...previous, "Second draft slide"]);
  });
  rerender({ source: ["Refreshed slide"] });
  expect(result.current[0]).toEqual(["Saved slide", "First draft slide", "Second draft slide"]);
});


it("follows external updates once saved, without clearing edits made during the save", () => {
  const { result, rerender } = renderHook(({ source }) => useDraftState(source), {
    initialProps: { source: "Original" },
  });
  act(() => result.current[1]("Saved"));
  act(() => result.current[2]("Saved"));
  rerender({ source: "External update" });
  expect(result.current[0]).toBe("External update");
  act(() => result.current[1]("First edit"));
  const acknowledge = result.current[2];
  act(() => result.current[1]("Newer edit while saving"));
  act(() => acknowledge("First edit"));
  rerender({ source: "First edit" });
  expect(result.current[0]).toBe("Newer edit while saving");
});
