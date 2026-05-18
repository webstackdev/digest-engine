export const CONSENT_STORAGE_KEY = "marketing-consent";
export const MARKETING_CONSENT_CHANGED_EVENT = "marketing-consent-changed";

export type ConsentPreferences = {
  essential: true;
  marketing: boolean;
};

function isConsentPreferences(value: unknown): value is { marketing: boolean } {
  return typeof value === "object" && value !== null && "marketing" in value;
}

export function readConsentPreferences(): ConsentPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }

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

export function writeConsentPreferences(marketing: boolean): ConsentPreferences {
  const consentPreferences: ConsentPreferences = {
    essential: true,
    marketing,
  };

  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentPreferences));
  window.dispatchEvent(
    new CustomEvent<ConsentPreferences>(MARKETING_CONSENT_CHANGED_EVENT, {
      detail: consentPreferences,
    }),
  );

  return consentPreferences;
}