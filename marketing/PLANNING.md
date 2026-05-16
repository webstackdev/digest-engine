# Marketing Site for Digest Engine

## Newsletter Platforms

Probably should just integrate with these platforms instead of providing newsletter services directly, or maybe include Ghost in the platform:

- Ghost, an open-source platform for blogs and newsletters, starts at $15 per month with 1,000 members for website creation, email newsletter capabilities, and a custom domain.
- Beehiiv, a creator platform with tools for launching a newsletter, website, and podcast, is free for up to 2,500 subscribers with limited access to certain features, like a built-in ad network, while its other plans vary in price based on subscriber count. A person with 10,000 subscribers, for example, will pay $96 per month for Beehiiv's "Scale" plan.
- Kit, a newsletter platform that offers a tiered pricing model similar to Beehiiv, costing $116 per month with 10,000 subscribers on its "Creator" plan.
- Substack

## Third-Party Services

- Vercel
- Stripe
- Google Analytics
- Sentry
- Resend

## Authentication

Since your backend is Django, you don't need a heavy library like NextAuth in your marketing site. Instead, use a **Cross-Domain Session** or **HttpOnly Cookie** approach.

- **HttpOnly Cookies for Subdomains:** Configure your Django backend to set cookies on your root domain (e.g., `.yourdomain.com`). This ensures that if a user logs in via the app subdomain, the marketing site can also detect their session to show "Go to Dashboard" instead of "Login".
- **Django Backend as Truth:** Continue using DRF for your auth logic. Use a library like django-rest-framework-simplejwt for JWTs or standard Django Sessions.
- **Next.js Implementation:**
  - On the **Marketing Site**, you only need a simple "Get User" check in a Next.js Server Component to verify if the auth cookie exists and is valid via a call to your Django `/api/me/` endpoint.
  - On the **App Subdomain**, use the same cookie to authenticate all API requests.

## Stripe Payment Handling

The best practice is a **Server-Side Checkout Flow** to keep your business logic and secrets secure in your Django backend.

- **Checkout Flow:**
  1. **Trigger:** User clicks "Upgrade" on your marketing site or app.
  2. **Request:** Your Next.js frontend sends a request to your **Django backend** (e.g., `POST /api/payments/create-checkout-session/`).
  3. **Backend Action:** Django uses the Stripe Python SDK library to create a Stripe Checkout Session and returns the session URL.
  4. **Redirect:** Next.js redirects the user to that URL.
- **Webhook Integration:**
  - Set up a Stripe Webhook pointing to your Django backend (e.g., `/api/payments/webhook/`).
  - Handle events like `checkout.session.completed` to update your database when a payment is successful.

## Vercel Flags SDK

If you are hosting on Vercel, the **Flags SDK** is the recommended "framework-native" way to handle toggles. It allows you to manage flags with full TypeScript support and integrates directly into the Vercel toolbar for instant previews in production without redeploying.

**Installation & Environment Setup**

First, install the SDK and the Vercel CLI to manage your environment variables.

- **Install the SDK:** Run `npm install flags` (or `pnpm install flags`).
- **Link & Sync:** In your terminal, run `vercel link` followed by `vercel env pull`. This pulls the `FLAGS` and `FLAGS_SECRET` environment variables required for the SDK to authenticate and handle overrides.

**Declare Your Feature Flag**

Create a `flags.ts` file (typically in your project root or `lib` folder) to define the flag as a function. This keeps your logic centralized and type-safe.

```typescript
// lib/flags.ts
import { flag } from 'flags/next';

export const showSocialProof = flag({
  key: 'social-proof-bar',
  // You can return a static boolean or use logic based on context
  decide() {
    return false; // Default to off
  },
});
```

**Use the Flag in a Component**

In the **App Router**, you can call this flag directly inside a Server Component. Because it is an async function, you `await` the value before rendering your UI.

```tsx
// app/page.tsx
import { showSocialProof } from '../lib/flags';
import { SocialProofBar } from '../components/SocialProofBar';

export default async function Page() {
  const isEnabled = await showSocialProof();

  return (
    <main>
      <h1>My SaaS</h1>
      {isEnabled && <SocialProofBar />}
    </main>
  );
}
```

## Sitemap and Robots.txt Automation

In the Next.js App Router, the native `sitemap.ts` and `robots.ts` files are special "Reserved File Names" that live in your `/app` directory. They act as server-side functions that automatically generate the correct `.xml` and `.txt` files for search engines.

**Implementing `sitemap.ts`**

This file should export a default function that returns an array of objects. Since you have a **Django DRF** backend, you can use `fetch` inside this function to include dynamic content like blog posts or product listings.

**File:** `app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://mysaas.com';

  // 1. Static Routes
  const staticRoutes = [
    '',
    '/pricing',
    '/features',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 1,
  }));

  // 2. Dynamic Routes from Django Backend
  let dynamicRoutes = [];
  try {
    const res = await fetch('https://mysaas.com');
    const posts = await res.json();
    dynamicRoutes = posts.map((post: any) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Sitemap fetch failed', error);
  }

  return [...staticRoutes, ...dynamicRoutes];
}
```

**Implementing `robots.txt`**

Similarly, `robots.ts` generates your crawling rules. For a SaaS app, you typically want to allow crawlers on your marketing frontend but **disallow** them on your actual application routes (like `/dashboard` or `/settings`) to protect user privacy.

**File:** `app/robots.ts`

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/api/',
        '/settings/',
        '/auth/'
      ],
    },
    sitemap: 'https://mysaas.com',
  };
}
```

**Best Practices for Your Setup**

- **Caching:** Next.js caches these routes by default. If your blog changes frequently, you can add `export const revalidate = 3600;` (one hour) to your `sitemap.ts` to ensure it stays fresh without hitting your Django API on every request.
- **Security:** Ensure your **Django** endpoint for the sitemap is public or uses a secret API key. You don't want your private "App" data leaking into a public sitemap.
- **Split Frontends:** Since your Marketing and App are separate Next.js projects, you should have unique `robots.ts` files for each. The App project's robots file should likely `disallow: /` entirely if there is no public-facing content.

##  Social Sharing

The built-in **Metadata API** is now the "standard" way to handle OpenGraph (Facebook/LinkedIn) and Twitter cards. Next.js has a special file convention called `opengraph-image.tsx`. You can literally write a component that generates a dynamic social share image (with the user's name or blog title) on the fly using Vercel OG.

In the Next.js App Router, metadata is handled strictly on the server. This is great for SEO because crawlers receive the full set of tags in the very first byte of HTML, before any JavaScript even runs on the client.

**Static Metadata**

Use this for pages where the SEO content doesn't change based on data (e.g., your Home, Pricing, or Contact pages). You simply export a `metadata` object.

**File:** `app/pricing/page.tsx`

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing Plans | MySaaS',
  description: 'Affordable plans for teams of all sizes.',
  alternates: {
    canonical: 'https://mysaas.com',
  },
};

export default function PricingPage() {
  return <h1>Our Plans</h1>;
}
```

**Dynamic Metadata (`generateMetadata`)**

Use this for pages that depend on dynamic data, such as a blog post from your **Django backend**. This function runs on the server, fetches your data, and returns the metadata object before the page is rendered.

**File:** `app/blog/[slug]/page.tsx`

```tsx
import { Metadata } from 'next';

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch data from your Django DRF backend
  const res = await fetch(`https://mysaas.com{params.slug}`);
  const post = await res.json();

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      images: [post.coverImage],
    },
  };
}

export default function BlogPost({ params }: Props) {
  return <article>...</article>;
}
```

**How it works "Under the Hood"**

1. **Server-Side Execution:** When a request hits your server, Next.js calls `generateMetadata` first.
2. **Request Deduplication:** If you fetch the same data in `generateMetadata` and the actual `Page` component, Next.js automatically memoizes the request. You won't hit your Django API twice; it fetches once and reuses the result.
3. **Head Injection:** Next.js streams the `<head>` section of the HTML with these tags already populated. By the time the user's browser starts rendering the `<body>`, the SEO work is already done.

**Key Rules**

- **No Client Components:** You cannot export metadata from a file that has `'use client'` at the top. If you need a client component on a page, keep the metadata in the `page.tsx` (Server Component) and import your client component into it.
- **Order of Precedence:** Metadata is evaluated from the root layout down to the page. A page's metadata will always overwrite conflicting tags in a layout.

**Standard SEO Tags**

You can define these directly in your `metadata` object or `generateMetadata` function.

- **Keywords:** Use the `keywords` property to pass an array of strings.
- **Robots:** Control indexing with granular precision (e.g., `index: true`, `follow: true`, or `nocache: true`).
- **Canonical URLs:** Use `alternates: { canonical: '...' }` to prevent duplicate content issues.
- **Verification:** Add tokens for services like **Google Search Console**, **Bing**, and **Yandex** using the `verification` object.

**Icons and Manifests**

Next.js uses a **file-based convention** for assets like favicons and social images, which is often easier than manual tagging.

- **Favicons:** Simply drop `favicon.ico`, `icon.png`, or `apple-icon.png` into the root of your `/app` directory, and Next.js will "automagically" generate the correct `<link>` tags.
- **Manifest:** Place a `manifest.json` (or a dynamic `manifest.ts` file) in your `/app` directory to handle PWA (Progressive Web App) metadata.

**Viewport and Theme**

For mobile-responsiveness and UI branding, use the dedicated **`viewport` export** instead of the main `metadata` object (which deprecated these fields in recent versions).

```tsx
// app/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}
```

**Catch-All for Non-Standard Tags**

If you need a niche or custom meta tag that isn't natively supported by a dedicated property, you can use the `other` key to render any key-value pair.

```tsx
export const metadata = {
  other: {
    'custom-meta-name': 'custom-value',
  },
}
```

## Structured Data (JSON-LD)

Next.js now officially recommends simply placing a standard `<script>` tag inside your **Server Component**. Since it's a Server Component, the JSON-LD is rendered as pure HTML on the server and sent to the browser—no extra JavaScript required.

**Example of the Native (Recommended) Approach:**

```tsx
// app/blog/[slug]/page.tsx
export default async function Page({ params }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Your SaaS Plan',
    description: 'The best SaaS for Next.js users',
  };

  return (
    <section>
      {/* This renders on the server and is perfect for SEO bots */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1>Our SaaS Pricing</h1>
    </section>
  );
}
```

## Analytics

**Vercel Analytics**

- **Speed:** Extremely lightweight; the script is roughly **44x smaller** than Google's.
- **Privacy:** Built-in anonymization; it does not use persistent cookies, making it easier to manage under GDPR.
- **Integration:** Designed as a first-party tool for Vercel users, minimizing the risk of being blocked by ad-blockers.
- **Limitations:** Offers basic metrics only; lacks advanced reporting like heatmaps or cross-platform tracking.

**Google Analytics (GA4)**

- **Depth:** Provides massive insights into customer journeys, including predictive analytics and AI-powered patterns.
- **Marketing:** Seamlessly integrates with Google Ads for conversion tracking and audience building.
- **Complexity:** Often described as "clunky" or overpowered for simple projects, with a steeper learning curve.
- **Tracking:** Uses cookies and more invasive tracking, requiring a robust consent management system.

**Strategic Trade-offs**

Choosing between them usually comes down to your project's current scale and goals.

| Attribute | Vercel Analytics | Google Analytics (GA4) |
| --- | --- | --- |
| **Best For** | Developers & Performance | Marketers & E-commerce |
| **Price** | Free tier (25k events), then paid | Free for most usage levels |
| **GDPR Setup** | Simple (no cookies) | Complex (requires banner) |
| **Setup Effort** | Near zero (one-click) | Moderate (requires script/ID) |

**Recommendation for Your SaaS**

Given your setup with separate marketing and app frontends:

- **On the Marketing Frontend:** You may want **GA4** if you plan on running paid ads to track specific conversion funnels deeply.
- **On the App Frontend:** Use **Vercel Analytics** to monitor app health and usage without the performance tax or privacy overhead of Google's script.

## Integrations

 **Ghost, Beehiiv, and Kit (formerly ConvertKit) all possess APIs capable of accepting HTML markup to create and distribute newsletters, but they handle, sanitize, and alter that HTML differently.** 

While all three platforms support programmatically injecting content, they enforce varying structural guardrails. These restrictions can impact how closely your final delivered newsletter matches your raw source markup.

------

Platform Breakdown

### Ghost Admin API

Ghost offers the most developer-friendly flexibility for custom HTML injection.

- **The Endpoint**: You can use the [Ghost Admin API Posts Endpoint](https://docs.ghost.org/admin-api/posts/creating-a-post) to generate a post. By adding the query parameter `?source=html`, you can send raw HTML strings directly in the JSON payload `{"posts": [{"title": "...", "html": "<p>Content</p>"}]}`.
- **How it Handles HTML**: Internally, Ghost converts your HTML into its native **Lexical** editor format. This native conversion is lossy, meaning complex semantic styling might render differently.
- **Lossless Hack**: If you need completely untouched, 100% exact HTML, you can wrap your code in a special Ghost HTML card block wrapper `<!-- kg-card-begin: html --> Your HTML <!-- kg-card-end: html -->`. This bypasses the parser entirely.
- **Distribution**: Setting the post status to `published` or `scheduled` triggers delivery to your newsletter subscribers based on your default tier routing.

### Beehiiv API

Beehiiv features an API structured entirely around safety and mobile responsiveness, imposing strict guardrails.

- **The Endpoint**: You can use the [Beehiiv Create Post Endpoint](https://developers.beehiiv.com/api-reference/posts/create) or request enterprise access to their specialized **Send API**. You pass your HTML as a string inside the `body_content` parameter.
- **How it Handles HTML**: Beehiiv actively strips out all global `<style>` and `<link>` tags through a sanitization pipeline to prevent rendering breaking on email clients. Inline CSS rules (`style="..."`) are preserved.
- **The Caveat**: You **cannot send a 100% custom HTML email** layout. The markup string you send is automatically nested within Beehiiv's own structural grid layout, master theme config, and mandatory footer compliance blocks. 

### Kit (ConvertKit) API

Kit relies on a highly flexible paradigm combining custom markup with preset template frames.

- **The Endpoint**: You can interact with the [Kit Broadcasts API](https://developers.kit.com/api-reference/broadcasts/update-a-broadcast) to programmatically handle email distributions. By issuing a `POST` or `PUT` request, you pass your newsletter markup into the `"content"` JSON string parameter.
- **How it Handles HTML**: Kit acts as an injector. The HTML you feed into the `"content"` string populates the body area of the message.
- **The Caveat**: By default, it will inject your custom HTML directly into your account's chosen default master email layout template. To gain exact design control, you should supply an explicit `"email_template_id"` parameter referencing a structural raw HTML template you built directly in the Kit UI.

------

Direct Comparison Matrix

| Platform Feature              | Ghost                                        | Beehiiv                                | Kit (ConvertKit)                            |
| ----------------------------- | -------------------------------------------- | -------------------------------------- | ------------------------------------------- |
| **API Endpoint**              | `/admin/posts/?source=html`                  | `/v2/publications/.../posts`           | `/v4/broadcasts`                            |
| **Accepts Raw HTML?**         | Yes (Lossless via comments)                  | Yes (Sanitized via `body_content`)     | Yes (Via `"content"` variable)              |
| **Strips Global `<style>`?**  | No                                           | Yes (Only inline CSS allowed)          | Restricts inside body string                |
| **Enforces Platform Layout?** | Optional                                     | Yes (Fixed system shell & footer)      | Yes (Injects into a template ID)            |
| **Primary Limitation**        | Auto-converts to Lexical format if unescaped | High sanitation; removes external tags | Content string is framed by layout wrappers |

A self-hosted instance of **Ghost** **operates by separating transactional emails from bulk newsletter deliveries**, meaning it requires two entirely different mail setups to function.

While Ghost handles content management, member databases, and web rendering on your own server, it cannot directly broadcast newsletters to thousands of subscribers on its own.

------

How the Architecture Works

When running a self-hosted Ghost newsletter, the application relies on an external split-email architecture:

- **The Self-Hosted Core**: You install Ghost on your own virtual private server (like DigitalOcean or Linode). This server runs Node.js and a MySQL database to store your posts, member lists, and analytical data.
- **Transactional Email (SMTP)**: Standard automated triggers (like welcome emails, password resets, and login magic links) are routed through a basic SMTP server configured in your `config.production.json` file.
- **Bulk Newsletter Email (Mailgun API)**: Mass newsletter broadcasts completely bypass standard SMTP. Because web servers lack the reputation to deliver thousands of emails without hitting spam folders, Ghost hardcoded a native API integration exclusively with **Mailgun** for all newsletter deliveries.

------

The Email Servers You Connect To

To run a fully functional newsletter, you must connect your self-hosted instance to the following services:

1. Bulk Newsletter Delivery: Mailgun (Mandatory)

For sending newsletter blasts to your subscribers, **Ghost requires a Mailgun account**.

- **Why Mailgun?** Ghost's source code relies on the Mailgun bulk API to batch-send emails, track open rates, and handle unsubscribe webhooks seamlessly.
- **Can you use other bulk providers?** Out of the box, **no**. You cannot native-connect Amazon SES, Brevo, or Postmark for bulk newsletter blasts through the standard dashboard. Using a non-Mailgun provider for newsletters requires altering the open-source code, using third-party developer forks, or handling delivery via Zapier automations.
- Transactional Email: Any SMTP Provider (Flexible)

For single-recipient system emails (magic login links and signup confirmations), you must configure a standard SMTP server. You can use almost any major provider by editing your system config file, including:

- **Mailgun SMTP** (Most common, keeping everything under one roof)
- **Amazon SES** (Highly cost-effective option for system alerts)
- **Postmark** (Renowned for instant magic-link delivery speeds)
- **Brevo** or **SendGrid**
