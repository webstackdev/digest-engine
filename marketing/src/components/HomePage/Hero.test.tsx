// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroProps } from "@/lib/props";
import type { IHeroProps } from "@/lib/types";

import Hero from "./Hero";

const heroPropsWithCta: IHeroProps = {
  ...HeroProps,
  btnGetStarted: {
    text: HeroProps.btnGetStarted?.text ?? "Get started",
    link: HeroProps.btnGetStarted?.link ?? "/signup",
  },
};

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: { alt: string; className?: string; src: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />,
}));

afterEach(() => {
  cleanup();
});

describe("Hero", () => {
  it("renders the hero landmark content with mobile layout hooks", () => {
    render(<Hero {...heroPropsWithCta} />);

    const heading = screen.getByRole("heading", { level: 1 });
    const image = screen.getByRole("img");
    const ctaLink = screen.getByRole("link");
    const ctaContainer = screen.getByTestId("hero-cta-container");
    const imageContainer = screen.getByTestId("hero-image-container");

    expect(heading).toBeInTheDocument();
    expect(image).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute("href", heroPropsWithCta.btnGetStarted?.link ?? "/signup");
    expect(ctaContainer).toHaveClass("justify-center", "md:justify-start");
    expect(imageContainer).toHaveClass("hidden", "md:block");
  });

  it("omits the call to action when the configured button text is blank", () => {
    render(
      <Hero
        {...heroPropsWithCta}
        btnGetStarted={{
          text: "   ",
          link: heroPropsWithCta.btnGetStarted?.link ?? "/signup",
        }}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
