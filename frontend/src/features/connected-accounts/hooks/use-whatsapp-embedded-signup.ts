"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api/client";

declare global {
  interface Window {
    FB?: {
      init: (params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type EmbeddedSignupSession = {
  phoneNumberId?: string;
  wabaId?: string;
  businessId?: string;
};

type WhatsAppConfig = {
  configured: boolean;
  embeddedSignupConfigured?: boolean;
  appId?: string;
  configId?: string;
  missingEnvVars?: string[];
  devManualConnectAvailable?: boolean;
};

const EMBEDDED_SIGNUP_WAIT_MS = 4000;

function loadFacebookSdk(appId: string, version = "v22.0"): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, cookie: true, xfbml: true, version });
      resolve();
    };
    const existing = document.getElementById("facebook-jssdk");
    if (existing && window.FB) {
      resolve();
      return;
    }
    if (existing) {
      const interval = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Meta SDK"));
    document.body.appendChild(script);
  });
}

function waitForEmbeddedSignupSession(
  getSession: () => EmbeddedSignupSession,
  timeoutMs: number,
): Promise<EmbeddedSignupSession> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const interval = window.setInterval(() => {
      const session = getSession();
      if (session.phoneNumberId) {
        window.clearInterval(interval);
        resolve(session);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(interval);
        reject(
          new Error(
            "Meta did not return a phone number. Finish Embedded Signup and try again.",
          ),
        );
      }
    }, 100);
  });
}

function mapConnectError(err: unknown): string {
  const message = err instanceof Error ? err.message : "WhatsApp connection failed";
  if (message.includes("Organization mismatch")) {
    return "Connection session expired. Please try again.";
  }
  if (message.includes("already connected to another workspace")) {
    return "This WhatsApp number is already linked to another workspace.";
  }
  if (message.includes("not configured")) {
    return "WhatsApp onboarding is not configured. Contact your administrator.";
  }
  return message;
}

export function useWhatsAppEmbeddedSignup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<EmbeddedSignupSession>({});

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      try {
        const data = JSON.parse(String(event.data)) as {
          type?: string;
          data?: EmbeddedSignupSession & {
            phone_number_id?: string;
            waba_id?: string;
            business_id?: string;
          };
        };
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.data) {
          sessionRef.current = {
            phoneNumberId:
              data.data.phone_number_id ?? data.data.phoneNumberId,
            wabaId: data.data.waba_id ?? data.data.wabaId,
            businessId: data.data.business_id ?? data.data.businessId,
          };
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    sessionRef.current = {};

    try {
      const configResponse = await apiClient<
        WhatsAppConfig & { embeddedSignupConfigured?: boolean }
      >("/v1/integrations/whatsapp/config");

      let config: WhatsAppConfig = {
        configured:
          configResponse.embeddedSignupConfigured ?? configResponse.configured,
        embeddedSignupConfigured:
          configResponse.embeddedSignupConfigured ?? configResponse.configured,
        appId: configResponse.appId,
        configId: configResponse.configId,
        missingEnvVars: configResponse.missingEnvVars,
        devManualConnectAvailable: configResponse.devManualConnectAvailable,
      };

      if (!config.embeddedSignupConfigured || !config.appId || !config.configId) {
        const message =
          config.missingEnvVars?.includes("META_EMBEDDED_SIGNUP_CONFIG_ID")
            ? "WhatsApp Embedded Signup is not configured. Set META_EMBEDDED_SIGNUP_CONFIG_ID on the server (Meta → Embedded Signup configuration ID), or use dev manual connect."
            : "WhatsApp onboarding is not configured on this server. Contact your administrator.";
        throw new Error(message);
      }

      const start = await apiClient<{
        state: string;
        configured: boolean;
        embeddedSignupConfigured?: boolean;
        appId?: string;
        configId?: string;
      }>("/v1/integrations/whatsapp/connect/start", { method: "POST" });

      config = {
        ...config,
        appId: start.appId ?? config.appId,
        configId: start.configId ?? config.configId,
      };

      await loadFacebookSdk(config.appId!);

      const authCodePromise = new Promise<string>((resolve, reject) => {
        window.FB?.login(
          (response) => {
            if (response.authResponse?.code) {
              resolve(response.authResponse.code);
              return;
            }
            reject(new Error("WhatsApp signup was cancelled or failed."));
          },
          {
            config_id: config.configId,
            response_type: "code",
            override_default_response_type: true,
            extras: { setup: {} },
          },
        );
      });

      const [authCode, session] = await Promise.all([
        authCodePromise,
        waitForEmbeddedSignupSession(
          () => sessionRef.current,
          EMBEDDED_SIGNUP_WAIT_MS,
        ),
      ]);

      await apiClient("/v1/integrations/whatsapp/connect/complete", {
        method: "POST",
        body: JSON.stringify({
          state: start.state,
          code: authCode,
          phoneNumberId: session.phoneNumberId,
          wabaId: session.wabaId,
          businessId: session.businessId,
        }),
      });
    } catch (err) {
      const message = mapConnectError(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { connect, loading, error };
}
