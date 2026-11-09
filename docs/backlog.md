# Backlog de entregas

Revisado em **09/11/2026**, com F01, F02, F03, F04, F05, F08 e F11 concluídas na `main`, e entregas parciais de F06, F07, F09 e F10 integradas pelos PRs #43, #44 e #45. A equipe escolhe e combina tarefas conforme dependências e disponibilidade, **sem pessoas ou pares predefinidos por caso de uso**. P0 bloqueia o aceite da entrega; P1 melhora a base sem ampliar o produto.

“Implementado” indica código e cobertura existentes; a coluna de estado distingue o que já está concluído na `main` e o que resta para fechar cada card; os registros de execução estão em [testes e demonstração](testes-e-demonstracao.md). Uma tela mock não encerra uma integração real. As janelas futuras do [roadmap](roadmap.md) são sugestões; o prazo final é **18/11/2026**.

## F11 — feed e publicações

Mudança de escopo informada em 21/10: o início deve funcionar como feed, onde pessoas publicam sobre o trabalho e descobrem serviços/demandas. F11 substitui o painel de métricas em `/inicio`, preservando `/painel` para gestão. Foi implementada e integrada à `main` (PR #41 / PR #42).

F04/F05 foram integradas à `main` pelo [PR #40](https://github.com/fabiolrocha/FreeLanceNow/pull/40). Em 09/11, o [PR #45](https://github.com/fabiolrocha/FreeLanceNow/pull/45) integrou avisos internos, chat por contratação (`V9`), exibição de prazos/avaliações e paginação da busca; o [PR #43](https://github.com/fabiolrocha/FreeLanceNow/pull/43) adicionou o DDL financeiro (`V10`); e o [PR #44](https://github.com/fabiolrocha/FreeLanceNow/pull/44) preparou a configuração de deploy (Vercel, Neon TLS, `stripe-java` e `JwtSecretValidator`).

## Funcionalidades e critérios de aceite

| ID | Área | Estado em 09/11 | Dependências | Critério de aceite |
|---|---|---|---|---|
| F01 | Contratação | Concluído na `main` (Issue #22 fechada) | Auth e catálogo | Solicitar, aceitar/recusar, iniciar, sinalizar conclusão, confirmar/contestar; participantes autorizados, histórico e snapshots persistentes |
| F02 | Prazos | Concluído na `main` (Issue #23 fechada) | F01 | Cancelar pendência após 48h e confirmar conclusão após 5 dias; jobs idempotentes, testes de relógio, avisos e prazos visíveis na tela |
| F03 | Avaliação | Concluído na `main` (Issue #24 fechada) | F01 | Nota 1–5 única e imutável em até 7 dias; média com 1 decimal, resposta única, filtro por nota e listagem no perfil e no serviço |
| F04 | Administração | Concluído na `main` (PR #40, Issue #25 fechada) | Auth e catálogo | Bootstrap opt-in de ADMIN; gestão de usuários/categorias, suspensão/reativação, filtros, métricas por período, CSV e auditoria persistentes |
| F05 | Moderação | Concluído na `main` (PR #40/PR #42, Issue #26 fechada) | F01, F04 | Denúncias de serviços/avaliações/posts, cópia do conteúdo/relato, decisão fundamentada e remoção lógica persistentes; disputa e ações auditadas |
| F06 | Catálogo e imagens | Em andamento (PR #45, Issue #27): paginação da busca no React e avaliações no serviço concluídas; **falta upload/storage de imagens** | Catálogo | Até 5 JPG/PNG de até 5 MB por anúncio, storage/autorização e paginação da API na interface; validar filtros e limites |
| F07 | Comunicação e acesso | Em andamento (PR #45, Issue #28): avisos internos e chat por contratação persistentes (`V9`); **falta e-mail (Resend) e recuperação de senha** | Auth, F01, F08 | Recuperação/verificação por e-mail, mensagens e notificações persistentes entre contas; Resend configurado e falhas tratadas |
| F08 | Demandas/propostas | Concluído na `main` (Issue #29 fechada) | Auth, catálogo, F01 | Publicar demanda, enviar proposta pendente única por profissional, aceitar/recusar; aceite fecha demanda, rejeita demais pendentes e gera contratação `ACEITO` |
| F09 | Financeiro | Em andamento (PR #43/PR #44, Issue #30): DDL `V10` (`payment` e `ledger_entry`), SDK `stripe-java` e variáveis prontos; **falta checkout sandbox, webhooks, repasse/reembolso e integração das telas** | F01, F02, regras de disputa | Stripe Sandbox, comissão planejada de 10%, eventos idempotentes, reembolso, registros financeiros e conciliação testados |
| F10 | Operação | Em andamento (PR #44, Issue #31): perfil `prod`, `JwtSecretValidator`, TLS Neon, `vercel.json` e guia de deploy prontos; **falta rate limit, backup/restauração, termos/retenção e teste de carga** | Integrações anteriores | Termos revisados, retenção, backup/restauração, observabilidade, rate limit e teste de carga com evidências |
| F11 | Feed e publicações | Concluído na `main` (PR #41/PR #42) | Auth, catálogo, F08, F04/F05 | Início como feed, publicação persistente, descoberta de oportunidades com ações reais, moderação e adaptação desktop/celular; feed misto autenticado aprovado, sem abrir demandas privadas a visitantes |

F04/F05 foram implementados juntos na branch `codex/fase-04-05-administracao-moderacao` (PR #40). A evidência é o relato e a cópia textual do conteúdo denunciado; arquivos anexos dependem da conclusão de F06, e avisos por e-mail dependem da conclusão de F07. Contas são suspensas/reativadas; não há exclusão definitiva. As ações administrativas são auditadas sem apagar histórico. Os provedores Stripe, Neon e Resend foram escolhidos e preparados, mas o fluxo financeiro e o envio de e-mail ainda precisam ser concluídos.

## Revisão transversal

| Prioridade | Trabalho | Aceite |
|---|---|---|
| P0 | Manter auth, perfis e anúncios estáveis | Cadastro sem admin público, conta inativa bloqueada, contatos privados, proprietário e limite de 20 anúncios respeitados |
| P0 | Regressão de F01/F02/F03/F08 | Fluxos integrados, cenários negativos e persistência após reload; prazos cobertos sem esperar dias reais |
| P0 | Conferir ambiente e CI | Execução reproduzível, banco de teste isolado e checks aplicáveis passando |
| P0 | Atualizar documentação e demonstração | Sem delegação nominal; matriz distingue API, simulação e texto estático; comandos/limitações correspondem à versão |
| P1 | Refinar experiência e acessibilidade | Estados vazios/erro, teclado, formulários e layout desktop/390 px sem bloqueios |

## Rastreabilidade do marco inicial

Os IDs anteriores ficam como referência para issues e PRs existentes. Eram uma lista de revisão do marco de **07/10**, não uma escala atual de pessoas nem aceite automático de cada card.

| IDs anteriores | Assunto | Referência atual |
|---|---|---|
| G01–G04 | Escopo, identidade, integração e ensaio | Escopo, imagens, roadmap e revisão transversal |
| A01–A03 | Auth, perfis e sessão | Requisitos RN01–RN04 e testes de API |
| B01–B03 | Migrações, anúncios e busca | Dados, API e F06 |
| W01–W04 | Catálogo, anúncios, login e perfil web | Frontend e revisão transversal |
| W05–W06 | Contratação e demandas mock | F01/F02/F03/F08 e regressão nos dois modos |
| Q01–Q04 | Testes, administração e áreas simuladas | Testes, F04/F05/F07/F09 |

## Critério de conclusão

Uma tarefa termina quando satisfaz seu aceite, passa as verificações relevantes, atualiza contratos/documentos afetados e recebe revisão de outro integrante disponível. O PR descreve resultado, comandos executados e limites. Dados de teste são fictícios; não versionar `.env`, tokens, builds ou logs.

Reservar **12–16/11** para regressão e correções, **17/11** para ensaio e **18/11** para entrega. Alterações de prazo intermediário devem aparecer também no roadmap.
