import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { PageMapItem } from "nextra";
import { getPageMap } from "nextra/page-map";
import { ArrowRight, Newspaper } from "lucide-react";

import { blogPreviewImages } from "@/content/blog/images";

import { brand } from "@/lib/props";

type BlogCard = {
  href: string;
  title: string;
  description: string;
  previewImage: StaticImageData | string;
  publishedAt?: string;
};

type BlogFrontMatter = {
  title?: string;
  description?: string;
  publishedAt?: string;
};

export const metadata: Metadata = {
  title: `${brand.name} Blog`,
  description: "Product notes, release write-ups, and editorial articles from the Digest Engine team.",
};

function getFolderTitle(item: PageMapItem): string {
  if ("frontMatter" in item && item.frontMatter?.title) {
    return String(item.frontMatter.title);
  }

  return "name" in item ? item.name : "Article";
}

function buildBlogCards(items: PageMapItem[]): BlogCard[] {
  return items.flatMap<BlogCard>((item) => {
    if ("data" in item) {
      return [];
    }

    if ("children" in item) {
      return buildBlogCards(item.children);
    }

    if (!item.route?.startsWith("/blog/") || item.route === "/blog") {
      return [];
    }

    const slug = item.route.replace("/blog/", "");
    const previewImage = blogPreviewImages[slug];

    const frontMatter = (
      "frontMatter" in item ? item.frontMatter : undefined
    ) as BlogFrontMatter | undefined;

    if (!previewImage) {
      return [];
    }

    return [
      {
        href: item.route,
        title: getFolderTitle(item),
        description:
          frontMatter?.description ?? "Read the latest post from the Digest Engine team.",
        previewImage,
        publishedAt: frontMatter?.publishedAt,
      },
    ];
  });
}

export default async function BlogHomePage() {
  const pageMap = await getPageMap("/blog");
  const posts = buildBlogCards(pageMap);

  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-4xl border border-slate-200 bg-linear-to-br from-orange-50 via-white to-amber-50 px-6 py-10 shadow-[0_30px_80px_-48px_rgba(146,64,14,0.6)] sm:px-10 sm:py-12">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-sm">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
            Blog
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Notes, experiments, and launch stories from the {brand.name} team.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-700">
            This route stays visually independent from the docs area. Each post can bring its own imagery, voice, and long-form layout while the index page stays optimized for browsing.
          </p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.href}
            href={post.href}
            className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-44px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-1"
          >
            <article className="flex h-full flex-col">
              <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                <Image
                  src={post.previewImage}
                  alt={post.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(min-width: 1280px) 22rem, (min-width: 768px) 45vw, 100vw"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 px-6 py-6">
                {post.publishedAt ? (
                  <p className="text-sm font-medium text-orange-700">{post.publishedAt}</p>
                ) : null}
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{post.title}</h2>
                  <p className="text-base leading-7 text-slate-600">{post.description}</p>
                </div>
                <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-slate-900">
                  Read article
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </div>
            </article>
          </Link>
        ))}
      </section>
    </main>
  );
}
