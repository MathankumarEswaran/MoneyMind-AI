import { Check, Fingerprint, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";

const CONTROLS = [
  {
    title: "Sessions that expire",
    detail:
      "Short-lived access tokens stay in memory. Refresh tokens rotate, are hashed at rest, and reuse trips the whole session family.",
  },
  {
    title: "Password hygiene",
    detail:
      "Argon2id hashing, breached-password screening and constant-time verification. No passwords in logs, ever.",
  },
  {
    title: "Validation at the edge",
    detail:
      "Every HTTP payload, env var and AI tool call passes a schema before it touches domain code.",
  },
  {
    title: "Per-user isolation",
    detail:
      "Repositories scope every query by user ID. RAG retrieval filters by owner before ranking — no cross-tenant context.",
  },
  {
    title: "Uploads treated as hostile",
    detail:
      "File type, size and checksum allowlists; malware scanning; sandboxed parsing; bounded chunk sizes.",
  },
  {
    title: "Prompt-injection containment",
    detail:
      "Documents are delimited untrusted data, never instructions. The copilot cannot write without explicit confirmation.",
  },
] as const;

const LIVE_TODAY = [
  "Argon2id password hashing",
  "Short-lived access tokens",
  "Rotating HttpOnly refresh cookies",
  "Session revocation and reuse detection",
  "Rate limiting and request IDs",
  "Helmet headers and payload caps",
] as const;

export function SecuritySection() {
  return (
    <section id="security" className="relative scroll-mt-28 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck aria-hidden="true" className="size-3" />
              Security architecture
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-[2.6rem] sm:leading-[1.08]">
              Money data deserves paranoid defaults.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              Security is designed into each phase and verified in Phase 8. Phase 2 adds Argon2id
              credentials, rotating refresh tokens and per-user isolation; uploads and AI tools
              inherit the same boundary discipline.
            </p>

            <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
              <div className="flex items-center gap-2">
                <Fingerprint
                  aria-hidden="true"
                  className="size-4 text-emerald-600 dark:text-emerald-400"
                />
                <h3 className="text-sm font-semibold">Live in Phase 2</h3>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LIVE_TODAY.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check aria-hidden="true" className="size-3.5 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
              Hardening is verified against the OWASP Top 10, OWASP ASVS and the OWASP LLM Top 10 in
              Phase 8.
            </p>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {CONTROLS.map((control, index) => (
              <Reveal
                key={control.title}
                delay={index * 0.04}
                className="rounded-2xl border border-border/80 bg-card p-5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Check aria-hidden="true" className="size-3.5" />
                  </span>
                  <h3 className="text-[13px] font-semibold">{control.title}</h3>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{control.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
