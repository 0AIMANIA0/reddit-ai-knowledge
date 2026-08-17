import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Clock3, Loader2, Pencil, Play, Plus, Radio, Settings2, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type RuleForm = { name: string; subreddits: string; keywords: string; minScore: number; lookbackDays: number; maxPostsPerRun: number; includeComments: boolean; cronExpression: string; };
type StoredRule = { id: number; name: string; subreddits: string; keywords: string; minScore: number; lookbackDays: number; maxPostsPerRun: number; includeComments: boolean; cronExpression: string; sortMode: "new" | "hot" | "top" | "relevance"; isActive: boolean; };
const initialForm: RuleForm = { name: "", subreddits: "", keywords: "", minScore: 10, lookbackDays: 7, maxPostsPerRun: 20, includeComments: true, cronExpression: "0 0 */6 * * *" };
function parseList(value: string) { return value.split(",").map(item => item.trim().replace(/^r\//i, "")).filter(Boolean); }
function parseJsonList(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function ruleInput(form: RuleForm, isActive = true, sortMode: StoredRule["sortMode"] = "new") { return { name: form.name || `収集条件 ${new Date().toLocaleDateString("ja-JP")}`, subreddits: parseList(form.subreddits), keywords: parseList(form.keywords), minScore: form.minScore, lookbackDays: form.lookbackDays, sortMode, includeComments: form.includeComments, maxPostsPerRun: form.maxPostsPerRun, cronExpression: form.cronExpression, isActive }; }
function formFromRule(rule: StoredRule): RuleForm { return { name: rule.name, subreddits: parseJsonList(rule.subreddits).join(", "), keywords: parseJsonList(rule.keywords).join(", "), minScore: rule.minScore, lookbackDays: rule.lookbackDays, maxPostsPerRun: rule.maxPostsPerRun, includeComments: rule.includeComments, cronExpression: rule.cronExpression }; }

export default function RuleSettingsPage() {
  const [form, setForm] = useState<RuleForm>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const rules = trpc.collectionRules.list.useQuery();
  const utils = trpc.useUtils();
  const finishSave = (message: string) => { utils.collectionRules.list.invalidate(); setForm(initialForm); setEditingId(null); toast.success(message); };
  const createRule = trpc.collectionRules.create.useMutation({ onSuccess: () => finishSave("収集条件を保存しました。"), onError: error => toast.error(error.message) });
  const updateRule = trpc.collectionRules.update.useMutation({ onSuccess: () => finishSave("収集条件を更新しました。必要に応じて定期実行を同期してください。"), onError: error => toast.error(error.message) });
  const removeRule = trpc.collectionRules.remove.useMutation({ onSuccess: () => { utils.collectionRules.list.invalidate(); toast.success("収集条件を削除しました。"); }, onError: error => toast.error(error.message) });
  const runNow = trpc.collectionRules.runNow.useMutation({ onSuccess: result => { utils.dashboard.recentRuns.invalidate(); utils.dashboard.metrics.invalidate(); utils.knowledge.list.invalidate(); toast.success(`${result.processedItems}件を処理しました。`); }, onError: error => toast.error(error.message) });
  const syncSchedule = trpc.collectionRules.syncSchedule.useMutation({ onSuccess: result => { utils.collectionRules.list.invalidate(); toast.success(result.taskUid ? "定期実行を設定しました。" : "収集条件は停止中です。"); }, onError: error => toast.error(error.message) });
  const toggleRule = trpc.collectionRules.update.useMutation({ onSuccess: () => { utils.collectionRules.list.invalidate(); toast.success("収集条件を更新しました。"); }, onError: error => toast.error(error.message) });
  const saving = createRule.isPending || updateRule.isPending;

  function submit(event: FormEvent) { event.preventDefault(); const input = ruleInput(form); if (!input.subreddits.length) { toast.error("少なくとも1つのサブレディットを入力してください。"); return; } if (editingId) updateRule.mutate({ id: editingId, rule: input }); else createRule.mutate(input); }
  function startEdit(rule: StoredRule) { setEditingId(rule.id); setForm(formFromRule(rule)); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function cancelEdit() { setEditingId(null); setForm(initialForm); }

  return <div className="space-y-7 page-enter">
    <header className="page-heading"><div><p className="eyebrow">COLLECTION CONTROL</p><h1>収集条件</h1><p>監視するコミュニティと条件を定義し、定期的な知識化をコントロールします。</p></div><div className="heading-count"><Radio size={15} />{rules.data?.filter(rule => rule.isActive).length ?? 0} 稼働中</div></header>
    <div className="rule-layout"><section className="content-card settings-card"><div className="section-heading"><div><p className="eyebrow">{editingId ? "EDIT COLLECTION" : "NEW COLLECTION"}</p><h2>{editingId ? "収集条件を編集" : "新しい収集条件"}</h2></div><div className="flex gap-2">{editingId && <Button size="sm" variant="ghost" onClick={cancelEdit}><X size={15} />編集を中止</Button>}<Settings2 size={20} className="text-muted-foreground" /></div></div><form onSubmit={submit} className="rule-form">
      <div className="form-field full"><Label htmlFor="rule-name">表示名</Label><Input id="rule-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="例：AIエージェントの実務活用" /></div>
      <div className="form-field"><Label htmlFor="subreddits">対象サブレディット</Label><Input id="subreddits" value={form.subreddits} onChange={event => setForm({ ...form, subreddits: event.target.value })} placeholder="例：LocalLLaMA, MachineLearning" /><small>カンマ区切り。r/ は省略できます。</small></div>
      <div className="form-field"><Label htmlFor="keywords">キーワード</Label><Input id="keywords" value={form.keywords} onChange={event => setForm({ ...form, keywords: event.target.value })} placeholder="例：agent, evaluation, RAG" /><small>空欄の場合は対象サブレディットの新着を対象にします。</small></div>
      <div className="form-field"><Label htmlFor="score">最小スコア</Label><Input id="score" type="number" min="0" value={form.minScore} onChange={event => setForm({ ...form, minScore: Number(event.target.value) })} /></div>
      <div className="form-field"><Label htmlFor="days">対象期間（日）</Label><Input id="days" type="number" min="1" max="90" value={form.lookbackDays} onChange={event => setForm({ ...form, lookbackDays: Number(event.target.value) })} /></div>
      <div className="form-field"><Label htmlFor="posts">1回の最大投稿数</Label><Input id="posts" type="number" min="1" max="100" value={form.maxPostsPerRun} onChange={event => setForm({ ...form, maxPostsPerRun: Number(event.target.value) })} /></div>
      <div className="form-field"><Label htmlFor="cron">実行cron（UTC・6フィールド）</Label><Input id="cron" value={form.cronExpression} onChange={event => setForm({ ...form, cronExpression: event.target.value })} /><small>初期値は6時間ごとです。</small></div>
      <div className="form-switch"><div><Label htmlFor="comments">コメントも収集する</Label><p>上位コメントを翻訳・要約して保存します。</p></div><Switch id="comments" checked={form.includeComments} onCheckedChange={checked => setForm({ ...form, includeComments: checked })} /></div>
      <Button disabled={saving} type="submit" className="submit-rule">{saving ? <Loader2 className="animate-spin" size={16} /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}{editingId ? "変更を保存" : "収集条件を保存"}</Button>
    </form></section><aside className="rule-note"><CheckCircle2 size={19} /><div><strong>公式OAuthで接続</strong><p>Redditの無料OAuth認証情報を設定後、手動実行または公開済みアプリ上の定期実行で収集を開始できます。</p></div></aside></div>
    <section className="content-card"><div className="section-heading"><div><p className="eyebrow">SAVED COLLECTIONS</p><h2>保存済みの条件</h2></div></div>{rules.isLoading ? <div className="py-10 text-center text-muted-foreground">読み込み中です。</div> : rules.data?.length ? <div className="rules-list">{rules.data.map(rule => { const stored = rule as StoredRule; return <article key={rule.id} className="saved-rule"><div className="saved-rule-top"><div><div className="rule-title-row"><h3>{rule.name}</h3><Badge className={rule.isActive ? "status-badge status-success" : "status-badge status-paused"}>{rule.isActive ? "有効" : "停止中"}</Badge></div><p>{parseJsonList(rule.subreddits).map(item => `r/${item}`).join(" · ") || "—"}</p></div><Switch checked={rule.isActive} onCheckedChange={checked => toggleRule.mutate({ id: rule.id, rule: ruleInput(formFromRule(stored), checked, rule.sortMode) })} /></div><div className="rule-specs"><span><Clock3 size={13} />{rule.cronExpression}</span><span>score ≥ {rule.minScore}</span><span>{rule.lookbackDays}日間</span><span>{rule.maxPostsPerRun}件/回</span></div><div className="rule-actions"><Button size="sm" variant="outline" onClick={() => startEdit(stored)}><Pencil size={14} />編集</Button><Button size="sm" variant="outline" onClick={() => runNow.mutate({ id: rule.id })} disabled={runNow.isPending}><Play size={14} />今すぐ実行</Button><Button size="sm" variant="outline" onClick={() => syncSchedule.mutate({ id: rule.id })} disabled={syncSchedule.isPending || !rule.isActive}><Clock3 size={14} />公開後に定期実行</Button><Button size="icon" variant="ghost" className="delete-button" onClick={() => removeRule.mutate({ id: rule.id })} aria-label="収集条件を削除"><Trash2 size={16} /></Button></div></article>; })}</div> : <div className="empty-inline"><AlertCircle size={20} /><p>保存済みの収集条件はありません。上のフォームから最初の条件を追加してください。</p></div>}</section>
  </div>;
}
