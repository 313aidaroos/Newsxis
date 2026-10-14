import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/public-site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Newsxis terms: 13 and older, AI-labeled news, corrections, and reporter billing through the Apixis Wallet.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">Terms of use</h1>
      <p className="nx-sub">{SITE_NAME} is a service of Apixis Dev LLC. These terms cover the website, the radio pages, and the reporter seat.</p>
      <div className="nx-grid">
        <section className="nx-card" id="age">
          <h3>13 and older</h3>
          <p>Newsxis is for people 13 and older. Watching does not need an account. Signing in asks you to confirm that you are 13 or older. An account that answers no is blocked and cannot post, pay, or continue. Graphic news media stays off until a signed-in person turns it on, and then it stays blurred until hover.</p>
        </section>
        <section className="nx-card" id="ai">
          <h3>AI-generated label</h3>
          <p>Cixy writes the news stories, briefings, and the opt-in daily report. Every one of those is labeled as AI-generated and names the source it was written from. Cixy does not add facts that are not in the sources. Where sources disagree, the thread shows Another side. Conflicting facts are marked Disputed. Two or more independent sources can mark a story Confirmed.</p>
        </section>
        <section className="nx-card" id="corrections">
          <h3>Corrections</h3>
          <p>When a story is wrong, a correction is posted in its thread and the story is updated. Report an error from the story page or at <a href="/support?kind=correction">support</a>. A person reviews corrections and takedowns within 24 hours. Newsxis publishes summaries and short quotes with a link to the original. Full transcripts appear only where the station allows them.</p>
        </section>
        <section className="nx-card" id="accounts">
          <h3>Accounts</h3>
          <p>The only sign-in is Apixis ID. Newsxis does not offer a separate password or email signup. One Apixis account is the login for this site and the shared Wallet.</p>
        </section>
        <section className="nx-card" id="billing">
          <h3>Reporter seat and sponsorship</h3>
          <p>A reporter seat is $10 (1,000 Ixis) to activate and $10 (1,000 Ixis) a month. It renews until you cancel. You choose card or Ixis. Both are charged by the Apixis Wallet. Newsxis does not take card numbers and does not keep an Ixis balance. Cancel any time; access stays until the paid period ends. A sponsor line on a briefing is 5,000 Ixis ($50), one time. Every completed purchase has a receipt on the billing page.</p>
        </section>
        <section className="nx-card" id="conduct">
          <h3>Posts</h3>
          <p>Reporter posts are checked before they go live. Do not post private people's home addresses, medical details, or anything that is not yours to share. Newsxis can hold or remove a post.</p>
        </section>
        <section className="nx-card">
          <h3>Contact</h3>
          <p>Apixis Dev LLC · newsxis@apixis.dev · <a href="/privacy">Privacy</a> · <a href="/about">About</a></p>
        </section>
      </div>
    </div>
  );
}
