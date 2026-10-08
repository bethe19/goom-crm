import { Link } from "react-router-dom";
import { LegalPage } from "@/components/marketing/MarketingLayout";
import { SITE } from "@/components/marketing/site";
import { TRIAL_DAYS } from "@/lib/plans";

// OWNER TODO: have this text reviewed by a lawyer. The legal entity, contact mailbox and
// "last updated" date come from src/components/marketing/site.ts and are placeholders.
export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      eyebrow="Legal"
      sections={[
        {
          heading: "Agreement to terms",
          body: (
            <p>
              By accessing or using {SITE.name} ("the Service"), operated by {SITE.legalEntity} ("we," "us," or "our"), you
              agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the
              Service.
            </p>
          ),
        },
        {
          heading: "Account registration and security",
          body: (
            <p>
              When you create an account, you must provide accurate, complete and current information. You are responsible
              for safeguarding the credentials you use to access the Service and for any activities or actions under your
              account.
            </p>
          ),
        },
        {
          heading: "Customer data and confidentiality",
          body: (
            <p>
              You retain all rights and ownership in the data you submit to the Service ("Customer Data"). We do not sell,
              rent or lease your Customer Data to third parties. We maintain reasonable safeguards to protect Customer Data
              against unauthorized access.
            </p>
          ),
        },
        {
          // OWNER TODO: confirm refund, price-change and data-retention-after-expiry terms with counsel.
          heading: "Free trial and fees",
          body: (
            <>
              <p>
                Each new workspace starts with a free trial of {TRIAL_DAYS} days. No payment details are needed to start a
                trial.
              </p>
              <p>
                To keep using a workspace after its trial, a workspace admin chooses a paid plan. Paid plans are billed per
                workspace for a subscription period at the prices shown on our{" "}
                <Link to="/pricing" className="underline underline-offset-4">
                  pricing page
                </Link>{" "}
                and are paid by invoice or bank transfer. A paid period starts when we confirm your payment. We do not store
                card details, and nothing is charged automatically.
              </p>
              <p>
                When a trial or paid period ends without payment for a further period, access to the workspace and its
                Customer Data is suspended until a paid plan is activated. Your Customer Data is retained while access is
                suspended, and access is restored once a paid plan is active.
              </p>
            </>
          ),
        },
        {
          heading: "Limitation of liability",
          body: (
            <p>
              To the maximum extent permitted by applicable law, {SITE.legalEntity} shall not be liable for any indirect,
              incidental, special, consequential or punitive damages resulting from your access to or use of the Service.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              Questions about these Terms can be sent to{" "}
              <a href={`mailto:${SITE.legalEmail}`} className="underline underline-offset-4">
                {SITE.legalEmail}
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
