import { Button, Card, Chip, Panel, SegmentedControl, Tab, Tabs, TextInput } from "@ritzy-studio/ui";

const previewItems = [
  {
    label: "Concept",
    title: "Initial concepts",
    detail: "Room image and brief become visual directions before product matching."
  },
  {
    label: "Source",
    title: "Real products",
    detail: "Approved concepts are grounded in UAE retailer products and verified URLs."
  },
  {
    label: "Render",
    title: "Client package",
    detail: "Final renders and shopping lists stay visually connected but truth-separated."
  }
];

export default function Home() {
  return (
    <main className="min-h-dvh bg-page px-5 py-16 text-ink md:px-8 lg:px-12 xl:px-16">
      <div className="mx-auto grid min-h-[calc(100dvh-128px)] max-w-[1440px] border border-line bg-surface lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-e border-line p-6 lg:block">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</p>
          <nav className="mt-16 space-y-4 font-body text-body-s text-ink-muted">
            <p className="text-ink">Projects</p>
            <p>Rooms</p>
            <p>Catalog</p>
            <p>Settings</p>
          </nav>
        </aside>

        <section className="flex min-h-full flex-col">
          <header className="flex min-h-20 items-center justify-between border-b border-line px-5 md:px-8 lg:px-12">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">N° 002</p>
            <Tabs aria-label="Foundation preview">
              <Tab active>scaffold</Tab>
              <Tab>tokens</Tab>
              <Tab>shell</Tab>
            </Tabs>
          </header>

          <div className="grid flex-1 gap-12 p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-12 xl:grid-cols-[minmax(0,1fr)_480px]">
            <section className="flex flex-col justify-between">
              <div className="max-w-[720px]">
                <p className="mb-6 font-body text-caption font-medium uppercase text-ink-muted">
                  Quiet Gallery
                </p>
                <h1 className="font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
                  Design system shell, ready for product work.
                </h1>
                <p className="mt-8 max-w-[66ch] font-body text-body-l leading-[1.7] text-ink-secondary">
                  The app now has a locked visual foundation: square controls, hairline
                  panels, restrained typography, and a calm operational layout for the
                  upcoming project workflow.
                </p>

                <div className="mt-12 flex flex-wrap gap-4">
                  <Button>Begin project</Button>
                  <Button variant="secondary">Review system</Button>
                  <Button trailing="→" variant="quiet">
                    view handoff
                  </Button>
                </div>
              </div>

              <div className="mt-20 grid gap-6 md:grid-cols-3">
                {previewItems.map((item, index) => (
                  <Card className="p-6" key={item.title}>
                    <p className="font-display text-[28px] italic leading-none text-accent-deep">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-8 font-body text-caption font-medium uppercase text-ink-muted">
                      {item.label}
                    </p>
                    <h2 className="mt-5 font-display text-display-s font-light tracking-[-0.01em] text-ink">
                      {item.title}
                    </h2>
                    <p className="mt-5 font-body text-body-s text-ink-secondary">{item.detail}</p>
                  </Card>
                ))}
              </div>
            </section>

            <Panel className="p-8">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Component proof
              </p>

              <div className="mt-8">
                <TextInput
                  id="project-name"
                  label="Project name"
                  narrative
                  placeholder="emirates hills living room"
                />
                <TextInput
                  id="budget"
                  label="Budget"
                  placeholder="AED 85,000"
                />
              </div>

              <div className="mt-8">
                <SegmentedControl options={["Concept", "Source", "Render"]} value="Concept" />
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Chip active>modern classic</Chip>
                <Chip>warm neutral</Chip>
                <Chip>verified</Chip>
              </div>

              <div className="mt-12 border-t border-line pt-8">
                <p className="font-body text-caption font-medium uppercase text-ink-muted">
                  Foundation status
                </p>
                <p className="mt-5 font-display text-display-s font-light italic text-ink">
                  F-002 in progress
                </p>
                <p className="mt-5 font-body text-body-s text-ink-secondary">
                  This screen is a constrained shell preview only. Real auth and project
                  workflows begin in the following slices.
                </p>
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}
