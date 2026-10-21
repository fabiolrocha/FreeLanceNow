# Escopo e entregas

Revisado em **21/10/2026**. O FreeLanceNow conecta clientes que precisam de serviços gerais a profissionais que os oferecem. Clientes contratam anúncios ou publicam demandas; freelancers oferecem serviços e enviam propostas. A administração dispõe de gestão, denúncias, métricas e auditoria persistentes nesta entrega F04/F05.

**Entrega final: 18/11/2026, quarta-feira, horário de Brasília.** O marco de 07/10 e as fases F01/F02/F03/F08 já compõem a base atual. O [roadmap](roadmap.md) distingue entregas integradas e trabalho restante. A colaboração é por entrega, sem pessoas designadas de forma fixa para cada caso.

## Mudança de experiência principal

A descoberta deve acontecer em um **feed inicial**, inspirado na dinâmica de Instagram/LinkedIn e na composição do HTML fornecido. Pessoas devem publicar textos/informações sobre seu trabalho e encontrar oportunidades para abrir serviços, perfis ou demandas. O feed será a entrada principal para conectar pessoas e necessidades.

O código atual ainda abre um Dashboard em `/inicio`; essa é uma divergência a corrigir em F11. O painel de gestão permanece como apoio. A [proposta do feed](superpowers/specs/2026-10-21-feed-inicial-design.md) separa requisitos confirmados e decisões pendentes, incluindo composição e visibilidade antes do login. F04/F05 seguem em seu PR próprio, sem misturar a mudança visual à entrega administrativa.

## Estado da aplicação

| Área | Disponível agora | Trabalho restante |
|---|---|---|
| Navegação pública | Início, busca, profissionais, detalhe, cadastro, login e ajuda | Refinamentos e regressão de layout/acesso |
| Cliente | Perfil, solicitações, acompanhamento, confirmação, contestação, avaliação e demandas/propostas integrados à API | Comunicação, anexos e financeiro |
| Freelancer | Perfil, anúncios, execução, resposta a avaliações e propostas integrados à API | Upload, comunicação e financeiro |
| Administração | Bootstrap ADMIN, usuários/categorias, moderação de serviços/avaliações/disputas, métricas e auditoria integrados | Notificações externas (F07), anexos (F06) e financeiro (F09) |
| API e banco | Auth JWT, perfis, catálogo, contratações, prazos de 48h/5 dias, avaliações, demandas/propostas; migrações V1–V7, denúncias e auditoria | Integrações dos cards F06/F07/F09/F10 |
| Organização | Documentação, CI e fluxo de branches/PRs | Manter critérios de aceite e evidências por entrega |

**Persistência real:** usuário, categoria, anúncio, contratação e histórico, avaliação, demanda e proposta. **Persistência administrativa:** denúncias e auditoria. **Simulação:** mensagens, notificações e financeiro. Em `VITE_DATA_MODE=api`, o primeiro grupo usa PostgreSQL; telas do segundo grupo continuam demonstrativas. O ADMIN real é provisionado por configuração explícita; não há conta/senha padrão. Denúncias preservam relato e cópia textual do alvo, com decisões e atores auditados; upload de anexos permanece em F06.

A matriz de [frontend](frontend.md) lista rotas existentes e seu estado. Telas demonstrativas não devem ser apresentadas como integrações concluídas. A antiga página de delegação foi substituída pelo [guia de colaboração](equipe.md); os originais e o protótipo são referências históricas.

## Entrega planejada

Até 18/11, o plano inclui administração/auditoria, moderação, upload e paginação no web, recuperação/verificação por e-mail, mensageria/notificações, financeiro em sandbox, operação, testes e apresentação. F01/F02/F03/F08 já compõem a base da main; F04/F05 estão implementados no PR #40, ainda aberto. F11 (feed/publicações) passa a ser a próxima prioridade. F06/F07/F09/F10 seguem pendentes conforme o [backlog](backlog.md), com janelas a rever por causa do novo escopo.

Stripe Sandbox, Neon e Resend são escolhas de provedores; não constituem integrações entregues. Não há movimentação financeira real. Aplicativo móvel, lançamento comercial e comprovação de SLA de produção estão fora da entrega atual.
