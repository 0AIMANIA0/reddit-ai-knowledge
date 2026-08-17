import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CalendarDays, Filter, Search, Sparkles, Tags, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

function parseTags(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : []; } catch { return []; } }
function dateLabel(value: Date | string) { return new Date(value).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }); }
function toStartDate(value: string) { return value ? new Date(`${value}T00:00:00`) : undefined; }
function toEndDate(value: string) { return value ? new Date(`${value}T23:59:59.999`) : undefined; }

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState(""); const [tag, setTag] = useState(""); const [subreddit, setSubreddit] = useState(""); const [category, setCategory] = useState(""); const [fromDate, setFromDate] = useState(""); const [toDate, setToDate] = useState("");
  const filters = useMemo(() => ({ query: query || undefined, tag: tag || undefined, subreddit: subreddit || undefined, category: category || undefined, from: toStartDate(fromDate), to: toEndDate(toDate), limit: 100 }), [query, tag, subreddit, category, fromDate, toDate]);
  const articles = trpc.knowledge.list.useQuery(filters);
  const options = useMemo(() => { const source = articles.data ?? []; return { subreddits: Array.from(new Set(source.map(article => article.subreddit))).sort(), categories: Array.from(new Set(source.map(article => article.category))).sort() }; }, [articles.data]);
  const clearFilters = () => { setQuery(""); setTag(""); setSubreddit(""); setCategory(""); setFromDate(""); setToDate(""); };
  const hasFilters = Boolean(query || tag || subreddit || category || fromDate || toDate);
  return <div className="space-y-7 page-enter"><header className="page-heading"><div><p className="eyebrow">JAPANESE KNOWLEDGE BASE</p><h1>知識ベース</h1><p>翻訳・要約・分類されたAI関連の会話を、必要な観点から探索します。</p></div><div className="heading-count"><Sparkles size={15} />{articles.data?.length ?? 0} 記事</div></header>
    <section className="search-surface"><div className="search-input"><Search size={18} /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="キーワード、技術、プロダクトで全文検索" /></div><div className="filter-row"><Filter size={15} /><select value={subreddit} onChange={event => setSubreddit(event.target.value)}><option value="">すべてのサブレディット</option>{options.subreddits.map(option => <option key={option} value={option}>r/{option}</option>)}</select><select value={category} onChange={event => setCategory(event.target.value)}><option value="">すべてのカテゴリ</option>{options.categories.map(option => <option key={option} value={option}>{option}</option>)}</select><div className="tag-input"><Tags size={14} /><Input value={tag} onChange={event => setTag(event.target.value)} placeholder="タグ" /></div><div className="date-filter"><CalendarDays size={14} /><Input aria-label="開始日" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /><span>–</span><Input aria-label="終了日" type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></div>{hasFilters && <Button onClick={clearFilters} variant="ghost" size="sm" className="clear-filter"><X size={14} />条件を解除</Button>}</div></section>
    {articles.isLoading ? <div className="knowledge-list">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 w-full rounded-2xl" />)}</div> : articles.data?.length ? <section className="knowledge-list">{articles.data.map(article => { const tags = parseTags(article.tags); return <article className="knowledge-card" key={article.id}><div className="article-meta"><span>r/{article.subreddit}</span><i /> <span><CalendarDays size={13} />{dateLabel(article.sourceCreatedAt)}</span><i /> <span>{article.score.toLocaleString()} score</span></div><h2>{article.titleJa}</h2><p>{article.summaryJa}</p><div className="article-footer"><div className="tag-list">{tags.slice(0, 4).map(item => <Badge className="tag-badge" key={item}>{item}</Badge>)}</div><Link href={`/knowledge/${article.id}`}><Button variant="ghost" className="article-link">詳細 <ArrowRight size={15} /></Button></Link></div></article>; })}</section> : <section className="empty-state"><div><Search size={28} /></div><h2>{hasFilters ? "条件に合う記事はありません" : "まだ知識記事はありません"}</h2><p>{hasFilters ? "検索語や絞り込み条件を変更してください。" : "収集条件を追加してReddit連携を有効にすると、翻訳済みの記事がここに蓄積されます。"}</p>{hasFilters ? <Button onClick={clearFilters}>条件を解除する</Button> : <Link href="/rules"><Button>収集条件を設定する</Button></Link>}</section>}
  </div>;
}
