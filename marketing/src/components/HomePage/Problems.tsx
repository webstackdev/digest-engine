import { FC } from "react";
import { PageSection } from "../Section";

const Problems: FC<{
  title: string;
  description: string;
}> = ({ title, description }) => {

  return (
    <PageSection>
      <section className="border-t border-trim-offset bg-primary px-6 py-20 text-center text-primary-inverse">
        <div className="mx-auto max-w-3xl">
          <span className="mb-3 block text-sm font-semibold uppercase tracking-wider text-primary-inverse">Introducing Digest Engine</span>
          <h2 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {title}
          </h2>
          <p className="text-lg leading-relaxed text-primary-inverse">
            {description}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl bg-page-base px-6 py-24 text-content-active">
        <div className="mb-16 text-center">
          <h3 className="text-3xl font-bold tracking-tight text-content-active sm:text-4xl">
            Engineered for deep domain authority
          </h3>
          <p className="mt-4 text-lg text-content-offset">
            Generic tools look at global clicks. Digest Engine builds a custom intelligence model tailored exclusively to your niche.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          { /* Feature 1: Authority Scoring */ }
          <div className="rounded-2xl border border-trim-offset bg-page-base p-8 transition-shadow hover:shadow-lg">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary font-bold text-primary">🤝</div>
            <h4 className="mb-2 text-xl font-bold text-content-active">Peer-Endorsed Authority</h4>
            <p className="text-sm leading-relaxed text-content-offset">
              We cross-reference peer newsletters in your niche to see who top industry editors are actually linking to. Cut through hyped social noise with a human-curated signal.
            </p>
          </div>

          { /* Feature 2: Unified Entity Model */ }
          <div className="rounded-2xl border border-trim-offset bg-page-base p-8 transition-shadow hover:shadow-lg">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary font-bold text-primary">🌐</div>
            <h4 className="mb-2 text-xl font-bold text-content-active">Unified Profile Tracking</h4>
            <p className="text-sm leading-relaxed text-content-offset">
              Stop checking five apps. We track key figures across their personal blogs, LinkedIn, Bluesky, GitHub, and conference schedules, binding them into a single score.
            </p>
          </div>

          { /* Feature 3: Competitive Intelligence */ }
          <div className="rounded-2xl border border-trim-offset bg-page-base p-8 transition-shadow hover:shadow-lg">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary font-bold text-primary">🚨</div>
            <h4 className="mb-2 text-xl font-bold text-content-active">Competitive Guardrails</h4>
            <p className="text-sm leading-relaxed text-content-offset">
              Never get scooped again. Get instant alerts if three competitor newsletters in your space have already covered a topic, so you always bring a fresh angle.
            </p>
          </div>

          { /* Feature 4: Per-Project Relevance */ }
          <div className="rounded-2xl border border-trim-offset bg-page-base p-8 transition-shadow hover:shadow-lg">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary font-bold text-primary">🎯</div>
            <h4 className="mb-2 text-xl font-bold text-content-active">Personalized Algorithmic Training</h4>
            <p className="text-sm leading-relaxed text-content-offset">
              Every project has its own content pipeline. Simple upvote/downvote feedback trains a localized relevance model to deeply understand your editorial point of view.
            </p>
          </div>

          { /* Feature 5: Historical Trend Analysis */ }
          <div className="rounded-2xl border border-trim-offset bg-page-base p-8 transition-shadow hover:shadow-lg">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary font-bold text-primary">📈</div>
            <h4 className="mb-2 text-xl font-bold text-content-active">Macro Trend Trajectories</h4>
            <p className="text-sm leading-relaxed text-content-offset">
              Look beyond the 24-hour hype cycle. Content is retained indefinitely, mapping trajectory patterns over weeks to help you write deep-dive evolutionary pieces.
            </p>
          </div>

          { /* Feature 6: Simplicity / Django Context */ }
          <div className="rounded-2xl border border-trim-offset bg-page-base p-8 transition-shadow hover:shadow-lg">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary font-bold text-primary">🛠️</div>
            <h4 className="mb-2 text-xl font-bold text-content-active">Zero Database Complexity</h4>
            <p className="text-sm leading-relaxed text-content-offset">
              Built for non-technical editorial teams. No vector databases to configure, with secure workspace partitioning to share access across your writing staff cleanly.
            </p>
          </div>

        </div>
      </section>
    </PageSection>
  );
};

export default Problems;
