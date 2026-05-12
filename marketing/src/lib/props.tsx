import { IPricingProps } from "./types";

export const brand = {
  logo: "/logo.png",
  name: "Digest Engine",
  tagline: "The research desk for your technical newsletter",
};

export const HeroProps = {
  notification: {
    tag: "Open source",
    description: "Self-hosted curation for technically oriented newsletters",
  },
  title: "The research desk for your newsletter.",
  description:
    "Digest Engine ingests blogs, social feeds, and peer newsletters, then ranks every item against your editorial taste so you can spend your time writing the issue instead of searching for it.",
  btnGetStarted: {
    text: "Read the docs",
    link: "/docs",
  },
  btnBookDemo: {
    text: "See pricing",
    link: "#pricing",
  },
  extraDescription: "Track sources, train relevance, review drafts, and keep the final call in human hands.",
};

export const CompanyProps = {
  title: "Monitors the channels that actually move your issue",
  description: "Use one project-scoped pipeline across open-web sources, peer newsletters, and the models you already trust.",
  items: [
    { label: "RSS", eyebrow: "Source" },
    { label: "Reddit", eyebrow: "Signal" },
    { label: "Bluesky", eyebrow: "Source" },
    { label: "Mastodon", eyebrow: "Source" },
    { label: "LinkedIn", eyebrow: "Source" },
    { label: "Newsletters", eyebrow: "Authority" },
    { label: "Qdrant", eyebrow: "Vector" },
    { label: "LangGraph", eyebrow: "Workflow" },
    { label: "OpenRouter", eyebrow: "Gateway" },
    { label: "Ollama", eyebrow: "Self-hosted" },
  ],
};

export const FeatureItems = {
  title: "Why Digest Engine feels different",
  description:
    "Every project gets its own taste model, authority graph, and review flow so the system learns what your readers care about instead of guessing.",
  items: [
    {
      title: "Authority-aware ranking",
      icon: <span className='text-sm font-semibold tracking-[0.18em]'>01</span>,
      description: "Ingest peer newsletters and score people or companies by who trusted editors actually link to, not just who shouts the loudest.",
      link: "/docs/reference/algorithms",
    },
    {
      title: "Per-project relevance training",
      icon: <span className='text-sm font-semibold tracking-[0.18em]'>02</span>,
      description: "Thumbs up and thumbs down reshape the shortlist around your editorial judgment, with explicit feedback drifting the project centroid over time.",
      link: "/docs/reference/pipeline",
    },
    {
      title: "Unified entity profiles",
      icon: <span className='text-sm font-semibold tracking-[0.18em]'>03</span>,
      description: "Roll a person or company's blog, social posts, releases, and mentions into a single view with one authority score and one activity stream.",
      link: "/docs/reference/data-model",
    },
    {
      title: "Trend velocity over volume",
      icon: <span className='text-sm font-semibold tracking-[0.18em]'>04</span>,
      description: "Spot topics accelerating across the last few days before they become saturated. Trend detection focuses on momentum, not just mention count.",
      link: "/docs/reference/algorithms",
    },
    {
      title: "Human review by default",
      icon: <span className='text-sm font-semibold tracking-[0.18em]'>05</span>,
      description: "Low-confidence entities, failed skills, and ambiguous scores land in a review queue instead of silently becoming bad data.",
      link: "/docs/reference/pipeline",
    },
    {
      title: "Bring your own models",
      icon: <span className='text-sm font-semibold tracking-[0.18em]'>06</span>,
      description: "Run skills through OpenRouter in development or swap to Ollama in production. The model is a configuration choice, not a platform lock-in.",
      link: "/README.md",
    },
  ],
};

export const PricingProps: IPricingProps = {
  title: "Pick the operating model that fits your stack",
  description: "Start open source, move to a hosted workflow later, or keep the whole pipeline in your own infrastructure from day one.",
  annualDiscount: 20,
  plans: [
    {
      name: "Open Source",
      monthlyPrice: 0,
      description: "For teams that want full control and are happy to run the stack themselves.",
      features: ["Unlimited projects", "Docker Compose setup", "Bring your own models", "Community support"],
      buttonLabel: "Start self-hosting",
      buttonVariant: "outline",
      isPopular: false,
    },
    {
      name: "Team",
      monthlyPrice: 149,
      description: "A shared editorial workspace for small newsletter teams shipping every week.",
      features: ["3 editor seats", "Review queue tooling", "Reference corpus training", "Priority updates"],
      buttonLabel: "Request access",
      buttonVariant: "outline",
      isPopular: false,
    },
    {
      name: "Hosted",
      monthlyPrice: 399,
      description: "Managed infrastructure for editors who want the workflow without running the ops layer.",
      features: ["Managed upgrades", "Inbound newsletter parsing", "Team collaboration", "Email support"],
      buttonLabel: "Join waitlist",
      buttonVariant: "default",
      isPopular: true,
    },
    {
      name: "Enterprise",
      monthlyPrice: 1499,
      description: "Private deployment, custom plugins, and security review for larger media or research orgs.",
      features: ["VPC or on-prem", "Custom source plugins", "SLA-backed support", "Migration help"],
      buttonLabel: "Contact Sales",
      buttonVariant: "outline",
      isPopular: false,
    },
  ],
};
