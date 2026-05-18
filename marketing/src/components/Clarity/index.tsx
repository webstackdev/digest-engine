"use client";

import ClaritySDK from "@microsoft/clarity";
import { useEffect, useRef } from "react";

import {
  MARKETING_CONSENT_CHANGED_EVENT,
  type ConsentPreferences,
  readConsentPreferences,
} from "@/lib/marketingConsent";

type ClarityProps = {
  clarityId: string;
};

/**
 * Initializes Microsoft Clarity only after marketing consent has been granted.
 */
export function Clarity({ clarityId }: ClarityProps) {
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      return;
    }

    const syncConsent = (marketing: boolean | null) => {
      if (!marketing) {
        if (hasInitializedRef.current) {
          ClaritySDK.consent(false);
        }

        return;
      }

      if (!hasInitializedRef.current) {
        ClaritySDK.init(clarityId);
        hasInitializedRef.current = true;
      }

      ClaritySDK.consent(true);
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
  }, [clarityId]);

  return null;
}