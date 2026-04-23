"use client";

import { TOPIC_HELPERS, pickRandomPrompt } from "@/lib/topic-helpers";
import { useT } from "@/lib/i18n/client";

interface Props {
  topic: string;
  onTopicChange: (s: string) => void;
  // Optional CTA rendered inside the card (e.g. the home-page hero button).
  // Studio doesn't need one — its Generate button lives elsewhere.
  actionButton?: React.ReactNode;
}

export function TopicComposer({ topic, onTopicChange, actionButton }: Props) {
  const t = useT();
  const helpers = TOPIC_HELPERS;

  return (
    <section className="glass rounded-[32px] p-7 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            {t.composer.heading}
          </h2>
          <p className="mt-1 max-w-md text-sm text-ink-500">
            {t.composer.subhead}
          </p>
        </div>
        <span className="chip chip-pink hidden md:inline-flex">
          {t.composer.chip}
        </span>
      </div>

      <textarea
        value={topic}
        onChange={(e) => onTopicChange(e.target.value)}
        placeholder={t.studio.topicPlaceholder}
        rows={3}
        className="w-full resize-none rounded-2xl bg-white/80 px-5 py-4 text-lg leading-snug text-ink-900 outline-none ring-1 ring-slate-200 transition placeholder:text-ink-300 focus:ring-2 focus:ring-sky-300"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {helpers.map((cat) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => onTopicChange(pickRandomPrompt(cat.prompts))}
            className="chip chip-slate transition hover:bg-white/80 hover:shadow-card"
          >
            {cat.label}
          </button>
        ))}
      </div>

      {actionButton && <div className="mt-5">{actionButton}</div>}
    </section>
  );
}
