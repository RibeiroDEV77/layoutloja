# ADR-0007 — Observability nativa: métricas, traces, health, flags

- **Status:** Aceito
- **Data:** 2026-06-21
- **Escopo:** Plataforma

## Contexto
Sem observability nativa, debug em produção depende de logs ad-hoc, dashboards são reativos e SLOs ficam apenas no PowerPoint. Plataformas externas (Datadog, NewRelic) ajudam, mas custam caro e não cobrem domínio.

## Decisão
Incluir 4 pilares no banco como tabelas de primeira classe:
- **`metrics`** — eventos numéricos via `record_metric(scope, name, value, unit, tags, store_id)`.
- **`traces`** — spans correlacionados por `correlation_id` (propagado entre services).
- **`health_checks`** — checagens periódicas via `record_health_check(component, status, latency_ms, details)`.
- **`feature_flags` + `feature_flag_overrides`** — flags com overrides por user/store via `evaluate_feature_flag(key, user, store)`.

Toda Server Function de mutação relevante:
1. Inicia trace com `correlation_id` recebido (ou gera).
2. Registra `*.duration_ms` ao final.
3. Registra contadores de domínio (`order.placed`, `payment.captured`, etc.).
4. Erros viram entry em `system_logs` + métrica `*.failure_rate`.

## Alternativas consideradas
1. OpenTelemetry SDK + provider externo → adiado: integração futura via worker que lê `metrics`/`traces` e exporta.
2. Sem observability até produção → rejeitado: trade-off ruim.

## Consequências
- ✅ Dashboards no próprio admin sem dependência externa.
- ✅ SLOs verificáveis (p95 de checkout, lag de outbox, taxa de breach).
- ⚠️ Volume de escrita — mitigado por amostragem em métricas de alta cardinalidade e particionamento futuro.
- ⚠️ `metrics` pode crescer rápido — política de retenção (90d hot, archive cold) prevista.

## Invariantes
- Toda Server Function pública registra ao menos uma métrica de duração.
- Toda transição de workflow registra evento de timeline + métrica.
- Toda integração externa (gateway, carrier) registra health check.
