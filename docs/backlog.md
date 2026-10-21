# Backlog de entregas

Revisado em **21/10/2026**, com base na `main` em `7a6e769`. A equipe escolhe e combina tarefas conforme dependências e disponibilidade, **sem pessoas ou pares predefinidos por caso de uso**. P0 bloqueia o aceite da entrega; P1 melhora a base sem ampliar o produto.

“Implementado” indica código integrado e cobertura existente; os registros de execução estão em [testes e demonstração](testes-e-demonstracao.md). Uma tela mock não encerra uma integração real. As janelas futuras do [roadmap](roadmap.md) são sugestões; o prazo final é **18/11/2026**.

## Funcionalidades e critérios de aceite

| ID | Área | Estado em 21/10 | Dependências | Critério de aceite |
|---|---|---|---|---|
| F01 | Contratação | Implementado (`fase-01`) | Auth e catálogo | Solicitar, aceitar/recusar, iniciar, sinalizar conclusão, confirmar/contestar; participantes autorizados, histórico e snapshots persistentes |
| F02 | Prazos | Implementado (`fase-01`) | F01 | Cancelar pendência após 48h e confirmar conclusão após 5 dias; jobs idempotentes e testes de relógio |
| F03 | Avaliação | Implementado (`fase-02`) | F01 | Nota 1–5 única e imutável em até 7 dias; média com 1 decimal, resposta única e filtro por nota |
| F04 | Administração | Pendente; telas mock | Auth e catálogo | Provisionamento controlado de admin; gestão persistente de usuários/categorias, autorização e auditoria |
| F05 | Moderação | Parcial; contestação e decisão de disputa ligadas à API | F01, F04 | Provisionar admin, persistir denúncias/evidências, completar auditoria e validar a fila ponta a ponta; a interface já chama a transição real de disputa quando há sessão ADMIN |
| F06 | Catálogo e imagens | Pendente; API já pagina busca | Catálogo | Até 5 JPG/PNG de até 5 MB por anúncio, storage/autorização e paginação da API na interface; validar filtros e limites |
| F07 | Comunicação e acesso | Pendente; telas locais/visuais | Auth, F01, F08 | Recuperação/verificação por e-mail, mensagens e notificações persistentes entre contas; Resend configurado e falhas tratadas |
| F08 | Demandas/propostas | Implementado (`fase-03`) | Auth, catálogo, F01 | Publicar demanda, enviar proposta pendente única por profissional, aceitar/recusar; aceite fecha demanda, rejeita demais pendentes e gera contratação `ACEITO` |
| F09 | Financeiro | Pendente; telas simuladas | F01, F02, regras de disputa | Stripe Sandbox, comissão planejada de 10%, eventos idempotentes, reembolso, registros financeiros e conciliação testados |
| F10 | Operação | Pendente | Integrações anteriores | Termos revisados, retenção, backup/restauração, observabilidade, rate limit e teste de carga com evidências |

F04/F05 estavam previstos para 15–21/10 e continuam pendentes/parciais. Replanejar essas entregas junto às próximas integrações, sem registrá-las como concluídas por terem telas navegáveis. Os provedores Stripe, Neon e Resend foram escolhidos; isso não comprova implantação nem integração executada.

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
