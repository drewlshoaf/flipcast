"use client";

import { useState } from "react";
import { FlipcastForm } from "./flipcast-form";
import { IdeasPanel } from "./ideas-panel";

interface Props {
  defaultSpeed: number;
}

export function FlipcastPageClient({ defaultSpeed }: Props) {
  const [topic, setTopic] = useState("");

  return (
    <div className="two-col">
      <section className="col-left">
        <h1>Flipcast</h1>
        <p className="tag">
          The world&apos;s first personalized on-demand podcast. Pick a topic,
          a format, and a vibe — we&apos;ll produce the rest.
        </p>
        <FlipcastForm
          topic={topic}
          setTopic={setTopic}
          defaultSpeed={defaultSpeed}
        />
      </section>
      <IdeasPanel onSelect={setTopic} />
    </div>
  );
}
