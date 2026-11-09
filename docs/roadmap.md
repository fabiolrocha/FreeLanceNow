# Roadmap — entrega final em 18 de novembro de 2026

Revisado em **09/11/2026**. Prazo final: **18/11/2026, quarta-feira**, horário de Brasília. As janelas intermediárias são sugestões de planejamento, sujeitas ao andamento real do projeto. Não há distribuição fixa por pessoa; o grupo combina o trabalho por entrega e dependência.

## Estado atual

| Etapa | Estado verificado no código da `main` em 09/11 |
|---|---|
| Marco inicial de 07/10 (`marco-1`) | Concluído (Marco 1 fechado): base React navegável em mock e API persistente de auth, perfis, categorias e anúncios |
| Contratações e prazos (`fase-01`, F01/F02) | Concluídos (Marco 2 fechado): histórico, participantes, snapshots, jobs de 48h/5 dias, avisos e prazos visíveis |
| Avaliações (`fase-02`, F03) | Concluídas (Marco 3 fechado): nota, média, janela de 7 dias, resposta única e listagem no perfil e no serviço |
| Demandas/propostas (`fase-03`, F08) | Concluídas (Marco 3 fechado): proposta pendente única e aceite gerando contratação `ACEITO` |
| Administração/moderação (F04/F05) | Concluídas (Marco 3 fechado, PR #40): bootstrap ADMIN, gestão, denúncias/evidência textual, remoção lógica, métricas e auditoria |
| Feed e publicações (F11) | Concluído na `main` (PR #41/PR #42): feed misto após login, publicação de texto, filtros/paginação, retirada própria e moderação |
| Melhorias, avisos e chat (F06/F07 parciais) | Integrados à `main` (PR #45): avisos internos e chat por contratação (`V9`), paginação da busca no React, abas de contratação e avaliações no serviço |
| DDL financeiro e preparação de deploy (F09/F10 parciais) | Integrados à `main` (PR #43 e PR #44): migração `V10__payments.sql` (`payment` e `ledger_entry`), SDK `stripe-java`, perfil `prod`, TLS Neon, `JwtSecretValidator`, `vercel.json` e `docs/deploy.md` |

F04/F05 têm implementação no PR #40 e verificações descritas em [testes e demonstração](testes-e-demonstracao.md). O estado detalhado do que falta em F06, F07, F09 e F10 fica no [backlog](backlog.md).

## Prioridade concluída: feed (F11) e comunicação interna (F07 parcial)

O início do aplicativo funciona como o feed previsto no HTML de base, com publicação de conteúdo e descoberta de oportunidades (PR #41/PR #42), e o PR #45 acrescentou avisos internos persistentes (sino com contador e `/notificacoes`), chat por contratação (`/mensagens?contratacao=:id`) e paginação da busca no frontend.

## Próximas janelas até a entrega final

| Período | Entrega | Critério para encerrar |
|---|---|---|
| Até 21/10 — concluído | F01, F02, F03, F04, F05, F08, F11 | Marcos 1, 2 e 3 fechados; feed misto integrado à `main` |
| 09/11 — integrado à `main` | PR #45 (F06/F07 parciais), PR #43 (`V10`) e PR #44 (deploy prep) | Avisos e chat por contratação, paginação da busca, DDL de pagamentos e configuração Vercel/Neon/Stripe integrados |
| 10–12/11 | Concluir F06 (upload de imagens) e F07 (e-mail Resend / recuperação de senha) | Upload de até 5 imagens JPG/PNG (5 MB) validado; envio de e-mail e recuperação de senha testados |
| 10–13/11 | Concluir F09 (fluxo Stripe Sandbox) e F10 (operação) | Checkout sandbox, webhook idempotente, comissão 10%, liberação/reembolso, conciliação, rate limit, backup/restauração e teste de carga |
| 12–16/11 | E01 — Regressão, correções e documentação (Issue #32) | Sem bloqueios de entrega; documentação corresponde à versão; congelamento sugerido em 16/11 |
| 17/11 | E02 — Ensaio e conferência dos materiais (Issue #33) | Roteiro executado do início ao fim; versão e instruções conferidas |
| **18/11** | **E02 — Entrega final (Issue #33)** | **Código, sistema web, documentação, evidências e apresentação entregues** |

As próximas janelas devem acomodar F11, depois F06/F07 e F09/F10. Atualizar calendário e backlog conforme a integração dos PRs e as evidências de cada entrega; a passagem de uma data não conclui a etapa. Não há previsão de trabalho obrigatório em fins de semana.

## Provedores e dependências

Stripe Sandbox, Neon PostgreSQL e Resend foram escolhidos no Passo 0. O código atual contém parâmetros de Stripe/Resend, mas não implementa checkout, webhooks ou envio de e-mail. O Compose usa PostgreSQL local; a escolha do Neon não comprova ambiente remoto implantado. Storage de imagens ainda precisa ser definido.

- F04/F05 dependem de autorização administrativa e do ciclo de contratação já persistente.
- F06 inclui paginação da interface; a paginação do endpoint de busca já existe.
- F07 inclui comunicação persistente e entrega externa, além das telas demonstrativas atuais.
- F09 depende de regras de contratação, confirmação e disputa; demonstrar pagamentos exclusivamente em sandbox nesta entrega.
- F10 fecha operação e evidências; funcionamento local não comprova metas de produção.

## Critérios da entrega final

- React web responsivo com os fluxos previstos de cliente, freelancer e administrador integrados à API.
- Cadastro, perfis, anúncios, contratações, avaliações, demandas/propostas, denúncias/disputas, mensagens e notificações persistidos e autorizados.
- Upload, paginação, e-mail e rotinas de prazo verificados; financeiro testado em sandbox com idempotência e conciliação.
- Testes de fluxo e cenários negativos com evidências; sem bloqueios de navegação, formulário, autorização ou execução.
- Migrações, dados de demonstração, execução e backup/restauração conferidos.
- Documentação correspondente à versão entregue e apresentação ensaiada até 17/11. Horário de entrega/apresentação em 18/11 ainda não informado.

## Acompanhamento

A cada entrega, conferir dependências, demonstrar frontend e backend juntos e atualizar o backlog. Revisão e regressão são combinadas entre integrantes disponíveis. Avisar o grupo sobre mudanças em contratos, migrações e arquivos compartilhados, conforme [colaboração](equipe.md).

| Risco | Ação |
|---|---|
| Integrações de upload/comunicação excederem a próxima janela | Conferir capacidade para F06/F07 e demonstrar seus fluxos completos |
| Conflitos em store, tipos, adapter, rotas e CSS | Combinar edições e integrar PRs pequenos |
| Provedor escolhido ser tratado como integração concluída | Exigir execução e evidência do fluxo real ou sandbox |
| Mock ser confundido com funcionalidade persistente | Usar a matriz de frontend e fechar os cards apenas pelo aceite |
| Falhas descobertas perto do prazo | Preservar 12–16/11 para correções e 17/11 para ensaio |

O HTML em `legado/` é histórico. Este roadmap e o backlog são as referências de planejamento atuais. Aplicativo móvel permanece fora do escopo.
