import { useState } from "react";

export interface HoursInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Controlled hours-entry input backed by a text "draft" that:
 *  - re-syncs when the stored value changes elsewhere (e.g. another view edits
 *    the same bill),
 *  - commits on blur / Enter,
 *  - ignores no-op commits and reverts invalid (NaN) input.
 *
 * Shared by the matrix cells and the per-project billing rows so the subtle
 * draft-vs-stored reconciliation lives in exactly one place.
 *
 * Returns the stored-derived string plus input props to spread onto an
 * `<input type="number">`.
 */
export function useHoursInput(
  stored: number | null,
  onCommit: (hours: number | null) => void
): HoursInputProps {
  const storedKey = stored == null ? "" : String(stored);
  const [draft, setDraft] = useState(storedKey);

  // Render-phase resync: if the stored value changed since we last saw it,
  // adopt it. (React's documented pattern for deriving state from props.)
  const [lastStored, setLastStored] = useState(storedKey);
  if (storedKey !== lastStored) {
    setLastStored(storedKey);
    setDraft(storedKey);
  }

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next === stored) return; // no-op
    if (next != null && Number.isNaN(next)) {
      setDraft(storedKey); // revert invalid input
      return;
    }
    onCommit(next);
  }

  return {
    value: draft,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === "Enter") e.currentTarget.blur();
    },
  };
}
