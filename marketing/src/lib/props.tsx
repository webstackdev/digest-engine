import featureImage01 from "@/assets/images/feature-01.jpg";
import featureImage02 from "@/assets/images/feature-02.jpg";
import featureImage03 from "@/assets/images/feature-03.jpg";
import featureImage04 from "@/assets/images/feature-04.jpg";
import featureImage05 from "@/assets/images/feature-05.jpg";
import featureImage06 from "@/assets/images/feature-06.jpg";
import featureImage07 from "@/assets/images/feature-07.jpg";
import featureImage08 from "@/assets/images/feature-08.jpg";
import featureImage09 from "@/assets/images/feature-09.jpg";
import solutionImage01 from "@/assets/images/solutions-01.jpg";
import solutionImage02 from "@/assets/images/solutions-02.jpg";
import solutionImage03 from "@/assets/images/solutions-03.jpg";
import solutionImage04 from "@/assets/images/solutions-04.jpg";

import {
  IFeaturesProps,
  IClientsProps,
  IHomePageFaqProps,
  IPricingProps,
  IPricingPageProps,
  IHeroProps,
  IProblemsProps,
  ISolutionProps,
} from "./types";

export const brand = {
  logo: "/logo.png",
  name: "Digest Engine",
  tagline: "The research desk for your technical newsletter",
};

export const HeroProps: IHeroProps = {
  title: "The research desk for your newsletter",
  description:
    "Digest Engine reads thousands of blogs, peer newsletters, and social feeds. Track the people and companies that matter in your space. Rank every article against your own reference corpus. Get back a relevance-scored shortlist, summaries, and a draft outline.",
  btnGetStarted: {
    text: "Start Your First Project",
    link: "/signup",
  },
};

export const ProblemsProps: IProblemsProps = {
  eyebrow: "The real struggle of curation isn't finding content.",
  title:
    "Spotting real news that's trustworthy, engaging, and not already flooding your subscribers' feeds.",
  description:
    "Existing curation tools solve about a third of this problem. They rank by global popularity instead of editorial fit, so they cannot reflect who you trust or what your readers expect from you.",
  toolsHeading: "Why current discovery tools break down",
  toolsDescription:
    "Existing curation tools like Feedly, UpContent, ContentStudio, and generic AI content discovery products rank by generic clicks. They do not know who you trust, they cannot tell you when three peer newsletters in your niche already covered a topic this week, and they have no concept of authority or your point of view.",
  toolFailures: [
    {
      title: "Global popularity is not niche authority",
      description:
        "They rank content by generic clicks instead of weighting the people and publications you actually trust.",
    },
    {
      title: "The echo-chamber trap",
      description:
        "They cannot tell you when multiple peer newsletters in your niche already covered the same topic and you are about to arrive late.",
    },
    {
      title: "Blind to perspective",
      description:
        "They have no concept of authority and zero understanding of your editorial point of view.",
    },
  ],
};

export const SolutionProps: ISolutionProps = {
  title: "A system designed to learn what you favor",
  description:
    "Digest Engine is a project-scoped content pipeline. You point it at the sources you already use, tell it which people and companies matter in your space, and seed it with a handful of articles that represent the kind of thing you would cover. From there, every new piece of content gets embedded, scored, deduped, summarized, and ranked, while the borderline ones are routed through an LLM briefed on your project specifically.",
  steps: [
    {
      title: "Connect your sources",
      description:
        "RSS, Reddit, Bluesky, Mastodon, LinkedIn, and inbound newsletter email via a dedicated address. Each plugin handles its own auth, rate limiting, and health checks.",
      image: solutionImage01,
    },
    {
      title: "Define your taste",
      description:
        "Flag a starter set of articles as reference content. Add tracked entities and, if you want, feed in a few peer newsletters to bootstrap authority signals.",
      image: solutionImage02,
    },
    {
      title: "Let the pipeline run",
      description:
        "Every new item is embedded into a per-project vector space, scored against your reference corpus, deduped against everything ingested so far, classified, and summarized. Ambiguous items get routed through an LLM that knows your project's brief.",
      image: solutionImage03,
    },
    {
      title: "Curate, don't research",
      description:
        "Open the review queue, skim a ranked shortlist with summaries and authority signals already attached, then give feedback on the keepers and misses so the model keeps adapting.",
      image: solutionImage04,
    },
  ],
};

export const ClientsProps: IClientsProps = {
  title: "Recognizable brands. Real research pressure.",
  description:
    "Digest Engine is built for editorial, strategy, and research teams that have to keep pace with noisy markets, fragmented sources, and fast-moving narratives without losing the thread.",
  badge: "Social proof across retail, media, CPG, utilities, and agency networks.",
  items: [
    {
      label: "Canva",
      description: "Design and content teams that need cleaner signal across fast-moving product stories.",
    },
    {
      label: "Carrefour",
      description: "Retail operators tracking competitive movement, launches, and category conversation at scale.",
    },
    {
      label: "Coca-Cola",
      description: "Global brand teams watching how narratives spread across media, creators, and communities.",
    },
    {
      label: "Holt",
      description: "Publishing organizations that need better research workflows without heavier editorial overhead.",
    },
    {
      label: "Lionsgate",
      description: "Entertainment teams monitoring cultural momentum before it turns into a programming decision.",
    },
    {
      label: "Universal",
      description: "Media groups balancing release calendars, market shifts, and audience attention across channels.",
    },
    {
      label: "Vistra",
      description: "Utility and infrastructure teams that need disciplined monitoring in heavily regulated spaces.",
    },
    {
      label: "VML",
      description: "Agency strategists synthesizing fragmented source material into sharper client recommendations.",
    },
  ],
};

export const FeatureItems: IFeaturesProps = {
  title: "Why Digest Engine feels different",
  description:
    "Every project gets its own taste model, authority graph, and review flow so the system learns what your readers care about instead of guessing.",
  items: [
    {
      title: "Authority-aware ranking",
      description: "Ingest peer newsletters and score people or companies by who trusted editors actually link to, not just who shouts the loudest.",
      image: featureImage01,
      link: "/blog/authority-aware-ranking",
    },
    {
      title: "Per-project relevance training",
      description: "Thumbs up and thumbs down reshape the shortlist around your editorial judgment, with explicit feedback drifting the project centroid over time.",
      image: featureImage02,
      link: "/blog/per-project-relevance-training",
    },
    {
      title: "Unified entity profiles",
      description: "Roll a person or company's blog, social posts, releases, and mentions into a single view with one authority score and one activity stream.",
      image: featureImage03,
      link: "/blog/unified-entity-profiles",
    },
    {
      title: "Competitive intelligence built in",
      description: "Because Digest Engine ingests peer newsletters as a first-class source, you can see which topics editors in your niche already covered this week and which ones are still open for you to own.",
      image: featureImage04,
      link: "/blog/competitive-intelligence-built-in",
    },
    {
      title: "Trend velocity, not trend volume",
      description: "Spot topics accelerating across the last few days before they become saturated. Trend detection focuses on momentum, not just mention count.",
      image: featureImage05,
      link: "/blog/trend-velocity-not-trend-volume",
    },
    {
      title: "Composable AI skills",
      description: "Classification, summaries, dedupe, entity extraction, and more run as modular skills you can use in the pipeline, in the UI, or in your own workflows.",
      image: featureImage06,
      link: "/blog/composable-ai-skills",
    },
    {
      title: "Human review by default",
      description: "Low-confidence entities, failed skills, and ambiguous scores land in a review queue instead of silently becoming bad data.",
      image: featureImage07,
      link: "/blog/human-review-by-default",
    },
    {
      title: "Draft assembly, not just curation",
      description: "Once you lock in your shortlist, Digest Engine builds a themed draft outline with summaries in your voice so you can skip the blank page and get straight to writing.",
      image: featureImage08,
      link: "/blog/draft-assembly-not-just-curation",
    },
    {
      title: "Self-hostable, bring your own models",
      description: "Run skills through OpenRouter in development or swap to Ollama in production. The model is a configuration choice, not a platform lock-in.",
      image: featureImage09,
      link: "/blog/self-hostable-bring-your-own-models",
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

export const HomePageFaqProps: IHomePageFaqProps = {
  eyebrow: "FAQ",
  title: "Questions teams ask before they trust this with their workflow",
  description:
    "Straight answers about models, hosting, hallucinations, plugins, and what the system is actually doing under the hood.",
  items: [
    {
      question: "Is this just ChatGPT wrapped in a UI?",
      answer: (
        <>
          <p>
            No. The core curation logic is deterministic vector similarity against your project&apos;s reference corpus. LLMs are only used to break ties in an explicit confidence band, to summarize, to extract entities, and to detect themes, each as a swappable, model-agnostic skill.
          </p>
          <p className="mt-3">
            If every LLM API went dark tomorrow, you&apos;d still get ranked shortlists.
          </p>
        </>
      ),
    },
    {
      question: "How is this different from Feedly / UpContent / ContentStudio?",
      answer: (
        <>
          <p>Three things they don&apos;t do:</p>
          <ol className="mt-3 list-decimal space-y-3 pl-5">
            <li>
              <strong>Authority scoring from peer newsletters.</strong> We ingest other newsletters as a first-class source and build a trust graph from who real editors link to.
            </li>
            <li>
              <strong>Per-project taste training via explicit feedback.</strong> Your thumbs-up/thumbs-down drifts a per-project reference centroid. Your shortlist genuinely changes over time. Theirs doesn&apos;t.
            </li>
            <li>
              <strong>A unified entity model.</strong> One person, all their channels, one profile, one authority score.
            </li>
          </ol>
          <p className="mt-3">
            We also retain content indefinitely for long-term trend analysis, where most tools time out after a week.
          </p>
        </>
      ),
    },
    {
      question: "Do I need to know what a vector database is?",
      answer:
        "No. You connect sources, flag reference articles, thumbs-up things you like. The vector database, the embedding pipeline, and the LangGraph orchestration are implementation details. The UI is built for editors, not ML engineers.",
    },
    {
      question: "What about hallucinations?",
      answer: (
        <>
          <p>
            Summarization is grounded in the article text and the article text only. Relevance scoring is deterministic vector math, with LLMs only used in an explicit ambiguity band, and every score traces back to specific reference articles you flagged.
          </p>
          <p className="mt-3">
            Entity extraction surfaces low-confidence matches to a human review queue rather than silently writing bad data. Every skill invocation is logged with model, latency, and confidence.
          </p>
        </>
      ),
    },
    {
      question: "Which LLM do you use?",
      answer:
        "Whichever you want. Skills are model-agnostic and tested across Claude, GPT, Qwen, Llama, DeepSeek, Gemma, and Command R+. We recommend specific models per skill based on quality and cost, but you can override per skill. In production you can run everything locally via Ollama for zero marginal LLM cost.",
    },
    {
      question: "Can I self-host?",
      answer:
        "Yes. Docker Compose for the MVP path, Kubernetes-ready (Helm + ArgoCD) for scale. The license is AGPLv3.",
    },
    {
      question: "How much does it cost to run in development?",
      answer:
        "If you use OpenRouter as a unified gateway across the recommended dev models, you'll spend roughly $2.30/month for a single active project. Self-hosted with Ollama, the marginal LLM cost is $0.",
    },
    {
      question: "Does my content get sent to OpenAI / Anthropic / etc.?",
      answer:
        "Only if you configure it to. The default development setup uses OpenRouter. The default production-recommended setup uses Ollama on your own infrastructure. No data flows to a third party unless you point a skill at a third-party model.",
    },
    {
      question: "I don't run a newsletter. I just want to curate a Slack channel / internal digest / research feed. Does this work?",
      answer:
        "Yes. A \"newsletter project\" is just a project-scoped curation pipeline. The draft assembly step is optional. You can use Digest Engine as a pure ranked-shortlist tool and ignore the email side entirely.",
    },
    {
      question: "How does this handle paywalled or private content?",
      answer:
        "Source plugins handle their own auth, including authenticated RSS, OAuth flows (Bluesky, LinkedIn, Mastodon), and email-based ingestion (newsletters). Anything you can read, the system can read on your behalf. Anything you can't, it can't.",
    },
    {
      question: "How do I add a new source?",
      answer: (
        <>
          <p>
            Implement three methods on the source plugin interface: <code>fetch_new_content</code>, <code>get_entity_profile</code>, <code>health_check</code>.
          </p>
          <p className="mt-3">
            The core system handles scheduling, retry, error routing, and Qdrant writes. Adding a source is bounded work, not a refactor.
          </p>
        </>
      ),
    },
    {
      question: "What if a skill fails mid-pipeline?",
      answer:
        "The pipeline is a LangGraph state machine with checkpoints. A failed step records its failure status, the graph either gracefully degrades or routes the item to the review queue. Nothing silently corrupts. Re-runs resume from the failed checkpoint.",
    },
    {
      question: "Is there a hosted version?",
      answer:
        "Soon. Join the waitlist if you want to hear when hosted access opens.",
    },
    {
      question: "License?",
      answer: "GNU AGPLv3 or later. Source is on GitHub.",
    },
  ],
};

export const PricingPageProps: IPricingPageProps = {
  eyebrow: "Pricing",
  title: "Pricing that fits the way your newsroom actually works",
  description:
    "Start with the open-source stack, move into a shared editorial workspace, or hand off the infrastructure entirely. Every tier keeps the project-scoped workflow intact so you do not have to relearn the product as you grow.",
  highlights: [
    "Open source foundation",
    "Project-scoped ranking and review",
    "Upgrade without changing your workflow",
  ],
  matrixHeading: "Compare plans at a glance",
  matrixDescription:
    "Use this matrix as a starting point for evaluation. We can tune packaging and limits later, but these examples show how the plans differ in practice.",
  matrixColumns: ["Open Source", "Team", "Hosted", "Enterprise"],
  matrixRows: [
    {
      feature: "Deployment",
      values: ["Self-hosted", "Shared cloud", "Managed hosting", "Private cloud or on-prem"],
    },
    {
      feature: "Editor seats",
      values: ["Unlimited", "Up to 3", "Up to 10", "Custom"],
    },
    {
      feature: "Review queue",
      values: ["Included", "Included", "Included", "Included"],
    },
    {
      feature: "Inbound newsletter parsing",
      values: ["Manual setup", "Guided setup", "Included", "Included"],
    },
    {
      feature: "Model configuration",
      values: ["Bring your own", "Shared presets", "Managed defaults", "Custom model policy"],
    },
    {
      feature: "Support",
      values: ["Community", "Priority email", "Managed support", "SLA + onboarding"],
    },
  ],
  faqHeading: "Pricing FAQ",
  faqDescription:
    "These are the questions most teams ask before choosing a plan. We can refine the details once you decide how hands-on you want to be.",
  faqs: [
    {
      question: "Can we start open source and upgrade later?",
      answer:
        "Yes. The workflow stays consistent across plans, so teams can start self-hosted and move into Team, Hosted, or Enterprise when they want less operational overhead.",
    },
    {
      question: "Do all plans support project-specific ranking?",
      answer:
        "Yes. Project-scoped relevance, review queues, and source configuration are part of the core product rather than premium-only add-ons.",
    },
    {
      question: "Can we use our own models and data sources?",
      answer:
        "Yes. The open-source and enterprise paths are especially flexible, but every tier is designed to work with the sources and model setup that match your editorial process.",
    },
  ],
};
