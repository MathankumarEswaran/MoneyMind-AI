import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Bot, Loader2, MessageSquare, Send, Sparkles, User, Wrench } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AiMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  createdAt: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown>; result?: unknown }>;
  citations?: Array<{ id: string; type: string; description: string; amountMinor?: string; occurredAt?: string }>;
}

interface AiThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export function CopilotPage() {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const threadsQuery = useQuery({
    queryKey: ["ai", "threads"],
    queryFn: () => api.listAiThreads(),
  });

  const chatMutation = useMutation({
    mutationFn: (msg: string) => api.chatWithAi({ threadId: activeThreadId, message: msg, includeContext: true }),
    onSuccess: (data) => {
      setActiveThreadId(data.threadId);
      setMessages((current) => [...current, data.message]);
      setDisclaimer(data.disclaimer);
      setSuggestedQuestions(data.suggestedQuestions);
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["ai", "threads"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, chatMutation.isPending]);

  const handleSend = () => {
    if (!message.trim() || chatMutation.isPending) return;
    const userMsg: AiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMsg]);
    chatMutation.mutate(message.trim());
  };

  const loadThread = async (threadId: string) => {
    const detail = await api.getAiThread(threadId);
    setActiveThreadId(threadId);
    setMessages(detail.messages);
    setDisclaimer(detail.disclaimer);
    setSuggestedQuestions([]);
  };

  const startNew = () => {
    setActiveThreadId(undefined);
    setMessages([]);
    setDisclaimer("");
    setSuggestedQuestions([]);
    setMessage("");
  };

  const defaultSuggestions = [
    "How much did I spend this month?",
    "Where am I spending the most?",
    "How can I save ₹5,000 next month?",
    "Predict my next month's expenses.",
    "Am I within my budget?",
  ];

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Intelligence</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI Financial Assistant</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Your personalized AI copilot that analyzes your real financial data to answer questions, track spending, and provide actionable insights in Indian Rupees (₹).
          </p>
        </header>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="size-4" />
                Conversations
              </CardTitle>
              <CardDescription>AI analysis of your finances</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={startNew}>
              New
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(threadsQuery.data?.threads || []).map((thread: AiThread) => (
              <button
                key={thread.id}
                onClick={() => void loadThread(thread.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  activeThreadId === thread.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <p className="truncate font-medium">{thread.title}</p>
                <p className="text-xs text-muted-foreground">{thread.messageCount} messages</p>
              </button>
            ))}
            {(threadsQuery.data?.threads || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="flex min-h-[600px] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI Copilot
            </CardTitle>
            <CardDescription>
              Uses real data via controlled tools. Analysis and suggestions, not guaranteed financial advice. Requires confirmation for important actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border/60 p-4">
              {messages.length === 0 ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex h-full flex-col items-center justify-center gap-4 text-center"
                >
                  <Bot className="size-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Ask your AI Copilot</p>
                    <p className="text-sm text-muted-foreground">
                      Get grounded insights using your transactions, budgets, goals, and uploaded documents.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      "Summarize my finances this month",
                      "What are my top spending categories?",
                      "Which budgets need attention?",
                      "Search my documents for budget info",
                    ].map((q) => (
                      <Button
                        key={q}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMessage(q);
                        }}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <>
                  {messages.map((msg) => (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    key={msg.id}
                    className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.role !== "user" ? (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="size-4 text-primary" />
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      {msg.toolCalls && msg.toolCalls.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs opacity-80">
                          {msg.toolCalls.map((tc) => (
                            <div key={tc.id} className="flex items-center gap-2 rounded bg-background/50 px-2 py-1">
                              <Wrench className="size-3" />
                              <span className="font-medium">Tool:</span> {tc.name}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {msg.role === "user" ? (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="size-4" />
                      </div>
                    ) : null}
                  </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
              {chatMutation.isPending ? (
                <div className="flex gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Loader2 className="size-4 animate-spin text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2">
                    <p className="text-sm text-muted-foreground">Calling tools and analyzing...</p>
                  </div>
                </div>
              ) : null}
            </div>

            {suggestedQuestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <p className="w-full text-xs text-muted-foreground">Suggested questions:</p>
                {suggestedQuestions.map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMessage(q);
                    }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            ) : messages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <p className="w-full text-xs text-muted-foreground">Try asking:</p>
                {defaultSuggestions.slice(0, 3).map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMessage(q);
                    }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            ) : null}

            {disclaimer ? (
              <p className="text-xs text-muted-foreground">{disclaimer}</p>
            ) : null}

            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about spending, budgets, goals, or for suggestions in INR..."
                className="min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button onClick={handleSend} disabled={!message.trim() || chatMutation.isPending} size="lg">
                {chatMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </AppShell>
  );
}

export default CopilotPage;
