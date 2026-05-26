"use client";

import type { VisualStyleOption } from "@ritzy-studio/domain";
import Image from "next/image";
import { useState } from "react";

export function VisualStyleSelector({
  selectedStyleSlugs,
  styles
}: {
  avoidedStyleSlugs?: string[];
  selectedStyleSlugs: string[];
  styles: VisualStyleOption[];
}) {
  const [selected, setSelected] = useState(selectedStyleSlugs);

  function toggleStyle(style: VisualStyleOption) {
    const nextSelected = selected.includes(style.slug)
      ? selected.filter((slug) => slug !== style.slug)
      : [...selected, style.slug];

    setSelected(nextSelected);

    const field = document.getElementById("styleNotes") as HTMLTextAreaElement | null;
    if (!field) {
      return;
    }

    const summary = styles
      .filter((option) => nextSelected.includes(option.slug))
      .map((option) => `${option.name}: ${option.description}`)
      .join("\n");

    const generated = summary ? `Selected visual styles:\n${summary}` : "";
    if (!field.value.trim() || field.value.startsWith("Selected visual styles:")) {
      field.value = generated;
    }
  }

  return (
    <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
      {styles.map((style) => {
        const checked = selected.includes(style.slug);

        return (
          <article className="bg-surface p-4" key={style.slug}>
            <label className="group block cursor-pointer">
              <input
                checked={checked}
                className="peer sr-only"
                name="styleSlugs"
                onChange={() => toggleStyle(style)}
                type="checkbox"
                value={style.slug}
              />
              <span className="block border border-line bg-page transition-colors duration-standard ease-standard peer-checked:border-ink peer-checked:bg-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring">
                <span className="relative block aspect-[4/3] overflow-hidden bg-surface-subtle">
                  <Image
                    alt={`${style.name} interior style reference`}
                    className="h-full w-full object-cover transition-transform duration-standard ease-standard group-hover:scale-[1.02]"
                    height={360}
                    unoptimized
                    src={styleImageUrl(style.slug)}
                    width={480}
                  />
                  <span
                    aria-hidden
                    className={
                      checked
                        ? "absolute right-3 top-3 inline-flex size-7 items-center justify-center border border-ink bg-ink text-surface"
                        : "absolute right-3 top-3 inline-flex size-7 items-center justify-center border border-ink-muted bg-surface/80 text-transparent transition-colors group-hover:border-ink"
                    }
                  >
                    <svg
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  </span>
                </span>
                <span className="block p-4">
                  <span className="block font-display text-display-xs font-light tracking-[-0.02em] text-ink">
                    {style.name}
                  </span>
                  <span className="mt-2 block font-body text-body-s text-ink-muted">
                    {style.description}
                  </span>
                </span>
              </span>
            </label>
          </article>
        );
      })}
    </div>
  );
}

function styleImageUrl(slug: string) {
  const images: Record<string, string> = {
    modern:
      "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1200&q=88",
    contemporary:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=88",
    scandinavian:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=88",
    industrial:
      "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1200&q=88",
    traditional:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=88",
    bohemian:
      "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1200&q=88"
  };

  return images[slug] ?? images.modern;
}
