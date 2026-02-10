import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContactForm } from "../components/contact-form";
import { ViewBillingCta } from "@/components/view-billing-cta";

const FEATURES = [
  {
    title: "Inventory tracking per vessel",
    description: "Track required vs actual inventory for each vessel. Run checks, record what's on board, and see gaps at a glance.",
  },
  {
    title: "Maintenance schedules & reminders",
    description: "Define recurring maintenance tasks and get reminders so nothing slips. Log completed work with notes and dates.",
  },
  {
    title: "Activity history & audit trail",
    description: "See who logged what and when. Full audit trail for inventory checks, maintenance, and vessel updates.",
  },
  {
    title: "Organization roles & permissions",
    description: "Invite team members with Admin or Member roles. Control who can manage vessels, billing, and settings.",
  },
  {
    title: "Comments & notes per vessel",
    description: "Add comments and notes on each vessel so your team stays aligned. Context lives where the work is.",
  },
];

const STEPS = [
  {
    step: 1,
    title: "Sign up and create your org",
    description: "Get started in minutes. Create an organization and invite your team.",
  },
  {
    step: 2,
    title: "Add vessels and set up inventory",
    description: "Add your vessels, define required inventory, and optionally import from CSV or Excel.",
  },
  {
    step: 3,
    title: "Run checks and stay on schedule",
    description: "Perform inventory checks, log maintenance, and use the dashboard to stay on top of everything.",
  },
];

const PRICING_EXAMPLES = [
  { vessels: 8, base: 19, packs: 1, packPrice: 25, total: 44 },
  { vessels: 18, base: 19, packs: 3, packPrice: 25, total: 94 },
  { vessels: 48, base: 19, packs: 9, packPrice: 25, total: 244 },
];

const SUPPORT_EMAIL = "support@dock-ops.com";

export default function MarketingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-16 sm:py-24">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="flex justify-center">
                <Image
                  src="/assets/logo.png"
                  alt="DockOps"
                  width={160}
                  height={53}
                  className="h-12 w-auto sm:h-14"
                  priority
                />
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Inventory + maintenance for your vessels
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Track required vs actual inventory, schedule maintenance, and keep an audit trail—all in one place. Built for marinas, clubs, and fleets.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Get Started
                </Link>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container mx-auto px-4 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
              Everything you need to run your fleet
            </h2>
            <p className="text-muted-foreground">
              From inventory checks to maintenance logs and team collaboration.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-16 sm:py-24">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
                How it works
              </h2>
              <p className="text-muted-foreground">
                Get from signup to daily use in three steps.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3 max-w-4xl mx-auto">
              {STEPS.map((item) => (
                <div key={item.step} className="text-center space-y-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container mx-auto px-4 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
              Simple pricing
            </h2>
            <p className="text-muted-foreground">
              Base plan includes 3 vessels. Add more with vessel packs.
            </p>
          </div>
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <div className="rounded-lg border bg-card px-4 py-3">
                <span className="font-medium">Base:</span> $20/mo (3 vessels)
              </div>
              <div className="rounded-lg border bg-card px-4 py-3">
                <span className="font-medium">+5 vessels:</span> $10/mo per pack
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {PRICING_EXAMPLES.map((ex) => (
                <Card key={ex.vessels}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{ex.vessels} vessels</CardTitle>
                    <CardDescription>
                      Base + {ex.packs} pack{ex.packs !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${ex.total}/mo</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      $20 + {ex.packs}×$10
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <ViewBillingCta />
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-16 sm:py-24">
            <div className="max-w-xl mx-auto space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
                  Contact us
                </h2>
                <p className="text-muted-foreground mb-2">
                  Questions or want to discuss your fleet? Reach out.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-primary font-medium hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <ContactForm />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} DockOps. All rights reserved.
              </p>
              <nav className="flex items-center gap-6">
                <Link
                  href="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy
                </Link>
              </nav>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
