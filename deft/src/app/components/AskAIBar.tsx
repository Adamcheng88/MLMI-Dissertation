import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, FileText, Check, X, GripHorizontal, Plus, Trash2, ChevronRight } from "lucide-react";
import { FeatureNode } from "./TreeData";
import { useAdvice } from "./AdviceContext";
import { useParticipant } from "../contexts/ParticipantContext";
import { chatStream } from "../api/client";
import ChatMarkdown from "./ChatMarkdown";

const HANDOFF_MARKER = "@@HANDOFF@@";



function displayReply(text: string): string {
  const idx = text.indexOf(HANDOFF_MARKER);
  if (idx >= 0) return stripTrailingRule(text.slice(0, idx));
  for (let n = HANDOFF_MARKER.length - 1; n > 0; n--) {
    if (text.endsWith(HANDOFF_MARKER.slice(0, n))) return text.slice(0, text.length - n).trimEnd();
  }
  return text;
}


function stripTrailingRule(text: string): string {
  return text.replace(/\s*\n-{3,}\s*$/, "").trimEnd();
}

function extractHandoff(text: string): string | undefined {
  const idx = text.indexOf(HANDOFF_MARKER);
  if (idx < 0) return undefined;
  const snippet = text.slice(idx + HANDOFF_MARKER.length).trim();
  return snippet || undefined;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isAdvice?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface AskAIBarProps {
  attachedNodes: FeatureNode[];
  onRemoveNode: (nodeId: string) => void;
  onAttachmentClick: (node: FeatureNode) => void;
  treeOverview?: string;
}

const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 680;

const DEFAULT_WIDTH = 896;
const MIN_WIDTH = 380;
const viewportMaxWidth = () => (typeof window !== "undefined" ? window.innerWidth - 16 : 1200);

function makeId() {
  return Math.random().toString(36).slice(2);
}

function newConversation(): Conversation {
  return { id: makeId(), title: "New Conversation", messages: [], createdAt: Date.now() };
}

export default function AskAIBar({
  attachedNodes,
  onRemoveNode,
  onAttachmentClick,
  treeOverview,
}: AskAIBarProps) {
  const [question, setQuestion] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [manuallyClosed, setManuallyClosed] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>(() => [newConversation()]);
  const [activeId, setActiveId] = useState<string>(() => conversations[0].id);

  const { addAdvice } = useAdvice();
  const { participantId, hydrated, serverState, saveState, logEvent } = useParticipant();


  const hydratedForRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    if (hydratedForRef.current === participantId) return;
    hydratedForRef.current = participantId;
    const saved = serverState.chatConversations as Conversation[] | undefined;
    if (saved && saved.length > 0) {
      setConversations(saved);
      setActiveId(saved[0].id);
    }
  }, [hydrated, participantId, serverState]);


  useEffect(() => {
    if (!hydrated) return;
    saveState({ chatConversations: conversations });
  }, [conversations, hydrated, saveState]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  const activeConv = conversations.find(c => c.id === activeId) ?? conversations[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, isTyping]);

  useEffect(() => {
    if (attachedNodes.length > 0 && !isExpanded && !manuallyClosed) {
      setIsExpanded(true);
    }
  }, [attachedNodes.length, isExpanded, manuallyClosed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
        setManuallyClosed(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = panelHeight;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartYRef.current - e.clientY;
      setPanelHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartHeightRef.current + delta)));
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [panelHeight]);



  const handleHResizeStart = useCallback((side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartXRef.current;
      const next = dragStartWidthRef.current + (side === "right" ? 2 * dx : -2 * dx);
      setPanelWidth(Math.min(viewportMaxWidth(), Math.max(MIN_WIDTH, next)));
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations(prev => prev.map(c => c.id === id ? updater(c) : c));
  };

  const sendChat = async (mode: "ask" | "advise") => {
    if (!question.trim() || !activeConv || isTyping) return;

    const text = question.trim();
    const history = activeConv.messages.map(m => ({ role: m.role, content: m.content }));
    const userMsg: Message = { id: makeId(), role: "user", content: text, isAdvice: mode === "advise" };
    const assistantId = makeId();

    updateConversation(activeId, c => ({
      ...c,
      title: c.messages.length === 0 ? (text.length > 36 ? text.slice(0, 36) + "…" : text) : c.title,
      messages: [...c.messages, userMsg],
    }));
    setQuestion("");
    setIsTyping(true);
    logEvent(mode === "advise" ? "chat_advise" : "chat_message", {
      conversationId: activeId,
      content: text,
      contextNodeIds: attachedNodes.map(n => n.id),
    });

    let assistantCreated = false;
    const renderAssistant = (content: string) => {
      if (!assistantCreated) {
        assistantCreated = true;
        setIsTyping(false);
        updateConversation(activeId, c => ({
          ...c,
          messages: [...c.messages, { id: assistantId, role: "assistant", content }],
        }));
      } else {
        updateConversation(activeId, c => ({
          ...c,
          messages: c.messages.map(m => m.id === assistantId ? { ...m, content } : m),
        }));
      }
    };

    try {
      const full = await chatStream(
        { mode, message: text, conversationHistory: history, attachedNodes, treeOverview },
        (accumulated) => renderAssistant(displayReply(accumulated))
      );

      const reply = displayReply(full).trim() || "Sorry, I was unable to produce a response. Please try again.";
      renderAssistant(reply);

      if (mode === "advise") {
        const handoffSnippet = extractHandoff(full);
        addAdvice(text, attachedNodes, handoffSnippet);
        logEvent("advice_handoff", { conversationId: activeId, handoffSnippet, contextNodeIds: attachedNodes.map(n => n.id) });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch {
      renderAssistant("Sorry, I couldn't reach the assistant just now. Please try again in a moment.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    sendChat("ask");
  };

  const handleAdvise = () => {
    sendChat("advise");
  };

  const handleNewConversation = () => {
    const c = newConversation();
    setConversations(prev => [c, ...prev]);
    setActiveId(c.id);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh = newConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => { setIsExpanded(true); setManuallyClosed(false); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Ask AI</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {showToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <Check className="w-3 h-3" />
            </div>
            <span className="font-medium">Advice Logged</span>
          </div>
        </div>
      )}

      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 px-4 pb-0 animate-in slide-in-from-bottom-4 fade-in duration-300"
        style={{ height: `${panelHeight + 12}px`, width: `${panelWidth}px`, maxWidth: "calc(100vw - 16px)" }}
      >
        <div className="relative flex flex-col h-full bg-card border border-border border-b-0 rounded-t-xl shadow-2xl overflow-hidden">

          {}
          <div
            onMouseDown={handleHResizeStart("left")}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/30 transition-colors z-10"
            title="Drag to resize width"
          />
          <div
            onMouseDown={handleHResizeStart("right")}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/30 transition-colors z-10"
            title="Drag to resize width"
          />

          {}
          <div
            onMouseDown={handleDragStart}
            className="flex-shrink-0 flex items-center justify-center h-5 cursor-ns-resize hover:bg-accent/50 transition-colors group"
          >
            <GripHorizontal className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </div>

          {}
          <div className="flex flex-1 min-h-0">

            {}
            <div className={`flex-shrink-0 flex flex-col border-r border-border transition-all duration-200 ${sidebarOpen ? 'w-52' : 'w-0 overflow-hidden border-r-0'}`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chats</span>
                <button
                  onClick={handleNewConversation}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                  title="New conversation"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-1">
                {conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`group w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      c.id === activeId ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-xs truncate">{c.title}</span>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            </div>

            {}
            <div className="flex-1 flex flex-col min-w-0">
              {}
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border">
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                  title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${sidebarOpen ? 'rotate-180' : ''}`} />
                </button>
                <span className="text-sm font-medium truncate flex-1">{activeConv?.title ?? 'Ask AI'}</span>
                <button
                  onClick={() => { setIsExpanded(false); setManuallyClosed(true); }}
                  className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {}
              {attachedNodes.length > 0 && (
                <div className="flex-shrink-0 px-4 py-2 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Context:</span>
                    {attachedNodes.map(node => (
                      <button
                        key={node.id}
                        onClick={() => onAttachmentClick(node)}
                        className="group flex items-center gap-1.5 px-2.5 py-1 bg-background border border-border rounded-md hover:border-primary transition-colors"
                      >
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium truncate max-w-[140px]">{node.name}</span>
                        <span
                          onClick={(e) => { e.stopPropagation(); onRemoveNode(node.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground text-base leading-none ml-0.5"
                        >×</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
                {(activeConv?.messages.length ?? 0) === 0 && !isTyping && (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground text-center">
                      Ask or advise the agent about the decision tree.<br />
                      <span className="text-xs">Shift + click on node(s) to add them as context to the chat.</span>
                    </p>
                  </div>
                )}
                {activeConv?.messages.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                      msg.isAdvice ? "bg-green-600 text-white" :
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {msg.role === "user" ? "U" : "AI"}
                    </div>
                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                      msg.isAdvice
                        ? "bg-green-600 text-white rounded-tr-sm"
                        : msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                    }`}>
                      {msg.isAdvice && (
                        <div className="text-xs text-white/70 mb-1 font-medium">Advice submitted</div>
                      )}
                      {msg.role === "assistant"
                        ? (msg.content ? <ChatMarkdown content={msg.content} /> : <span className="inline-block w-2 h-4 align-middle bg-muted-foreground/40 animate-pulse rounded-sm" />)
                        : msg.content}
                    </div>
                  </div>
                ))}
                {isTyping && activeConv?.id === activeId && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">AI</div>
                    <div className="bg-muted px-3 py-2 rounded-lg rounded-tl-sm flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {}
              <div className="flex-shrink-0 border-t border-border px-4 py-3">
                <form onSubmit={handleAsk} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    placeholder="Ask a question…"
                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAdvise}
                    disabled={!question.trim()}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Advise
                  </button>
                  <button
                    type="submit"
                    disabled={!question.trim() || isTyping}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Ask
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
