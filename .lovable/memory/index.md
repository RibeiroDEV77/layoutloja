# Project Memory

## Core
Storefront público vive na raiz (/, /c/$category, /p/$slug, /carrinho, /busca). Sobre em /sobre. Admin em /admin/*.
Design Minimal Mono: bg off-white quente, fg near-black, accent âmbar (oklch 0.72 0.16 60). Inter única. Radius 0.25rem. Sem gradientes coloridos.
Não duplicar regras de negócio. Storefront é apenas projeção/wrapper das services em src/lib/business/services/*.

## Memories
- [Storefront data layer](mem://architecture/storefront) — supabaseAdmin para reads filtrados a status=published e wrappers públicos de carrinho via session_token cookie.
