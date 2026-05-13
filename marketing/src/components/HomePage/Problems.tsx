import { FC } from "react";
import { PageSection } from "../Section";

const Problems: FC<{
  title: string;
  description: string;
}> = ({ title, description }) => {

  return (
    <PageSection>
      <section className="bg-slate-900 text-white py-20 px-6 text-center border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          <span className="text-indigo-400 font-semibold uppercase tracking-wider text-sm block mb-3">Introducing Digest Engine</span>
          <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-6">
            {title}
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            {description}
          </p>
        </div>
      </section>

      <section className="bg-white text-slate-900 py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Engineered for deep domain authority
          </h3>
          <p className="mt-4 text-lg text-slate-600">
            Generic tools look at global clicks. Digest Engine builds a custom intelligence model tailored exclusively to your niche.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          { /* Feature 1: Authority Scoring */ }
          <div className="border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow bg-slate-50">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-6 font-bold">🤝</div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Peer-Endorsed Authority</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              We cross-reference peer newsletters in your niche to see who top industry editors are actually linking to. Cut through hyped social noise with a human-curated signal.
            </p>
          </div>

          { /* Feature 2: Unified Entity Model */ }
          <div className="border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow bg-slate-50">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-6 font-bold">🌐</div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Unified Profile Tracking</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Stop checking five apps. We track key figures across their personal blogs, LinkedIn, Bluesky, GitHub, and conference schedules, binding them into a single score.
            </p>
          </div>

          { /* Feature 3: Competitive Intelligence */ }
          <div className="border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow bg-slate-50">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-6 font-bold">🚨</div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Competitive Guardrails</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Never get scooped again. Get instant alerts if three competitor newsletters in your space have already covered a topic, so you always bring a fresh angle.
            </p>
          </div>

          { /* Feature 4: Per-Project Relevance */ }
          <div className="border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow bg-slate-50">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-6 font-bold">🎯</div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Personalized Algorithmic Training</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Every project has its own content pipeline. Simple upvote/downvote feedback trains a localized relevance model to deeply understand your editorial point of view.
            </p>
          </div>

          { /* Feature 5: Historical Trend Analysis */ }
          <div className="border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow bg-slate-50">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-6 font-bold">📈</div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Macro Trend Trajectories</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Look beyond the 24-hour hype cycle. Content is retained indefinitely, mapping trajectory patterns over weeks to help you write deep-dive evolutionary pieces.
            </p>
          </div>

          { /* Feature 6: Simplicity / Django Context */ }
          <div className="border border-slate-200 rounded-2xl p-8 hover:shadow-lg transition-shadow bg-slate-50">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-6 font-bold">🛠️</div>
            <h4 className="text-xl font-bold text-slate-900 mb-2">Zero Database Complexity</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Built for non-technical editorial teams. No vector databases to configure, with secure workspace partitioning to share access across your writing staff cleanly.
            </p>
          </div>

        </div>
      </section>
    </PageSection>
  );
};

export default Problems;
