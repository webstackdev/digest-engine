"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { useEffect, useRef, useState } from "react";

import {
  MARKETING_CONSENT_CHANGED_EVENT,
  type ConsentPreferences,
  readConsentPreferences,
} from "@/lib/marketingConsent";

type GoogleTagManagerWithConsentProps = {
  gtmId: string;
};

/**
 * Loads Google Tag Manager only after marketing consent has been granted.
 */
export function GoogleTagManagerWithConsent({ gtmId }: GoogleTagManagerWithConsentProps) {
  const hasLoadedRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const syncConsent = (marketing: boolean | null) => {
      if (marketing) {
        hasLoadedRef.current = true;
        setShouldRender(true);
        return;
      }

      if (!hasLoadedRef.current) {
        setShouldRender(false);
      }
    };

    syncConsent(readConsentPreferences()?.marketing ?? null);

    const handleConsentChanged = (event: Event) => {
      const consentEvent = event as CustomEvent<ConsentPreferences>;
      syncConsent(consentEvent.detail?.marketing ?? null);
    };

    window.addEventListener(MARKETING_CONSENT_CHANGED_EVENT, handleConsentChanged);

    return () => {
      window.removeEventListener(MARKETING_CONSENT_CHANGED_EVENT, handleConsentChanged);
    };
  }, [gtmId]);

  if (!shouldRender) {
    return null;
  }

  return <GoogleTagManager gtmId={gtmId} />;
}