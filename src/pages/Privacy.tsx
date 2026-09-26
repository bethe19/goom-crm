import { LegalPage } from "@/components/marketing/MarketingLayout";
import { SITE } from "@/components/marketing/site";

// OWNER TODO: have this text reviewed by a lawyer (controller identity, legal bases, retention
// periods, international transfers, jurisdiction). Entity, mailbox and date live in site.ts.
export default function Privacy() {
  const privacyLink = (
    <a href={`mailto:${SITE.privacyEmail}`} className="underline underline-offset-4">
      {SITE.privacyEmail}
    </a>
  );

  return (
    <LegalPage
      title="Privacy Policy"
      eyebrow="Privacy"
      sections={[
        {
          heading: "Introduction",
          body: (
            <p>
              This Privacy Policy explains what information {SITE.legalEntity} ("{SITE.name}," "we," "us") collects, how we
              use it, and how it is protected when you visit our website or use our application.
            </p>
          ),
        },
        {
          heading: "Data we collect",
          body: (
            <>
              <p>We collect information you give us when you create an account, use your workspace or contact us:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Account details (name, email address, and a securely hashed password)</li>
                <li>Workspace data you enter (deals, pipeline stages, contacts, companies, activities and tasks)</li>
                <li>Messages sent through our contact form (name, email, company and message)</li>
                <li>Basic technical logs kept by our hosting provider to operate and secure the service</li>
              </ul>
            </>
          ),
        },
        {
          heading: "How we use your data",
          body: (
            <p>
              We use your information only to provide, maintain and improve the Service and to respond to you. We do not sell
              your personal or workspace data to advertisers or data brokers.
            </p>
          ),
        },
        {
          heading: "Service providers",
          body: (
            <p>
              We use a cloud database and authentication provider to host the Service. When you use the AI assistant, your
              question and a summary of your workspace data (such as deals, tasks and recent activity) are sent to our AI
              model provider to generate the answer.
            </p>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>
              Data is sent over encrypted (HTTPS) connections and stored with a provider that encrypts data at rest. Access to
              workspace data is restricted in the database so that only members of a workspace can read or change its
              records.
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p>
              Depending on where you live, you may have the right to access, correct, export or delete your personal
              information. You can export workspace data from the app and delete your account from Settings, or contact us
              at {privacyLink}.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: <p>If you have questions about this Privacy Policy, contact us at {privacyLink}.</p>,
        },
      ]}
    />
  );
}
