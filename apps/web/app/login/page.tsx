import { Panel } from "@ritzy-studio/ui";
import Image from "next/image";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AccessForm } from "./access-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { message } = await searchParams;

  return (
    <main className="min-h-dvh bg-page px-5 py-16 text-ink md:px-8 lg:px-16">
      <section className="mx-auto grid max-w-[1180px] grid-cols-1 border border-line bg-surface md:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-10 p-8 md:p-12 lg:p-16">
          <p className="font-body text-caption font-medium uppercase tracking-[0.36em] text-ink-muted">
            Ritzy Studio
          </p>
          <h1 className="max-w-[720px] font-display text-display-l font-light leading-[0.95] tracking-[-0.02em] text-ink md:text-display-xl">
            Design the home you want, with furniture you can actually afford.
          </h1>
          <p className="max-w-[58ch] font-body text-body-l text-ink-secondary">
            Upload a photo of your room. We design it with real furniture at your budget, and give
            you links to shop every piece.
          </p>
        </div>

        <Panel className="order-3 border-0 border-t border-line p-8 md:order-none md:border-0 md:border-s md:border-line md:p-12">
          <p className="font-body text-caption font-medium uppercase tracking-[0.36em] text-ink-muted">
            Access
          </p>

          {message ? (
            <p className="mt-6 border-t border-error pt-4 font-display text-body-m italic text-error">
              {message}
            </p>
          ) : null}

          <AccessForm />
        </Panel>

        <figure className="order-2 border-t border-line bg-surface-subtle md:order-none md:col-span-2">
          <Image
            alt="Photorealistic designed living room with layered furniture, warm lighting, and polished interior styling"
            className="aspect-[4/5] h-auto w-full object-cover sm:aspect-[16/9] lg:aspect-[5/2]"
            height={1080}
            priority
            sizes="(min-width: 1024px) 1180px, 100vw"
            src="/landing-hero.webp"
            width={1440}
          />
        </figure>
      </section>
    </main>
  );
}
