import { eventCategories } from "@localloop/domain";

const foundationItems = [
  "Next.js App Router",
  "Tailwind CSS",
  "Shared domain validation",
  "Provider adapter boundary",
  "Drizzle/PostGIS schema"
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-loop-mist text-loop-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-loop-moss">
          Local event discovery
        </p>
        <div className="mt-5 max-w-3xl">
          <h1 className="text-5xl font-semibold leading-tight md:text-7xl">LocalLoop</h1>
          <p className="mt-6 text-lg leading-8 text-loop-ink/75 md:text-xl">
            Initial development foundation for an open-source DMV-area event discovery app.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <section className="rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Scaffold Includes</h2>
            <ul className="mt-4 space-y-3 text-sm text-loop-ink/75">
              {foundationItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-loop-leaf" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-loop-ink/10 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Event Categories</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {eventCategories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-loop-moss/20 bg-loop-mist px-3 py-1 text-sm text-loop-moss"
                >
                  {category}
                </span>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
