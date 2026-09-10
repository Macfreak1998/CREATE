import { useMemo } from "react";

// Liefert true, wenn das aktuelle Formular vom initialen Stand abweicht.
// JSON.stringify-Vergleich ist fuer unsere Formular-Strukturen (Strings, Zahlen,
// Arrays von Records) ausreichend und stabil, solange die Sortierung erhalten
// bleibt.
export function useDirtyForm<T>(current: T, initial: T | null): boolean {
  return useMemo(() => {
    if (initial === null) return false;
    try {
      return JSON.stringify(current) !== JSON.stringify(initial);
    } catch {
      return false;
    }
  }, [current, initial]);
}
