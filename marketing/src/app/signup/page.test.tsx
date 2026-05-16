import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SignupPage from "./page";

describe("SignupPage", () => {
  it("renders the signup route with the form and next steps", () => {
    const markup = renderToStaticMarkup(<SignupPage />);

    expect(markup).toContain("Start with a workflow that learns your editorial taste");
    expect(markup).toContain("Request access");
    expect(markup).toContain('aria-label="Signup next steps"');
    expect(markup).toContain('href="/pricing"');
  });
});