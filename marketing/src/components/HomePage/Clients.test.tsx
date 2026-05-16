// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { IClientsProps } from "@/lib/types";

import Clients from "./Clients";

const clientsProps: IClientsProps = {
  title: "Plug into the feeds you already trust.",
  description: "A short integration section lede.",
  badge: "Six sources today. Plugin architecture for the rest.",
  items: [
    {
      label: "RSS",
      description: "Tracks blogs and sites of every entity you follow.",
    },
    {
      label: "Reddit",
      description: "Trend detection and community sentiment.",
    },
    {
      label: "Resend Inbound (Email)",
      description: "Newsletter ingestion.",
    },
    {
      label: "Bluesky",
      description: "Entity content tracking.",
    },
    {
      label: "Mastodon",
      description: "ActivityPub tracking.",
    },
    {
      label: "LinkedIn",
      description: "Entity enrichment and discovery.",
    },
  ],
};

describe("Clients", () => {
  it("renders an integrations section with source cards and descriptions", () => {
    render(<Clients {...clientsProps} />);

    const sectionHeading = screen.getByRole("heading", {
      level: 2,
      name: clientsProps.title,
    });
    const sourceHeadings = screen.getAllByRole("heading", { level: 3 });

    expect(sectionHeading).toBeInTheDocument();
    expect(screen.getByText(clientsProps.badge)).toBeInTheDocument();
    expect(sourceHeadings).toHaveLength(clientsProps.items.length);
    expect(within(sourceHeadings[0].closest("div") as HTMLElement).getByText(clientsProps.items[0].description)).toBeInTheDocument();
    expect(within(sourceHeadings[2].closest("div") as HTMLElement).getByText(clientsProps.items[2].description)).toBeInTheDocument();
  });
});