# Backlog de entregas

Revisado em **21/10/2026**, com F04/F05 e F11 integradas à `main`. A equipe escolhe e combina tarefas conforme dependências e disponibilidade, **sem pessoas ou pares predefinidos por caso de uso**. P0 bloqueia o aceite da entrega; P1 melhora a base sem ampliar o produto.

“Implementado” indica código e cobertura existentes; a coluna de estado distingue o que já está na main e o que aguarda integração de PR; os registros de execução estão em [testes e demonstração](testes-e-demonstracao.md). Uma tela mock não encerra uma integração real. As janelas futuras do [roadmap](roadmap.md) são sugestões; o prazo final é **18/11/2026**.

## F11 — feed e publicações

Mudança de escopo informada em 21/10: o início deve funcionar como feed, onde pessoas publicam sobre o trabalho e descobrem serviços/demandas. F11 substitui o painel de métricas em `/inicio`, preservando `/painel` para gestão. Foi implementada antes das próximas integrações; as janelas de F06/F07 precisam ser revistas em conjunto com esse trabalho.

F04/F05 foram integradas à `main` pelo [PR #40](https://github.com/fabiolrocha/FreeLanceNow/pull/40). A [especificação de F11](superpowers/specs/2026-10-21-feed-inicial-design.md) foi aprovada, revisada no PR #41 e integrada à `main`; publicação e moderação são persistentes. Curtidas/comentários/seguidores não fazem parte desta entrega.

## Funcionalidades e critérios de aceite

| ID | Área | Estado em 21/10 | Dependências | Critério de aceite |
|---|---|---|---|---|
| F01 | Contratação | Implementado (`fase-01`) | Auth e catálogo | Solicitar, aceitar/recusar, iniciar, sinalizar conclusão, confirmar/contestar; participantes autorizados, histórico e snapshots persistentes |
| F02 | Prazos | Implementado (`fase-01`) | F01 | Cancelar pendência após 48h e confirmar conclusão após 5 dias; jobs idempotentes e testes de relógio |
| F03 | Avaliação | Implementado (`fase-02`) | F01 | Nota 1–5 única e imutável em até 7 dias; média com 1 decimal, resposta única e filtro por nota |
| F04 | Administração | Implementado; integrado à `main` (PR #40) | Auth e catálogo | Bootstrap opt-in de ADMIN; gestão de usuários/categorias, suspensão/reativação, filtros, métricas por período, CSV e auditoria persistentes |
| F05 | Moderação | Implementado; integrado à `main` (PR #40); evidência textual | F01, F04 | Denúncias de serviços/avaliações, cópia do conteúdo/relato, decisão fundamentada e remoção lógica persistentes; disputa e demais ações administrativas auditadas |
| F06 | Catálogo e imagens | Pendente; API já pagina busca | Catálogo | Até 5 JPG/PNG de até 5 MB por anúncio, storage/autorização e paginação da API na interface; validar filtros e limites |
| F07 | Comunicação e acesso | Pendente; telas locais/visuais | Auth, F01, F08 | Recuperação/verificação por e-mail, mensagens e notificações persistentes entre contas; Resend configurado e falhas tratadas |
| F08 | Demandas/propostas | Implementado (`fase-03`) | Auth, catálogo, F01 | Publicar demanda, enviar proposta pendente única por profissional, aceitar/recusar; aceite fecha demanda, rejeita demais pendentes e gera contratação `ACEITO` |
| F09 | Financeiro | Pendente; telas simuladas | F01, F02, regras de disputa | Stripe Sandbox, comissão planejada de 10%, eventos idempotentes, reembolso, registros financeiros e conciliação testados |
| F10 | Operação | Pendente | Integrações anteriores | Termos revisados, retenção, backup/restauração, observabilidade, rate limit e teste de carga com evidências |
| F11 | Feed e publicações | Implementado; integrado à `main` (revisão no PR #41) | Auth, catálogo, F08, F04/F05 | Início como feed, publicação persistente, descoberta de oportunidades com ações reais, moderação e adaptação desktop/celular; feed misto autenticado aprovado, sem abrir demandas privadas a visitantes |

F04/F05 foram implementados juntos na branch `codex/fase-04-05-administracao-moderacao` (PR #40). A evidência é o relato e a cópia textual do conteúdo denunciado; arquivos anexos dependem de F06, e avisos por e-mail dependem de F07. Contas são suspensas/reativadas; não há exclusão definitiva. As ações administrativas são auditadas sem apagar histórico. Os provedores Stripe, Neon e Resend foram escolhidos; isso não comprova implantação nem integração executada.

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
