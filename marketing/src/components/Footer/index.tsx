import Link from "next/link";
import { PageSection } from "../Section";
import { brand } from "@/lib/props";

/**
 * Marketing site footer navigation.
 */
export function Footer() {
  return (
    <PageSection as="footer" id="marketing-footer" classes="flex items-center gap-6 py-4 sm:my-6">
      <div className="flex flex-col gap-5 rounded-3xl border border-trim-offset bg-page-base px-6 py-6 text-sm text-content-offset shadow-soft backdrop-blur-[18px] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-trim-offset bg-secondary text-xs font-black tracking-widest text-primary shadow-soft">
            DE
          </span>
          <div>
            <p className="m-0 text-sm font-semibold text-content-active">
              {brand.name}
            </p>
            <p className="m-0 text-sm">{brand.tagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/docs"
            className="no-underline transition-colors hover:text-content-active"
          >
            Docs
          </Link>
          <Link
            href="#features"
            className="no-underline transition-colors hover:text-content-active"
          >
            How It Works
          </Link>
          <Link
            href="#pricing"
            className="no-underline transition-colors hover:text-content-active"
          >
            Pricing
          </Link>
          <Link
            href="/privacy"
            className="no-underline transition-colors hover:text-content-active"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="no-underline transition-colors hover:text-content-active"
          >
            Terms
          </Link>
          <Link
            href="/cookies"
            className="no-underline transition-colors hover:text-content-active"
          >
            Cookies
          </Link>
          <Link
            href="/compliance"
            className="no-underline transition-colors hover:text-content-active"
          >
            Compliance
          </Link>
          <span>AGPLv3</span>
        </div>
      </div>
    </PageSection>
  );
}
