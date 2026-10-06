export const metadata = { title: "About" };

export default function About() {
  return (
    <div className="nx-page nx-page-narrow">
      <h1 className="nx-h1">About Newsxis</h1>
      <p className="nx-sub">Real-time news for every place on Earth. Built and owned by Apixis Family Company, Illinois.</p>
      <div className="nx-grid">
        <section className="nx-card" id="ai"><h3>AI-generated, always labeled</h3><p>Cixy, the Apixis family's AI, listens to public radio and free news feeds, writes each story from what the source said, and labels it <em>Written by Cixy from [source]</em>. She never adds facts; she attributes everything. Where she can, she researches the story on the open web and posts what confirms it, what tells it differently (<strong>Another side</strong>), and marks conflicting facts <strong>Disputed</strong>. Stories with two or more independent sources are <strong>Confirmed</strong>.</p></section>
        <section className="nx-card" id="corrections"><h3>Corrections</h3><p>When a story is wrong, a correction is posted in its thread and the story is updated. Report an error from any story page or at <a href="/support?kind=correction">/support</a>. Corrections and takedowns are reviewed by a person within 24 hours.</p></section>
        <section className="nx-card" id="sources"><h3>Sources and copyright</h3><p>Newsxis publishes summaries and short quotes with a link to the original station or publisher. Full transcripts are shown only where the station allows it. Scanner audio comes only from licensed providers, and private people's names, addresses and medical details are removed.</p></section>
        <section className="nx-card" id="reporters"><h3>Reporters</h3><p>Anyone 13+ can watch for free. Posting from the ground needs a reporter seat (1,000 Ixis to activate, 1,000 Ixis a month), paid through the Apixis Wallet. Posts are checked by Cixy before they go live. Graphic real-news media is allowed, blurred by default, and can be switched off in settings.</p></section>
        <section className="nx-card" id="privacy"><h3>Privacy</h3><p>We keep your email and IP address for fraud, tax and legal purposes. Your home area is used for your feed and alerts. We do not sell personal data. Questions: newsxis@apixis.dev.</p></section>
        <section className="nx-card" id="family"><h3>The Apixis family</h3><p>One Apixis ID, one Wallet (100 Ixis = $1, bought only on the Apixis Wallet, never refunded, not an investment), one Cixy. Every Newsxis account gets its own agent in the <a href="https://www.apixis.dev" target="_blank" rel="noreferrer">Apixis world</a>.</p></section>
      </div>
    </div>
  );
}
