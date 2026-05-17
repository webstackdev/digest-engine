"use client";

import { useState } from "react";
import Link from "next/link";

export const CONSENT_STORAGE_KEY = "marketing-consent";

type ConsentPreferences = {
  essential: true;
  marketing: boolean;
};

function isConsentPreferences(value: unknown): value is { marketing: boolean } {
  return typeof value === "object" && value !== null && "marketing" in value;
}

function readConsentPreferences(): ConsentPreferences | null {
  const storedValue = window.localStorage.getItem(CONSENT_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;

    if (!isConsentPreferences(parsedValue) || typeof parsedValue.marketing !== "boolean") {
      return null;
    }

    return {
      essential: true,
      marketing: parsedValue.marketing,
    };
  } catch {
    return null;
  }
}

function writeConsentPreferences(marketing: boolean) {
  const consentPreferences: ConsentPreferences = {
    essential: true,
    marketing,
  };

  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentPreferences));
}

function getInitialIsOpen() {
  if (typeof window === "undefined") {
    return false;
  }

  return readConsentPreferences() === null;
}

/**
 * Presents a site-wide cookie consent modal and stores preferences in local storage.
 */
export function Consent() {
  const [isOpen, setIsOpen] = useState(getInitialIsOpen);

  const handleEssentialOnly = () => {
    writeConsentPreferences(false);
    setIsOpen(false);
  };

  const handleAcceptAll = () => {
    writeConsentPreferences(true);
    setIsOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        className="w-full max-w-2xl rounded-4xl border border-trim-offset bg-page-base p-6 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.65)] sm:p-8"
      >
        <div className="space-y-4">
          <span className="inline-flex rounded-full border border-trim-offset bg-background px-4 py-2 text-sm font-medium text-content-offset">
            Cookie preferences
          </span>

          <div className="space-y-3">
            <h2
              id="cookie-consent-title"
              className="text-2xl font-semibold tracking-tight text-content-active sm:text-3xl"
            >
              Choose how the site stores consent preferences
            </h2>
            <p className="text-base leading-7 text-content-offset">
              Essential cookies are always enabled so the site can function correctly. Marketing cookies are optional and are used for campaign measurement and related outreach workflows.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-trim-offset bg-background p-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-content-offset">
                Essential
              </p>
              <p className="mt-2 text-base font-semibold text-content-active">Always active</p>
              <p className="mt-2 text-sm leading-6 text-content-offset">
                Needed for basic site operation, saved preferences, and security-related behavior.
              </p>
            </div>

            <div className="rounded-3xl border border-trim-offset bg-background p-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-content-offset">
                Marketing
              </p>
              <p className="mt-2 text-base font-semibold text-content-active">Optional</p>
              <p className="mt-2 text-sm leading-6 text-content-offset">
                Used for campaign attribution, promotional analytics, and similar marketing activities.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/cookies"
              className="text-sm font-semibold text-content-active no-underline transition-colors hover:text-content-offset"
            >
              Read the cookie policy
            </Link>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleEssentialOnly}
                className="inline-flex items-center justify-center rounded-full border border-trim-offset px-5 py-3 text-base font-semibold text-content-active transition-colors hover:text-content-offset"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-base font-semibold text-primary-inverse transition-colors hover:bg-accent-offset"
              >
                Accept all cookies
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
