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
              Quiet design work, grounded in real pieces.
            </h1>
            <p className="mt-10 max-w-[58ch] font-body text-body-l text-ink-secondary">
              A studio surface for residential interior design — built around the room itself, the
              brief in front of you, and the pieces your clients will actually live with.
            </p>
          </div>
          <figure className="mt-14 max-w-[720px] border border-line bg-surface-subtle">
            <Image
              alt="Warm gallery-style living room with sculptural seating, layered neutral textiles, and refined natural light"
              className="aspect-[16/9] h-auto w-full object-cover"
              height={949}
              priority
              src="/login-hero-living-room.jpg"
              width={1800}
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
