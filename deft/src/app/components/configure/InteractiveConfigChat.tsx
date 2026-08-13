








import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, FileText, ArrowUp, Loader2, Sparkles, Check, BookOpen, ExternalLink, Search } from "lucide-react";
import { configureChatStream } from "../../api/client";
import ChatMarkdown from "../ChatMarkdown";
import {
  ConfigValues,
  Checklist,
  ChecklistItem,
  Paper,
  displayText,
  parseChecklist,
  parseConfig,
  parsePapers,
} from "../../lib/configureProtocol";

const ACCEPT = ".pdf,.csv,.txt,.png,.jpg,.jpeg";

const OPENER =
  "Hi! I'm here to help you configure your decision tree model. We'll go step by step — " +
  "your goal and data, any extra details, useful documents, then how thoroughly to build the tree — " +
  "so you have room to customize along the way.\n\n" +
  "To get started, tell me a bit about **what you're trying to predict** and **the data you have** — " +
  "or just say \"help me set it up\" and I'll guide you.";

interface AdviceSummary {
  message: string;
  handoffSnippet?: string;
}

type AnswerState = Record<string, string | string[] | Record<string, string>>;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: string;
  checklist?: Checklist | null;
  checklistAnswers?: AnswerState;
  selectedActionId?: string;
  answered?: boolean;
  fileNames?: string[];
  papers?: Paper[] | null;

  status?: string;

  hidden?: boolean;
}

interface InteractiveConfigChatProps {
  cfg: ConfigValues;
  onApplyConfig: (partial: Partial<ConfigValues>) => void;
  onAttachFiles: (files: File[]) => void;
  submittedAdvice: AdviceSummary[];

  onGenerate: (cfg: ConfigValues) => void;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}


function summarizeAnswers(checklist: Checklist, answers: AnswerState): string[] {
  const lines: string[] = [];
  for (const item of checklist.items) {
    if (item.type === "single_select") {
      const sel = answers[item.id] as string | undefined;
      const label = item.options.find(o => o.id === sel)?.label;
      if (label) lines.push(`- ${item.prompt || "Selection"}: ${label}`);
    } else if (item.type === "multi_select") {
      const sel = (answers[item.id] as string[] | undefined) ?? [];
      const labels = item.options.filter(o => sel.includes(o.id)).map(o => o.label);
      if (labels.length) lines.push(`- ${item.prompt || "Selections"}: ${labels.join(", ")}`);
    } else if (item.type === "questions") {
      const qa = (answers[item.id] as Record<string, string> | undefined) ?? {};
      for (const q of item.questions) {
        const a = (qa[q.id] ?? "").trim();
        if (a) lines.push(`- ${q.text} ${a}`);
      }
    } else if (item.type === "custom_instructions") {
      const text = ((answers[item.id] as string | undefined) ?? "").trim();
      if (text) lines.push(`- Additional instructions: ${text}`);
    }
  }
  return lines;
}

function buildAgentSummary(
  checklist: Checklist,
  answers: AnswerState,
  actionLabel?: string
): string {
  const lines = summarizeAnswers(checklist, answers);
  let out = lines.length
    ? `Here are my answers for "${checklist.title}":\n${lines.join("\n")}`
    : `Regarding "${checklist.title}":`;
  if (actionLabel) out += `\n\nSelected action: ${actionLabel}`;
  return out;
}

function PaperLinkButton({
  href,
  label,
}: {
  href?: string;
  label: string;
}) {
  const enabled = !!href;
  const className =
    "inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 transition-colors " +
    (enabled
      ? "border-border hover:bg-accent text-foreground"
      : "border-border/60 bg-muted/40 text-muted-foreground/50 cursor-not-allowed");

  if (!enabled) {
    return (
      <span className={className} aria-disabled="true" title={`${label} link unavailable`}>
        {label}
        <ExternalLink className="w-3 h-3 opacity-40" />
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function PapersCard({ papers }: { papers: Paper[] }) {
  return (
    <div className="mt-3 border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
        <BookOpen className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium flex-1">
          {papers.length === 1 ? "1 paper from Scopus" : `${papers.length} papers from Scopus`}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {papers.map(paper => {
          const meta = [paper.authors, paper.year, paper.venue].filter(Boolean).join(" · ");
          return (
            <li key={paper.id} className="p-4 space-y-2">
              <p className="text-sm font-medium leading-snug text-foreground">{paper.title}</p>
              {meta && <p className="text-xs text-muted-foreground">{meta}</p>}

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {paper.pageRange && <span>pp. {paper.pageRange}</span>}
                {paper.citedBy != null && <span>{paper.citedBy} citations</span>}
                {paper.openAccess && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Check className="w-3 h-3" />
                    Open access
                  </span>
                )}
              </div>

              {paper.relevance && (
                <p className="text-sm text-foreground/80 leading-relaxed">{paper.relevance}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-0.5">
                <PaperLinkButton href={paper.links.doi} label="DOI" />
                <PaperLinkButton href={paper.links.scopus} label="Scopus" />
                <PaperLinkButton href={paper.links.fullText} label="Full text" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChecklistCard({
  checklist,
  disabled,
  submitted,
  initialAnswers,
  selectedActionId,
  onSubmit,
}: {
  checklist: Checklist;
  disabled: boolean;
  submitted?: boolean;
  initialAnswers?: AnswerState;
  selectedActionId?: string;
  onSubmit: (summary: string, answers: AnswerState, actionId?: string) => void;
}) {
  const [answers, setAnswers] = useState<AnswerState>(initialAnswers ?? {});
  const locked = !!submitted;

  const actionItem = checklist.items.find(i => i.type === "actions") as
    | Extract<ChecklistItem, { type: "actions" }>
    | undefined;
  const nonActionItems = checklist.items.filter(i => i.type !== "actions");

  const setSingle = (itemId: string, optId: string) =>
    setAnswers(prev => ({ ...prev, [itemId]: optId }));
  const toggleMulti = (itemId: string, optId: string) =>
    setAnswers(prev => {
      const cur = (prev[itemId] as string[] | undefined) ?? [];
      return {
        ...prev,
        [itemId]: cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId],
      };
    });
  const setQuestion = (itemId: string, qId: string, val: string) =>
    setAnswers(prev => ({
      ...prev,
      [itemId]: { ...((prev[itemId] as Record<string, string>) ?? {}), [qId]: val },
    }));
  const setCustom = (itemId: string, val: string) =>
    setAnswers(prev => ({ ...prev, [itemId]: val }));

  const optionClass = (active: boolean) => {
    if (locked) {
      return active
        ? "border-primary bg-primary/5 text-foreground"
        : "border-border bg-background text-muted-foreground opacity-50";
    }
    return active
      ? "border-primary bg-primary/5 text-foreground"
      : "border-border bg-background hover:bg-accent";
  };

  return (
    <div className="mt-3 border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium flex-1">{checklist.title}</span>
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-primary" />
            Answered
          </span>
        )}
      </div>

      <div className="p-4 space-y-5">
        {nonActionItems.map(item => (
          <div key={item.id} className="space-y-2">
            {item.prompt && <p className="text-sm font-medium text-foreground">{item.prompt}</p>}

            {item.type === "single_select" && (
              <div className="space-y-1.5">
                {item.options.map(opt => {
                  const active = answers[item.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabled || locked}
                      onClick={() => setSingle(item.id, opt.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${optionClass(active)} disabled:cursor-default`}
                    >
                      <span
                        className={`inline-block w-3.5 h-3.5 rounded-full border mr-2 align-middle ${
                          active ? "border-primary bg-primary" : "border-muted-foreground"
                        }`}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {item.type === "multi_select" && (
              <div className="space-y-1.5">
                {item.options.map(opt => {
                  const sel = (answers[item.id] as string[] | undefined) ?? [];
                  const active = sel.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabled || locked}
                      onClick={() => toggleMulti(item.id, opt.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${optionClass(active)} disabled:cursor-default`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border mr-2 align-middle text-[10px] text-primary-foreground ${
                          active ? "border-primary bg-primary" : "border-muted-foreground"
                        }`}
                      >
                        {active ? "✓" : ""}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {item.type === "questions" && (
              <div className="space-y-3">
                {item.questions.map(q => (
                  <div key={q.id} className="space-y-1">
                    <p className="text-sm text-muted-foreground">{q.text}</p>
                    <textarea
                      disabled={disabled || locked}
                      value={((answers[item.id] as Record<string, string>) ?? {})[q.id] ?? ""}
                      onChange={e => setQuestion(item.id, q.id, e.target.value)}
                      rows={2}
                      placeholder="Type your answer…"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-80 disabled:cursor-default"
                    />
                  </div>
                ))}
              </div>
            )}

            {item.type === "custom_instructions" && (
              <textarea
                disabled={disabled || locked}
                value={(answers[item.id] as string | undefined) ?? ""}
                onChange={e => setCustom(item.id, e.target.value)}
                rows={3}
                placeholder="Add any custom instructions…"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-80 disabled:cursor-default"
              />
            )}
          </div>
        ))}

        {actionItem ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {actionItem.options.map((opt, i) => {
              const chosen = locked && selectedActionId === opt.id;
              const dimmed = locked && selectedActionId !== opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled || locked}
                  onClick={() =>
                    onSubmit(buildAgentSummary(checklist, answers, opt.label), answers, opt.id)
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-default ${
                    locked
                      ? chosen
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-muted-foreground opacity-50"
                      : i === 0
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border bg-background hover:bg-accent"
                  } ${dimmed ? "" : ""}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        ) : !locked ? (
          <div className="pt-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSubmit(buildAgentSummary(checklist, answers), answers)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function isProceedAction(actionId?: string): boolean {
  if (!actionId) return false;
  return /^proceed$/i.test(actionId) || /generate/i.test(actionId);
}

export default function InteractiveConfigChat({
  cfg,
  onApplyConfig,
  onAttachFiles,
  submittedAdvice,
  onGenerate,
}: InteractiveConfigChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: makeId(), role: "assistant", content: OPENER },
  ]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const adviceRef = useRef(submittedAdvice);
  adviceRef.current = submittedAdvice;

  const send = useCallback(
    async (
      text: string,
      files: File[],
      opts?: {
        markAnsweredId?: string;
        checklistAnswers?: AnswerState;
        selectedActionId?: string;
        hideUserMessage?: boolean;
      }
    ) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        fileNames: files.map(f => f.name),
        hidden: opts?.hideUserMessage,
      };
      const assistantId = makeId();

      setMessages(prev => {
        let next = prev;
        if (opts?.markAnsweredId) {
          next = prev.map(m =>
            m.id === opts.markAnsweredId
              ? {
                  ...m,
                  answered: true,
                  checklistAnswers: opts.checklistAnswers ?? m.checklistAnswers,
                  selectedActionId: opts.selectedActionId ?? m.selectedActionId,
                }
              : m
          );
        }
        return [
          ...next,
          userMsg,
          { id: assistantId, role: "assistant", content: "", streaming: true },
        ];
      });
      if (files.length) onAttachFiles(files);
      setIsStreaming(true);

      try {
        const full = await configureChatStream(
          {
            message: trimmed,
            conversationHistory: history,
            currentConfig: cfgRef.current as unknown as Record<string, unknown>,
            submittedAdvice: adviceRef.current,
          },
          files,
          acc =>
            setMessages(prev =>
              prev.map(m => (m.id === assistantId ? { ...m, content: acc } : m))
            ),
          status =>
            setMessages(prev =>
              prev.map(m => (m.id === assistantId ? { ...m, status } : m))
            )
        );

        const configPatch = parseConfig(full);
        if (configPatch) onApplyConfig(configPatch);
        const checklist = parseChecklist(full);
        const papers = parsePapers(full);

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: full, streaming: false, status: undefined, checklist, papers }
              : m
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
            ? { ...m, content: "", streaming: false, status: undefined, error: message }
            : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, onApplyConfig, onAttachFiles]
  );

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const files = pendingFiles;
    const text = input;
    setInput("");
    setPendingFiles([]);
    void send(text, files);
  };

  const handleChecklistSubmit = (
    msgId: string,
    summary: string,
    answers: AnswerState,
    actionId?: string
  ) => {
    if (isProceedAction(actionId)) {
      const wrapUp = messages.find(m => m.id === msgId);
      const patch = wrapUp ? parseConfig(wrapUp.content) : null;
      const finalCfg = patch ? { ...cfgRef.current, ...patch } : cfgRef.current;
      if (patch) onApplyConfig(patch);

      setMessages(prev => [
        ...prev.map(m =>
          m.id === msgId
            ? { ...m, answered: true, checklistAnswers: answers, selectedActionId: actionId }
            : m
        ),
        {
          id: makeId(),
          role: "assistant",
          content:
            "Approved — starting decision-tree generation with the configuration we agreed on.",
        },
      ]);
      onGenerate(finalCfg);
      return;
    }

    void send(summary, [], {
      markAnsweredId: msgId,
      checklistAnswers: answers,
      selectedActionId: actionId,
      hideUserMessage: true,
    });
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col border border-border rounded-xl bg-background overflow-hidden">
      {}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 520, minHeight: 360 }}>
        {messages.map(msg => {
          if (msg.hidden) return null;

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.fileNames && msg.fileNames.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.fileNames.map((name, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs bg-primary-foreground/15 rounded px-2 py-0.5"
                        >
                          <FileText className="w-3 h-3" />
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const display = displayText(msg.content);
          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[85%] w-full">
                {(msg.error || display || msg.streaming) && (
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-foreground">
                    {msg.error ? (
                      <p className="text-destructive">{msg.error}</p>
                    ) : display ? (
                      <ChatMarkdown content={display} />
                    ) : msg.streaming && msg.status === "searching_literature" ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Search className="w-3.5 h-3.5 animate-pulse" />
                        Searching Scopus for relevant literature…
                      </span>
                    ) : msg.streaming ? (
                      <span className="inline-flex gap-1 items-center text-muted-foreground">
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                      </span>
                    ) : null}
                  </div>
                )}

                {msg.papers && msg.papers.length > 0 && <PapersCard papers={msg.papers} />}

                {msg.checklist && (
                  <ChecklistCard
                    key={`${msg.id}-${msg.answered ? "done" : "open"}`}
                    checklist={msg.checklist}
                    disabled={isStreaming && !msg.answered}
                    submitted={msg.answered}
                    initialAnswers={msg.checklistAnswers}
                    selectedActionId={msg.selectedActionId}
                    onSubmit={(summary, answers, actionId) =>
                      handleChecklistSubmit(msg.id, summary, answers, actionId)
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {}
      <div className="border-t border-border p-3 space-y-2">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((file, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-lg px-2 py-1"
              >
                <FileText className="w-3 h-3 text-muted-foreground" />
                {file.name}
                <button
                  onClick={() => setPendingFiles(f => f.filter((_, j) => j !== i))}
                  className="hover:text-foreground text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={handleFilePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            title="Attach files"
            className="shrink-0 p-2.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-muted-foreground" />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Describe your goal, or answer the agent…"
            className="flex-1 resize-none px-3 py-2.5 bg-input-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 max-h-40"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="shrink-0 p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
