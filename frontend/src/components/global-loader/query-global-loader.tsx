"use client";

import { useIsMutating } from "@tanstack/react-query";
import { useEffect } from "react";
import { useGlobalLoader } from "./global-loader-provider";

export function QueryGlobalLoader() {
  const pending = useIsMutating();
  const { setLoading } = useGlobalLoader();

  useEffect(() => {
    setLoading(
      "react-query-mutations",
      pending > 0,
      pending > 0 ? "Working…" : undefined,
    );
  }, [pending, setLoading]);

  return null;
}
