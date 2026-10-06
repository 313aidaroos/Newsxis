import { SupportForm } from "./SupportForm";

export const metadata = { title: "Support" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; story?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="nx-page nx-page-narrow" style={{ maxWidth: 620 }}>
      <h1 className="nx-h1">Support, complaints, corrections</h1>
      <p className="nx-sub">Cixy answers first; the Newsxis editor reviews corrections, takedowns, ads and partnerships within 24 hours. Email: newsxis@apixis.dev</p>
      <SupportForm kind={sp.kind} storyId={sp.story} />
    </div>
  );
}
