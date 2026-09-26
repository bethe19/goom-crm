import { LegalPage } from "@/components/marketing/MarketingLayout";
import { SITE } from "@/components/marketing/site";

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
          heading: "Fees",
          body: (
            <p>
              The Service is currently provided free of charge during a beta period. If paid plans are introduced, their
              prices and billing terms will be published before any charges apply, and paid use will require your
              agreement.
            </p>
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
