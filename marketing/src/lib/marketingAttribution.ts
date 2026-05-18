export const MARKETING_ATTRIBUTION_STORAGE_KEY = "marketing-attribution";

export type MarketingAttribution = {
  fbclid?: string;
  gclid?: string;
  landing_path?: string;
  msclkid?: string;
  referrer?: string;
  referrer_host?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_medium?: string;
  utm_source?: string;
  utm_term?: string;
};

const TRACKED_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
] as const;

function isMarketingAttribution(value: unknown): value is MarketingAttribution {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value).every((entry) => entry === undefined || typeof entry === "string");
}

function hasTrackedQueryParams(url: URL): boolean {
  return TRACKED_QUERY_KEYS.some((key) => {
    const value = url.searchParams.get(key);

    return value !== null && value.trim().length > 0;
  });
}

function readExternalReferrer(currentOrigin: string, referrer: string): Pick<
  MarketingAttribution,
  "referrer" | "referrer_host"
> {
  if (!referrer) {
    return {};
  }

  try {
    const referrerUrl = new URL(referrer);

    if (referrerUrl.origin === currentOrigin) {
      return {};
    }

    return {
      referrer,
      referrer_host: referrerUrl.host,
    };
  } catch {
    return {};
  }
}

function buildAttributionSnapshot(url: URL, referrer: string): MarketingAttribution {
  const queryAttribution = Object.fromEntries(
    TRACKED_QUERY_KEYS.flatMap((key) => {
      const value = url.searchParams.get(key);

      return value && value.trim().length > 0 ? [[key, value]] : [];
    }),
  ) as MarketingAttribution;

  return {
    ...queryAttribution,
    ...readExternalReferrer(url.origin, referrer),
    landing_path: `${url.pathname}${url.search}`,
  };
}

function hasAttributionData(attribution: MarketingAttribution): boolean {
  return Object.entries(attribution).some(([key, value]) => key !== "landing_path" && Boolean(value));
}

export function readMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.sessionStorage.getItem(MARKETING_ATTRIBUTION_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(storedValue) as unknown;

    return isMarketingAttribution(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function writeMarketingAttribution(attribution: MarketingAttribution): MarketingAttribution {
  window.sessionStorage.setItem(
    MARKETING_ATTRIBUTION_STORAGE_KEY,
    JSON.stringify(attribution),
  );

  return attribution;
}

export function captureMarketingAttribution(): MarketingAttribution | null {
  if (typeof window === "undefined") {
    return null;
  }

  const existingAttribution = readMarketingAttribution();
  const currentUrl = new URL(window.location.href);
  const currentSnapshot = buildAttributionSnapshot(currentUrl, document.referrer);

  if (!hasAttributionData(currentSnapshot)) {
    return existingAttribution;
  }

  if (hasTrackedQueryParams(currentUrl)) {
    return writeMarketingAttribution({
      ...existingAttribution,
      ...currentSnapshot,
    });
  }

  if (existingAttribution !== null) {
    return existingAttribution;
  }

  return writeMarketingAttribution(currentSnapshot);
}

export function getMarketingAttributionSummary(attribution: MarketingAttribution | null): {
  campaign?: string;
  medium: string;
  referrer_host?: string;
  source: string;
} {
  if (attribution?.utm_source) {
    return {
      campaign: attribution.utm_campaign,
      medium: attribution.utm_medium ?? "campaign",
      referrer_host: attribution.referrer_host,
      source: attribution.utm_source,
    };
  }

  if (attribution?.referrer_host) {
    return {
      campaign: attribution.utm_campaign,
      medium: "referral",
      referrer_host: attribution.referrer_host,
      source: attribution.referrer_host,
    };
  }

  return {
    medium: "direct",
    source: "direct",
  };
}