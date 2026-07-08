import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "layout-country:support-chat:v1";

function loadInitialMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function messageText(m: UIMessage): string {
  if (!m.parts) return "";
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte AI — Layout Country" },
      {
        name: "description",
        content:
          "Fale com nosso assistente virtual: tire dúvidas sobre pedidos, entregas, trocas, tamanhos e canal atacado.",
      },
      { property: "og:title", content: "Suporte AI — Layout Country" },
      {
        property: "og:description",
        content: "Assistente virtual da Layout Country para dúvidas rápidas 24/7.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const [initial] = useState<UIMessage[]>(() => loadInitialMessages());
  const [chatId, setChatId] = useState<string>(
    () => `support-${Math.random().toString(36).slice(2, 10)}`,
  );

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: chatId,
    messages: initial,
    transport,
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Falha ao enviar mensagem.";
      if (/402/.test(msg)) {
        toast.error("Créditos de IA esgotados. Fale com o suporte humano.");
      } else if (/429/.test(msg)) {
        toast.error("Muitas requisições. Aguarde alguns segundos.");
      } else {
        toast.error(msg);
      }
    },
  });

  // Persist messages to localStorage on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* quota / private mode */
    }
  }, [messages]);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!isBusy) inputRef.current?.focus();
  }, [isBusy]);

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  };

  const clearChat = () => {
    stop();
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setChatId(`support-${Math.random().toString(36).slice(2, 10)}`);
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col px-4 py-6 md:py-10">
      <header className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Suporte AI</h1>
            <p className="text-xs text-muted-foreground">
              Tire dúvidas sobre pedidos, entregas, trocas e atacado.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          disabled={messages.length === 0}
          className="gap-1.5"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Limpar</span>
        </Button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-muted/30 p-4"
      >
        {messages.length === 0 ? <EmptyState onPick={(t) => setInput(t)} /> : null}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {status === "submitted" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" aria-hidden />
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span>Pensando…</span>
          </div>
        ) : null}
      </div>

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Como podemos ajudar? (Enter para enviar, Shift+Enter para quebrar linha)"
          className="min-h-[52px] max-h-40 resize-none"
          disabled={isBusy}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isBusy || input.trim().length === 0}
          aria-label="Enviar"
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </form>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Assistente virtual. Não solicite ou envie CPF, senhas ou dados de cartão.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = messageText(message);
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-background text-foreground shadow-sm",
        )}
      >
        {text || (
          <span className="italic text-muted-foreground">(mensagem vazia)</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const suggestions = [
    "Quais são os prazos de entrega?",
    "Como funciona a troca de produtos?",
    "Como solicitar acesso ao Canal Atacado?",
    "Vocês têm tabela de tamanhos?",
  ];
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <h2 className="text-base font-semibold">Olá! Como posso ajudar?</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Sou o assistente virtual da loja. Posso tirar dúvidas sobre pedidos,
          entregas, trocas, tamanhos e canal atacado.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
