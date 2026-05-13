import Image from "next/image";
import Link from "next/link";
import heroImage from "@/assets/images/hero.png";
import { Button } from "../shared/button";
import { IHeroProps } from "@/lib/types";

/**
 * Marketing landing page hero.
 */
const Hero = ({ description, title, btnGetStarted }: IHeroProps) => {
  return (
    <section
      id="about"
      className="relative overflow-hidden rounded-display border border-brand-border-bright bg-card px-6 py-8 shadow-brand-panel backdrop-blur-[18px] sm:px-8 sm:py-10 lg:px-12 lg:py-14"
    >
      <div className="absolute inset-0 bg-brand-surface-overlay opacity-70" />
      <div className="relative grid items-center gap-10 lg:grid-cols-2">
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-brand-sage-600 sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-foreground sm:text-xl">
              {description}
            </p>
          </div>

          {btnGetStarted && btnGetStarted.text.trim() !== "" ? (
            <Button
              asChild
              variant="default"
              size="lg"
              className="h-12 rounded-full bg-brand-fill-accent-soft px-6 text-brand-fill-accent-contrast text-button font-semibold transition-colors hover:bg-brand-fill-accent"
            >
              <Link href={btnGetStarted.link}>{btnGetStarted.text}</Link>
            </Button>
          ) : null}
        </div>

        <div className="relative mx-auto w-full max-w-2xl lg:pl-6">
          <div className="relative">
            <Image
              src={heroImage}
              alt="Digest Engine product illustration"
              priority
              width={558}
              height={431}
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
