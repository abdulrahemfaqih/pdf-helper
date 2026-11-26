import Link from "next/link";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { buildHomeJsonLd } from "@/lib/seo";
import { TOOLS_CONFIG } from "@/lib/tools-config";

export default function HomePage() {
  const jsonLd = buildHomeJsonLd();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-10">
        <section aria-labelledby="home-heading" className="mb-7">
          <h1
            id="home-heading"
            className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          >
            Alat PDF cepat tanpa login.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Semua proses berjalan aman langsung di browser Anda.
          </p>
        </section>

        <section aria-label="Daftar alat PDF">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {TOOLS_CONFIG.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.slug}
                  href={tool.href}
                  className="group flex flex-col rounded-lg border border-border bg-background p-5 transition-colors duration-150 hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <div className="mb-3.5 flex size-9 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors duration-150 group-hover:border-primary/30 group-hover:bg-accent-blue group-hover:text-primary">
                    <Icon className="size-4.5" strokeWidth={1.75} />
                  </div>
                  <h2 className="text-base font-medium text-foreground">
                    {tool.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
