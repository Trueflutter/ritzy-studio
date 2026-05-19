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
      <section className="mx-auto grid min-h-[calc(100dvh-128px)] max-w-[1180px] border border-line bg-surface lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col justify-between p-8 md:p-16">
          <div>
            <p className="font-body text-caption font-medium uppercase tracking-[0.36em] text-ink-muted">
              Ritzy Studio
            </p>
            <h1 className="mt-8 max-w-[720px] font-display text-display-l font-light leading-[0.95] tracking-[-0.02em] text-ink md:text-display-xl">
              Design the home you want, with furniture you can actually afford.
            </h1>
            <p className="mt-10 max-w-[58ch] font-body text-body-l text-ink-secondary">
              Upload a photo of your room. We design it with real furniture at your budget, and
              give you links to shop every piece.
            </p>
          </div>
          <figure className="mt-14 max-w-[720px] border border-line bg-surface-subtle">
            <Image
              alt="Photorealistic designed living room with layered furniture, warm lighting, and polished interior styling"
              className="aspect-[4/3] h-auto w-full object-cover"
              height={1080}
              priority
              src="/landing-hero.webp"
              width={1440}
            />
          </figure>
        </div>

        <Panel className="border-0 border-s border-line p-8 md:p-12">
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
      </section>
    </main>
  );
}
