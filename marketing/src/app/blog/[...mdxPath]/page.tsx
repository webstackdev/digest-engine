import type { Metadata } from "next";
import Image from "next/image";
import { generateStaticParamsFor, importPage } from "nextra/pages";

import { blogHeroImages } from "@/content/blog/images";

type BlogRouteParams = {
  mdxPath: string[];
};

type BlogPageComponentProps = {
  params: BlogRouteParams;
};

type BlogMetadata = Metadata & {
  title: string;
  description?: string;
  publishedAt?: string;
};

const generateNextraStaticParams = generateStaticParamsFor("mdxPath");

export async function generateStaticParams(): Promise<BlogRouteParams[]> {
  const params = (await generateNextraStaticParams()) as BlogRouteParams[];

  return params
    .map(({ mdxPath }) => mdxPath.filter(Boolean))
    .filter((mdxPath) => mdxPath[0] === "blog" && mdxPath.length > 1)
    .map(([, ...mdxPath]) => ({ mdxPath }));
}

export async function generateMetadata(props: {
  params: Promise<BlogRouteParams>;
}): Promise<Metadata> {
  const params = await props.params;
  const { metadata } = await importPage(["blog", ...params.mdxPath]);

  return metadata;
}

export default async function BlogArticlePage(props: { params: Promise<BlogRouteParams> }) {
  const params = await props.params;
  const slug = params.mdxPath.join("/");
  const heroImage = blogHeroImages[slug];
  const { default: MDXPage, metadata } = (await importPage([
    "blog",
    ...params.mdxPath,
  ])) as {
    default: React.ComponentType<BlogPageComponentProps>;
    metadata: BlogMetadata;
  };

  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <article className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-[0_32px_90px_-56px_rgba(15,23,42,0.55)]">
        <div className="relative aspect-2/1 bg-slate-100">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={metadata.title}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 64rem, 100vw"
            />
          ) : null}
        </div>

        <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <header className="space-y-4 border-b border-slate-200 pb-8">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-orange-100 px-3 py-1 font-medium text-orange-700">
                Blog
              </span>
              {metadata.publishedAt ? <span>{metadata.publishedAt}</span> : null}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {metadata.title}
              </h1>
              {metadata.description ? (
                <p className="max-w-3xl text-lg leading-8 text-slate-600">{metadata.description}</p>
              ) : null}
            </div>
          </header>

          <div className="nextra-body-typesetting-article min-w-0 wrap-break-word text-slate-800">
            <MDXPage {...props} params={params} />
          </div>
        </div>
      </article>
    </main>
  );
}
