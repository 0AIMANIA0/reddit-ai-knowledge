import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ExternalLink, Languages, Sparkles, Tags } from "lucide-react";
import { Link, useRoute } from "wouter";

function parseTags(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : []; } catch { return []; } }

export default function KnowledgeDetailPage() {
  const [, params] = useRoute("/knowledge/:id");
  const id = Number(params?.id);
  const article = trpc.knowledge.get.useQuery({ id: Number.isFinite(id) && id > 0 ? id : 0 }, { enabled: Number.isFinite(id) && id > 0 });
  if (article.isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-40" /><Skeleton className="h-48 w-full rounded-3xl" /><Skeleton className="h-80 w-full rounded-3xl" /></div>;
  if (!article.data) return <section className="empty-state"><h2>記事が見つかりません</h2><Link href="/knowledge"><Button>知識ベースへ戻る</Button></Link></section>;
  const data = article.data;
  const canonicalUrl = `https://www.reddit.com${data.permalink}`;
  return <div className="detail-page page-enter">
    <Link href="/knowledge"><Button variant="ghost" className="back-link"><ArrowLeft size={16} />知識ベースへ戻る</Button></Link>
    <header className="detail-hero"><div className="detail-meta"><span>r/{data.subreddit}</span><i /> <span>{new Date(data.sourceCreatedAt).toLocaleDateString("ja-JP", { dateStyle: "long" })}</span><i /> <span>{data.score.toLocaleString()} score</span></div><h1>{data.titleJa}</h1><p>{data.summaryJa}</p><div className="detail-actions"><a href={canonicalUrl} target="_blank" rel="noreferrer"><Button className="source-button">元スレッドを開く <ExternalLink size={15} /></Button></a><span className="category-label"><Sparkles size={14} />{data.category}</span></div></header>
    <section className="translation-grid"><article className="translation-card japanese-card"><div className="translation-heading"><Languages size={18} /><div><p className="eyebrow">JAPANESE TRANSLATION</p><h2>日本語訳</h2></div></div><h3>{data.titleJa}</h3><div className="article-body">{data.bodyJa}</div></article><article className="translation-card original-card"><div className="translation-heading"><div className="language-dots">EN</div><div><p className="eyebrow">SOURCE TEXT</p><h2>原文</h2></div></div><h3>{data.titleOriginal}</h3><div className="article-body original-body">{data.bodyOriginal || "本文はありません。"}</div></article></section>
    <section className="detail-tags"><Tags size={17} /><span>分類タグ</span>{parseTags(data.tags).map(tag => <Badge key={tag} className="tag-badge">{tag}</Badge>)}</section>
  </div>;
}
