// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IClientsProps } from "@/lib/types";

import Clients from "./Clients";

vi.mock("next/image", () => ({
  default: ({ alt, className, src }: { alt: string; className?: string; src: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className={className} src={src} />,
}));

const clientsProps: IClientsProps = {
  title: "Recognizable brands. Real research pressure.",
  description: "A short social proof section lede.",
  badge: "Social proof across retail, media, and agencies.",
  items: [
    {
      label: "Canva",
      description: "Design and content teams moving at product-launch speed.",
    },
    {
      label: "Carrefour",
      description: "Retail teams watching category shifts in real time.",
    },
    {
      label: "Coca-Cola",
      description: "Brand teams following how narratives spread across channels.",
    },
    {
      label: "Holt",
      description: "Publishing groups tightening editorial research loops.",
    },
    {
      label: "Lionsgate",
      description: "Entertainment teams tracking cultural momentum.",
    },
    {
      label: "Universal",
      description: "Media organizations balancing releases and market attention.",
    },
    {
      label: "Vistra",
      description: "Infrastructure teams monitoring noisy regulated markets.",
    },
    {
      label: "VML",
      description: "Agency strategists turning fragmented inputs into clearer briefs.",
    },
  ],
};

describe("Clients", () => {
  it("renders a text-free logo marquee for client social proof", () => {
    render(<Clients {...clientsProps} />);

    const logoList = screen.getByRole("list", { name: "Client logos" });
    const logos = within(logoList).getAllByRole("img");

    expect(screen.queryByRole("heading", { level: 2, name: clientsProps.title })).not.toBeInTheDocument();
    expect(screen.queryByText(clientsProps.badge)).not.toBeInTheDocument();
    expect(screen.queryByText(clientsProps.items[0].description)).not.toBeInTheDocument();
    expect(logos).toHaveLength(clientsProps.items.length);
    expect(screen.getByRole("img", { name: "Canva logo" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "VML logo" })).toBeInTheDocument();
  });
});