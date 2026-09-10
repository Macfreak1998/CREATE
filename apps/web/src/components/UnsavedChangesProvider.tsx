import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { UnsavedChangesContext } from "../hooks/useUnsavedChangesPrompt.js";

export default function UnsavedChangesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    setIsDirty(dirty);
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!dirtyRef.current) return true;
    return window.confirm(
      "Sie haben ungespeicherte Aenderungen. Wirklich verlassen und verwerfen?"
    );
  }, []);

  const value = useMemo(
    () => ({ isDirty, setDirty, confirmNavigation }),
    [isDirty, setDirty, confirmNavigation]
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}
