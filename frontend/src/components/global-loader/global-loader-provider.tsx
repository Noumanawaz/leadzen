"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { GlobalLoaderOverlay } from "./global-loader-overlay";

type LoaderEntry = { message?: string };

type GlobalLoaderContextValue = {
  setLoading: (key: string, active: boolean, message?: string) => void;
  withLoader: <T>(
    key: string,
    fn: () => Promise<T>,
    message?: string,
  ) => Promise<T>;
  isLoading: boolean;
};

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, LoaderEntry>>(new Map());

  const setLoading = useCallback(
    (key: string, active: boolean, message?: string) => {
      setEntries((prev) => {
        const next = new Map(prev);
        if (active) next.set(key, { message });
        else next.delete(key);
        return next;
      });
    },
    [],
  );

  const withLoader = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, message?: string) => {
      setLoading(key, true, message);
      try {
        return await fn();
      } finally {
        setLoading(key, false);
      }
    },
    [setLoading],
  );

  const isLoading = entries.size > 0;
  const message = useMemo(() => {
    const values = Array.from(entries.values());
    return values.at(-1)?.message ?? "Loading…";
  }, [entries]);

  const value = useMemo(
    () => ({ setLoading, withLoader, isLoading }),
    [setLoading, withLoader, isLoading],
  );

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      {isLoading ? <GlobalLoaderOverlay message={message} /> : null}
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader() {
  const ctx = useContext(GlobalLoaderContext);
  if (!ctx) {
    throw new Error("useGlobalLoader must be used within GlobalLoaderProvider");
  }
  return ctx;
}
