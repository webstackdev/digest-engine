import type { PageMapItem } from "nextra";
import { getPageMap } from "nextra/page-map";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { isValidElement, type ReactNode } from "react";

import { PageSection } from "@/components/Section";

import {
  DocsPageSidebar,
  type DocsSidebarItem,
  type DocsSidebarSection,
} from "./_components/DocsPageSidebar";

type DocsRouteParams = {
  mdxPath: string[];
};

const docsBasePath = "/docs";

const generateNextraStaticParams = generateStaticParamsFor("mdxPath");

function getItemTitle(item: PageMapItem): string {
  const fallbackTitle = "name" in item ? item.name : "Documentation";

  if ("frontMatter" in item && item.frontMatter) {
    return item.frontMatter.sidebarTitle ?? item.frontMatter.title ?? fallbackTitle;
  }

  return fallbackTitle;
}

function buildSidebarItems(items: PageMapItem[]): DocsSidebarItem[] {
  return items.flatMap<DocsSidebarItem>((item) => {
    if ("data" in item) {
      return [];
    }

    if ("children" in item) {
      const children = buildSidebarItems(item.children);

      if (!children.length) {
        return [];
      }

      return [{ title: getItemTitle(item), children }];
    }

    if (!item.route || item.route === docsBasePath) {
      return [];
    }

    return [{ title: getItemTitle(item), href: item.route }];
  });
}

function buildSidebarSections(items: PageMapItem[]): DocsSidebarSection[] {
  return items.flatMap((item) => {
    if ("data" in item || !("children" in item)) {
      return [];
    }

    const sectionItems = buildSidebarItems(item.children);

    if (!sectionItems.length) {
      return [];
    }

    return [{ title: getItemTitle(item), items: sectionItems }];
  });
}

function getHeadingText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => getHeadingText(item)).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(value)) {
    return getHeadingText(value.props.children);
  }

  return "";
}

export async function generateStaticParams(): Promise<DocsRouteParams[]> {
  const params = (await generateNextraStaticParams()) as DocsRouteParams[];

  return params
    .map(({ mdxPath }) => mdxPath.filter(Boolean))
    .filter((mdxPath) => mdxPath[0] === "docs" && mdxPath.length > 1)
    .map(([, ...mdxPath]) => ({ mdxPath }));
}

export default async function Page(props: { params: Promise<DocsRouteParams> }) {
  const params = await props.params;
  const [{ default: MDXPage, metadata, toc }, pageMap] = await Promise.all([
    importPage(["docs", ...params.mdxPath]),
    getPageMap(docsBasePath),
  ]);
  const currentPath = `${docsBasePath}/${params.mdxPath.join("/")}`;
  const sidebarSections = buildSidebarSections(pageMap);
  const serializedToc = toc.map((heading) => ({
    ...heading,
    value: getHeadingText(heading.value),
  }));

  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="docs-content" classes="px-6 py-8 sm:px-10 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <article className="nextra-body-typesetting-article min-w-0 wrap-break-word text-content-active">
            <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-content-offset">
              <span className="rounded-full border border-trim-offset bg-page-base px-3 py-1 shadow-soft backdrop-blur-[18px]">
                Documentation
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-content-offset sm:block" />
              <span>{metadata.title}</span>
            </div>
            <MDXPage {...props} params={params} />
          </article>

          <DocsPageSidebar
            currentPath={currentPath}
            navigation={sidebarSections}
            toc={serializedToc}
          />
        </div>
      </PageSection>
    </main>
  );
}
