import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { Access } from "./sections/access";
import { FinalCta } from "./sections/final-cta";
import { Footer } from "./sections/footer";
import { FromConceptToCart } from "./sections/from-concept-to-cart";
import { Hero } from "./sections/hero";
import { HowItWorks } from "./sections/how-it-works";
import { Nav } from "./sections/nav";
import { Philosophy } from "./sections/philosophy";
import { Pricing } from "./sections/pricing";
import { StyleLibrary } from "./sections/style-library";
import { TrustBar } from "./sections/trust-bar";

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
    <main className="min-h-dvh bg-page text-ink">
      <Nav />
      <Hero />
      <TrustBar />
      <Access message={message} />
      <Philosophy />
      <StyleLibrary />
      <HowItWorks />
      <FromConceptToCart />
      <Pricing />
      <FinalCta />
      <Footer />
    </main>
  );
}
