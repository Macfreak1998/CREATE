import { createContext, useCallback, useContext, useEffect } from "react";

// Globaler Dirty-State, damit die Layout-Navigation (NavLinks, Logout, Brand)
// vor dem Wechseln den Nutzer fragen kann. Pages registrieren sich per Hook.

interface UnsavedChangesContextValue {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmNavigation: () => boolean;
}

export const UnsavedChangesContext =
  createContext<UnsavedChangesContextValue | null>(null);

export function useUnsavedChanges(): UnsavedChangesContextValue {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    return {
      isDirty: false,
      setDirty: () => undefined,
      confirmNavigation: () => true,
    };
  }
  return ctx;
}

// Registriert den aktuellen Dirty-State der Page beim globalen Provider und
// installiert einen beforeunload-Listener (Tab-Schliessen / Reload).
export function useRegisterUnsavedChanges(isDirty: boolean): void {
  const ctx = useContext(UnsavedChangesContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setDirty(isDirty);
    return () => ctx.setDirty(false);
  }, [ctx, isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}

// Bequemer Hook fuer Seiten, die ein eigenes Modal anzeigen wollen, statt das
// native confirm zu nutzen. Liefert Status und Aktionen zurueck.
export function useDiscardConfirm(): {
  confirmDiscard: () => boolean;
} {
  const { isDirty } = useUnsavedChanges();
  const confirmDiscard = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(
      "Sie haben ungespeicherte Aenderungen. Wirklich verwerfen?"
    );
  }, [isDirty]);
  return { confirmDiscard };
}
