"use client";

import type { VisualStyleOption } from "@ritzy-studio/domain";
import Image from "next/image";
import { useState } from "react";

export function VisualStyleSelector({
  avoidedStyleSlugs,
  selectedStyleSlugs,
  styles
}: {
  avoidedStyleSlugs: string[];
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
        const avoided = avoidedStyleSlugs.includes(style.slug);

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
                  {checked ? (
                    <span className="absolute right-3 top-3 border border-ink bg-surface px-3 py-2 font-body text-caption font-medium uppercase text-ink">
                      Selected
                    </span>
                  ) : null}
                </span>
                <span className="block p-4">
                  <span className="font-display text-body-l font-light italic text-ink">
                    {style.name}
                  </span>
                  <span className="mt-2 block font-body text-body-s text-ink-secondary">
                    {style.description}
                  </span>
                  <span className="mt-4 inline-flex h-10 items-center justify-center border border-line-strong px-4 font-body text-caption font-medium uppercase text-ink transition-colors group-hover:border-ink peer-checked:bg-ink peer-checked:text-surface">
                    {checked ? "Selected" : "Select"}
                  </span>
                </span>
              </span>
            </label>
            <label className="mt-3 flex items-start gap-3 border-t border-line pt-3 font-body text-body-s text-ink-secondary">
              <input
                className="mt-1 size-4 accent-[var(--rs-primary)]"
                defaultChecked={avoided}
                name="avoidStyleSlugs"
                type="checkbox"
                value={style.slug}
              />
              Not this direction
            </label>
          </article>
        );
      })}
    </div>
  );
}

function styleImageUrl(slug: string) {
  const images: Record<string, string> = {
    "warm-minimal":
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=960&q=80",
    "modern-organic":
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=960&q=80",
    "quiet-luxury":
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=960&q=80",
    "classic-contemporary":
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=960&q=80",
    "coastal-light":
      "https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=960&q=80",
    "earthy-rustic":
      "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=960&q=80"
  };

  return images[slug] ?? images["warm-minimal"];
}
