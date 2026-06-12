import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import HelpAssistant from "@/components/app/help/help-assistant";
import type { HelpArticle } from "@/lib/types";

export default async function HelpPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("help_article")
    .select("slug, title, category, sort_order")
    .eq("published", true)
    .order("sort_order");
  const articles = (data ?? []) as Pick<
    HelpArticle,
    "slug" | "title" | "category" | "sort_order"
  >[];

  const categories = [...new Set(articles.map((a) => a.category))];

  return (
    <>
      <PageHeader title="Help" />
      <div className="flex-1 space-y-6 p-8">
        <div className="max-w-[840px]">
          <HelpAssistant />
        </div>

        <div className="grid max-w-[840px] gap-6 sm:grid-cols-2">
          {categories.map((cat) => (
            <Card key={cat}>
              <p className="mb-3 font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
                {cat}
              </p>
              <ul className="space-y-2">
                {articles
                  .filter((a) => a.category === cat)
                  .map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/app/help/${a.slug}`}
                        className="font-body text-sm font-medium text-navy underline-offset-2 hover:underline"
                      >
                        {a.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
