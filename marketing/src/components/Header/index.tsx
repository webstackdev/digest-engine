"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { PageSection } from "../Section";
import logo from "@/assets/images/logo.svg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { brand } from "@/lib/props";

const navigationItems = [
  { href: "/tour", label: "How It Works" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/signup", label: "Sign Up" },
];

/**
 * Marketing site header navigation.
 */
export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const mobileMenuLabel = isMobileMenuOpen
    ? "Close navigation menu"
    : "Open navigation menu";

  return (
    <PageSection
      as="header"
      id="marketing-nav"
      shadowClass="shadow-card-strong"
      classes="fixed inset-x-4 top-4 z-50 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-4">
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

        <div className="ml-auto flex shrink-0 items-center gap-3 md:gap-4">
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

          <ThemeToggle />

          <button
            type="button"
            aria-controls="mobile-navigation"
            aria-expanded={isMobileMenuOpen}
            aria-label={mobileMenuLabel}
            title={mobileMenuLabel}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="inline-flex size-11 items-center justify-center rounded-full bg-page-offset text-secondary transition-colors hover:text-secondary-offset md:hidden"
          >
            {isMobileMenuOpen ? (
              <X aria-hidden="true" className="size-6" strokeWidth={1.9} />
            ) : (
              <Menu aria-hidden="true" className="size-6" strokeWidth={1.9} />
            )}
            <span className="sr-only">{mobileMenuLabel}</span>
          </button>

          <Link
            href="/login"
            className="hidden rounded-full bg-accent px-4 py-2 text-base font-semibold text-primary-inverse no-underline transition-colors hover:bg-accent-offset sm:text-lg md:inline-flex"
          >
            Login
          </Link>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div
          id="mobile-navigation"
          className="flex flex-col gap-4 border-t border-trim-offset pt-4 md:hidden"
        >
          <nav className="flex flex-col gap-3">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-medium tracking-tight text-secondary transition-colors hover:text-secondary-offset"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/login"
            onClick={() => setIsMobileMenuOpen(false)}
            className="inline-flex w-full items-center justify-center rounded-full bg-accent px-4 py-2 text-base font-semibold text-primary-inverse no-underline transition-colors hover:bg-accent-offset"
          >
            Login
          </Link>
        </div>
      ) : null}
    </PageSection>
  );
}
