"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/** Follow server data while clean; preserve edits until that exact draft is saved.
 * Identity changes discard drafts that reference a replaced document or slide deck.
 */
export function useDraftState<T>(source: T, identity?: string): [
  T, Dispatch<SetStateAction<T>>, (saved: T) => void,
] {
  const [state, setState] = useState<{ identity?: string; draft: { value: T } | null }>({ identity, draft: null });
  const draft = state.identity === identity ? state.draft : null;
  if (state.identity !== identity) setState({ identity, draft: null });
  const value = draft ? draft.value : source;
  const update: Dispatch<SetStateAction<T>> = (action) => {
    setState((previous) => previous.identity !== identity ? previous : {
      identity,
      draft: { value: typeof action === "function"
        ? (action as (previous: T) => T)(previous.draft ? previous.draft.value : source)
        : action },
    });
  };
  const acknowledge = (saved: T) => {
    setState((previous) => previous.identity === identity && previous.draft && Object.is(previous.draft.value, saved)
      ? { identity, draft: null }
      : previous);
  };
  return [value, update, acknowledge];
}
