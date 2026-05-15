import Image from "next/image";
import Link from "next/link";
import { PageSection } from "../Section";
import logo from "@/assets/images/logo.svg";
import { brand } from "@/lib/props";

const navigationItems = [
  { href: "/features", label: "How It Works" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/signup", label: "Sign Up" },
];

/**
 * Marketing site header navigation.
 */
export function Header() {
  return (
    <PageSection
      as="header"
      id="marketing-nav"
      shadowClass="shadow-card-strong"
      classes="fixed inset-x-0 top-2 z-50 flex justify-between items-center gap-6 px-3"
    >
      <Link
        href="/"
        className="flex shrink-0 items-center gap-3 text-content-active no-underline"
      >
        <Image
          src={logo}
          alt={`${brand.name} logo`}
          className="h-16 w-16 shrink-0"
          priority
        />
        <span className="ml-2 text-xl font-semibold tracking-tight text-secondary hover:text-secondary-offset sm:text-3xl">
          {brand.name}
        </span>
      </Link>

      <div className="ml-auto flex shrink-0 items-center gap-6 sm:gap-8">
        <nav className="hidden items-center gap-6 sm:gap-8 md:flex">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-base sm:text-lg font-medium tracking-tight transition-colors text-secondary hover:text-secondary-offset"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="rounded-full bg-accent hover:bg-accent-offset text-base sm:text-lg font-semibold text-primary-inverse no-underline transition-colors px-4 py-2"
        >
          Login
        </Link>
      </div>
    </PageSection>
  );
}
