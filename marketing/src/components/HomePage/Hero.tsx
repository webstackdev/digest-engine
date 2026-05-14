import Image from "next/image";
import Link from "next/link";
import heroImage from "@/assets/images/hero.png";
import { PageSection } from "../Section";
import { Button } from "../shared/button";
import { IHeroProps } from "@/lib/types";

/**
 * Marketing landing page hero.
 */
const Hero = ({ description, title, btnGetStarted }: IHeroProps) => {
  return (
    <PageSection id="about" classes="px-8 sm:px-12 pt-4 sm:pt-8 pb-4 sm:pb-10">
      <div className="relative grid items-center gap-10 lg:grid-cols-2">
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="max-w-2xl text-content-active text-lg sm:text-xl leading-8">
              {description}
            </p>
          </div>

          {btnGetStarted && btnGetStarted.text.trim() !== "" ? (
            <Button
              asChild
              variant="default"
              size="lg"
              className="h-12 rounded-full bg-accent text-primary-inverse hover:bg-accent-offset text-lg font-semibold transition-colors px-6"
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
    </PageSection>
  );
};

export default Hero;
