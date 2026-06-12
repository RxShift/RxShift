import Nav from "@/components/nav";
import Hero from "@/components/hero";
import Problem from "@/components/problem";
import Features from "@/components/features";
import NevadaCallout from "@/components/nevada-callout";
import WorksEverywhere from "@/components/works-everywhere";
import PricingSignal from "@/components/pricing-signal";
import ContactForm from "@/components/contact-form";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Features />
        <NevadaCallout />
        <WorksEverywhere />
        <PricingSignal />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
