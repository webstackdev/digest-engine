import LogRocket from "logrocket";
import * as Sentry from "@sentry/nextjs";

const logRocketAppId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const telemetryEnabled = process.env.NODE_ENV !== "development";
const shouldInitSentry = telemetryEnabled && typeof sentryDsn === "string";
const shouldInitLogRocket = telemetryEnabled && typeof logRocketAppId === "string";

if (shouldInitLogRocket) {
  LogRocket.init(logRocketAppId);
}

if (shouldInitSentry) {
  Sentry.init({
    dsn: sentryDsn,
    // Adds request headers and IP for users
    sendDefaultPii: true,
    tracesSampleRate: 0.1,
    // Enable logs to be sent to Sentry
    enableLogs: true,
  });
}

if (shouldInitLogRocket && shouldInitSentry) {
  LogRocket.getSessionURL((sessionURL) => {
    Sentry.setExtra("LogRocket Session", sessionURL);
  });
}

// This export will instrument router navigation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
