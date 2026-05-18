import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logRocketMocks = vi.hoisted(() => ({
  getSessionURL: vi.fn(),
  init: vi.fn(),
}));

const sentryMocks = vi.hoisted(() => ({
  captureRouterTransitionStart: vi.fn(),
  init: vi.fn(),
  setExtra: vi.fn(),
}));

vi.mock("logrocket", () => ({
  default: logRocketMocks,
}));

vi.mock("@sentry/nextjs", () => sentryMocks);

describe("instrumentation-client", () => {
  beforeEach(() => {
    logRocketMocks.getSessionURL.mockImplementation((callback: (url: string) => void) => {
      callback("https://app.logrocket.com/session/test");
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("does not initialize Sentry or LogRocket during development", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "q3tqts/digest-engine");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example.com/sentry");
    vi.stubEnv("NODE_ENV", "development");

    await import("./instrumentation-client");

    expect(sentryMocks.init).not.toHaveBeenCalled();
    expect(logRocketMocks.init).not.toHaveBeenCalled();
    expect(logRocketMocks.getSessionURL).not.toHaveBeenCalled();
    expect(sentryMocks.setExtra).not.toHaveBeenCalled();
  });

  it("initializes LogRocket and binds the session URL in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGROCKET_APP_ID", "q3tqts/digest-engine");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example.com/sentry");
    vi.stubEnv("NODE_ENV", "production");

    await import("./instrumentation-client");

    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://example.com/sentry" }),
    );
    expect(logRocketMocks.init).toHaveBeenCalledWith("q3tqts/digest-engine");
    expect(logRocketMocks.getSessionURL).toHaveBeenCalledTimes(1);
    expect(sentryMocks.setExtra).toHaveBeenCalledWith(
      "LogRocket Session",
      "https://app.logrocket.com/session/test",
    );
  });
});