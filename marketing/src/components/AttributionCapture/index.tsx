"use client";

import { useEffect } from "react";

import { captureMarketingAttribution } from "@/lib/marketingAttribution";

/**
 * Stores campaign and referral attribution locally for later consented analytics events.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureMarketingAttribution();
  }, []);

  return null;
}