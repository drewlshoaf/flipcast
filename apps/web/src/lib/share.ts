// Share-target URL builders + a small registry used by the EndPanel and the
// always-on PlayerActions toolbar. Centralized so adding a new target (or
// changing share copy) updates both surfaces.

export interface ShareTargetMeta {
  key: string;
  label: string;
  accent: string; // tailwind classes for the tile bg + text
  build: (topic: string, url: string) => string;
}

export function twitterHref(topic: string, url: string): string {
  const text = encodeURIComponent(`Listen to "${topic}" on flipcast`);
  return `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`;
}

export function facebookHref(_topic: string, url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function linkedinHref(_topic: string, url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export function redditHref(topic: string, url: string): string {
  return `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(topic)}`;
}

export function whatsappHref(topic: string, url: string): string {
  const text = encodeURIComponent(`Listen to "${topic}" on flipcast — ${url}`);
  return `https://wa.me/?text=${text}`;
}

export function threadsHref(topic: string, url: string): string {
  const text = encodeURIComponent(`Listen to "${topic}" on flipcast — ${url}`);
  return `https://www.threads.net/intent/post?text=${text}`;
}

export function emailHref(topic: string, url: string): string {
  const subject = encodeURIComponent(`flipcast — ${topic}`);
  const body = encodeURIComponent(
    `Thought you'd like this:\n\n"${topic}"\n\n${url}`,
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

export const SHARE_TARGETS: ShareTargetMeta[] = [
  { key: "x", label: "X", accent: "bg-ink-900 text-white", build: twitterHref },
  { key: "facebook", label: "Facebook", accent: "bg-sky-600 text-white", build: facebookHref },
  { key: "linkedin", label: "LinkedIn", accent: "bg-sky-700 text-white", build: linkedinHref },
  { key: "reddit", label: "Reddit", accent: "bg-orange-500 text-white", build: redditHref },
  { key: "whatsapp", label: "WhatsApp", accent: "bg-emerald-500 text-white", build: whatsappHref },
  { key: "threads", label: "Threads", accent: "bg-ink-900 text-white", build: threadsHref },
  { key: "email", label: "Email", accent: "bg-violet-500 text-white", build: emailHref },
];

export function playerUrl(requestId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/player/${requestId}`;
}

export function embedSnippet(url: string): string {
  return `<iframe src="${url}" width="100%" height="640" frameborder="0" allow="autoplay" loading="lazy"></iframe>`;
}
