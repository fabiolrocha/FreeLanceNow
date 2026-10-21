# Escopo e entregas

Revisado em **21/10/2026**. O FreeLanceNow conecta clientes que precisam de serviços gerais a profissionais que os oferecem. Clientes contratam anúncios ou publicam demandas; freelancers oferecem serviços e enviam propostas. A administração prevê gestão e moderação, ainda sem integração completa.

**Entrega final: 18/11/2026, quarta-feira, horário de Brasília.** O marco de 07/10 e as fases F01/F02/F03/F08 já compõem a base atual. O [roadmap](roadmap.md) distingue entregas integradas e trabalho restante. A colaboração é por entrega, sem pessoas designadas de forma fixa para cada caso.

## Estado da aplicação

| Área | Disponível agora | Trabalho restante |
|---|---|---|
| Navegação pública | Início, busca, profissionais, detalhe, cadastro, login e ajuda | Refinamentos e regressão de layout/acesso |
| Cliente | Perfil, solicitações, acompanhamento, confirmação, contestação, avaliação e demandas/propostas integrados à API | Comunicação, anexos e financeiro |
| Freelancer | Perfil, anúncios, execução, resposta a avaliações e propostas integrados à API | Upload, comunicação e financeiro |
| Administração | Gestão/denúncias/financeiro demonstrativos; moderação de disputa já usa a API com sessão ADMIN | Provisionamento de admin, gestão e denúncias persistentes, evidências, auditoria e validação do fluxo (F04/F05) |
| API e banco | Auth JWT, perfis, catálogo, contratações, prazos de 48h/5 dias, avaliações, demandas/propostas; migrações V1–V5 | Integrações dos cards F04–F07/F09/F10 |
| Organização | Documentação, CI e fluxo de branches/PRs | Manter critérios de aceite e evidências por entrega |

**Persistência real:** usuário, categoria, anúncio, contratação e histórico, avaliação, demanda e proposta. **Simulação:** mensagens, notificações, denúncias, gestão administrativa e financeiro. Em `VITE_DATA_MODE=api`, o primeiro grupo usa PostgreSQL; telas do segundo grupo continuam demonstrativas. A seção de disputas da moderação usa contratos e transições reais no modo API quando há sessão ADMIN. A base demo não provisiona essa conta; denúncias/evidências persistentes e auditoria completa ainda faltam.

A matriz de [frontend](frontend.md) lista rotas existentes e seu estado. Telas demonstrativas não devem ser apresentadas como integrações concluídas. A antiga página de delegação foi substituída pelo [guia de colaboração](equipe.md); os originais e o protótipo são referências históricas.

## Entrega planejada

Até 18/11, o plano inclui administração/auditoria, moderação, upload e paginação no web, recuperação/verificação por e-mail, mensageria/notificações, financeiro em sandbox, operação, testes e apresentação. F01/F02/F03/F08 já têm código integrado; as demais funcionalidades permanecem pendentes/parciais conforme o [backlog](backlog.md).

Stripe Sandbox, Neon e Resend são escolhas de provedores; não constituem integrações entregues. Não há movimentação financeira real. Aplicativo móvel, lançamento comercial e comprovação de SLA de produção estão fora da entrega atual.
