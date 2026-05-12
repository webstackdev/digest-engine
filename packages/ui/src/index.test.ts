import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./index";

describe("Button", () => {
  it("renders its child content", () => {
    expect(renderToStaticMarkup(createElement(Button, null, "Launch"))).toContain(
      ">Launch<"
    );
  });
});
