import LogRocket from "logrocket";
import * as Sentry from "@sentry/nextjs";

const logRocketAppId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;

if (logRocketAppId) {
  LogRocket.init(logRocketAppId);
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Adds request headers and IP for users
  sendDefaultPii: true,
  // Capture 100% in dev, 10% in production
  // Adjust based on your traffic volume
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,
});

if (logRocketAppId) {
  LogRocket.getSessionURL((sessionURL) => {
    Sentry.setExtra("LogRocket Session", sessionURL);
  });
}

// This export will instrument router navigation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
