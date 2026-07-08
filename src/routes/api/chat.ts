import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayRunId,
} from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é o assistente virtual de suporte de uma loja online de moda country brasileira.

Responsabilidades:
- Responder dúvidas sobre pedidos, prazos de entrega, trocas, devoluções, formas de pagamento, tamanhos, cuidados com produtos e canal atacado.
- Ser cordial, direto, em português do Brasil, com tom acolhedor e profissional.
- Usar markdown leve (listas, negrito) quando ajudar a clareza.

Limites:
- Você NÃO tem acesso a pedidos, cadastros ou dados de clientes. Não invente número de pedido, código de rastreio, saldo, endereço, CPF ou status.
- Se o cliente pedir dados específicos da conta dele (status do pedido, rastreio, alteração cadastral, reembolso), oriente a: (a) entrar em "Minha conta" → "Meus pedidos"; ou (b) falar com um atendente humano pelo WhatsApp da loja.
- Nunca peça CPF, CNPJ, senha, número de cartão ou código de segurança.
- Para acesso ao Canal Atacado, oriente a acessar a página /atacado e enviar a solicitação por lá.

Se não souber, diga que não sabe e sugira falar com um atendente humano.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: unknown };
        try {
          body = (await request.json()) as { messages?: unknown };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const messages = body.messages;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);
        const model = gateway("openai/gpt-5.5");

        try {
          const result = streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });
          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
          });
        } catch (error) {
          console.error("[/api/chat] error:", error);
          const message = error instanceof Error ? error.message : "AI request failed";
          const status = /429/.test(message) ? 429 : /402/.test(message) ? 402 : 500;
          return new Response(message, { status });
        }
      },
    },
  },
});
