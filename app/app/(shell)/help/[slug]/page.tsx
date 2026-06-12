import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

// Minimal markdown rendering for help articles: headings, bold, lists.
function renderMarkdown(md: string): React.ReactNode[] {
  const blocks = md.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith("# ")) return null; // page title shown separately
    if (trimmed.startsWith("## "))
      return (
        <h2 key={i} className="mt-6 font-brand text-base font-bold text-navy">
          {trimmed.slice(3)}
        </h2>
      );
    if (/^(\d+\.|-|\*)\s/.test(trimmed)) {
      const items = trimmed.split("\n").map((line) =>
        line.replace(/^(\d+\.|-|\*)\s/, "")
      );
      return (
        <ul key={i} className="list-disc space-y-1.5 pl-5 font-body text-sm leading-relaxed text-steel">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="font-body text-sm leading-[1.7] text-steel">
        {renderInline(trimmed)}
      </p>
    );
  });
}

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-navy">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part.replace(/\*([^*]+)\*/g, "$1")}</span>
    )
  );
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: article } = await supabase
    .from("help_article")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!article) notFound();

  return (
    <>
      <PageHeader title={article.title} />
      <div className="flex-1 p-8">
        <div className="max-w-[680px]">
          <Link
            href="/app/help"
            className="mb-4 inline-block font-body text-sm text-steel hover:text-navy"
          >
            ← All help articles
          </Link>
          <Card className="space-y-4">
            {renderMarkdown(article.body_markdown)}
          </Card>
        </div>
      </div>
    </>
  );
}
