"use client";

import { useEffect } from "react";
import { useGlobalLoader } from "./global-loader-provider";

export function useGlobalLoaderEffect(
  key: string,
  active: boolean,
  message?: string,
) {
  const { setLoading } = useGlobalLoader();

  useEffect(() => {
    setLoading(key, active, message);
    return () => setLoading(key, false);
  }, [key, active, message, setLoading]);
}
