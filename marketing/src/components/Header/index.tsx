import Image from "next/image";
import Link from "next/link";
import { PageSection } from "../Section";
import logo from "@/assets/images/logo.svg";
import { brand } from "@/lib/props";

const navigationItems = [
  { href: "/features", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/signup", label: "Sign Up" },
];

/**
 * Marketing site header navigation.
 */
export function Header() {
  return (
    <PageSection as="header" id="marketing-nav" classes="flex items-center gap-6 mt-6 sm:mt-8">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-3 text-foreground no-underline"
      >
        <Image
          src={logo}
          alt={`${brand.name} logo`}
          className="h-16 w-16 shrink-0"
          priority
        />
        <span className="ml-2 text-xl font-semibold tracking-tight text-primary hover:text-foreground sm:text-3xl">
          {brand.name}
        </span>
      </Link>

      <div className="ml-auto flex shrink-0 items-center gap-6 sm:gap-8">
        <nav className="hidden items-center gap-6 sm:gap-8 md:flex">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-base font-medium tracking-tight text-primary transition-colors hover:text-foreground sm:text-lg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary"
        >
          Login
        </Link>
      </div>
    </PageSection>
  );
}
