import { Button, ButtonLink, Panel, TextInput } from "@ritzy-studio/ui";
import { redirect } from "next/navigation";

import { createProjectWithRoomAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-dvh bg-page px-5 py-16 text-ink md:px-8 lg:px-16">
      <section className="mx-auto max-w-[720px]">
        <p className="font-body text-caption font-medium uppercase text-ink-muted">
          N° 02 — New project
        </p>
        <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
          Name this project
        </h1>

        <Panel className="mt-12 p-8 md:p-12">
          <form action={createProjectWithRoomAction}>
            <TextInput
              id="name"
              label="Project name"
              name="name"
              narrative
              placeholder="villa al barari"
              required
            />
            <TextInput id="clientName" label="Client name" name="clientName" />
            <TextInput id="location" label="Location" name="location" placeholder="Dubai" />

            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                id="budgetMinAed"
                inputMode="numeric"
                label="Budget minimum"
                name="budgetMinAed"
                placeholder="AED"
              />
              <TextInput
                id="budgetMaxAed"
                inputMode="numeric"
                label="Budget maximum"
                name="budgetMaxAed"
                placeholder="AED"
              />
            </div>

            <div className="mt-8 border-t border-line pt-8">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                First room
              </p>
              <div className="mt-8">
                <TextInput
                  id="roomName"
                  label="Room name"
                  name="roomName"
                  narrative
                  placeholder="main living room"
                  required
                />
                <TextInput
                  id="roomType"
                  label="Room type"
                  name="roomType"
                  placeholder="living room"
                  required
                />
              </div>
            </div>

            <div className="mt-12 flex items-center justify-end gap-6">
              <ButtonLink href="/" trailing="→" variant="quiet">
                cancel
              </ButtonLink>
              <Button type="submit">Continue</Button>
            </div>
          </form>
        </Panel>
      </section>
    </main>
  );
}
