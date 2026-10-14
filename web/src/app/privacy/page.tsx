import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Newsxis privacy policy. Emails and IP addresses are kept for fraud, tax, and legal purposes.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Privacy</h1>
      <p className="nx-sub">Apixis Dev LLC operates Newsxis. This page says what the site keeps and why.</p>
      <div className="nx-grid">
        <section className="nx-card" id="kept">
          <h3>What we keep</h3>
          <p>We keep your email address and IP address for fraud, tax, and legal purposes. Sign-in is Apixis ID. The account record stores the Apixis id, the 13+ answer, your display name, and the home area you set for the feed and alerts. Payment card numbers stay with the Apixis Wallet. Newsxis stores the receipt the Wallet returns: date, product, amount, and whether you paid by card or Ixis.</p>
        </section>
        <section className="nx-card" id="use">
          <h3>How it is used</h3>
          <p>Your home area chooses which stories and alerts you see. The 13+ answer decides whether the account can continue. Reporter purchases unlock posting. The opt-in daily report is written only if you turn it on. We do not sell personal data.</p>
        </section>
        <section className="nx-card" id="cookies">
          <h3>Cookies</h3>
          <p>A session cookie keeps you signed in. A short-lived cookie records that you answered the 13+ question before Apixis sign-in starts. That cookie is not an account.</p>
        </section>
        <section className="nx-card" id="sources">
          <h3>News sources</h3>
          <p>Stories quote and link to public stations and feeds. Scanner audio is used only from licensed providers, and private names, addresses, and medical details are removed before anything is published.</p>
        </section>
        <section className="nx-card">
          <h3>Questions</h3>
          <p>newsxis@apixis.dev · <a href="/support">Support</a> · <a href="/terms">Terms</a></p>
        </section>
      </div>
    </div>
  );
}
