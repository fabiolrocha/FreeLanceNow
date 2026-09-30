# Divisão inicial da equipe

Seis integrantes informados pelo líder: **você (gestor/líder), Caio, Arthur Almirante, Arthur, Felipe e Enzo**. Competências e disponibilidade ainda não foram informadas; a distribuição abaixo é uma proposta para iniciar a colaboração, não uma atribuição baseada em experiência presumida.

A base de código já foi criada. As tarefas desta semana são **revisar, ajustar, completar os cenários e validar a entrega**; não precisam reconstruir os scaffolds. Cada pessoa abre PRs pequenos sobre a branch-base compartilhada após sua integração.

**Prazo final: 18/11/2026.** A tabela abaixo cobre o marco inicial de 07/10. A partir de 08/10, a distribuição proposta para integrar o restante do sistema está nos cards F01–F10 do [backlog](backlog.md), com datas no [roadmap](roadmap.md).

| Pessoa | Área principal e resultado até 06/10 | Tarefas | Arquivos sob coordenação | Revisor |
|---|---|---|---|---|
| Você — gestor/líder | Fechar escopo/imagens, coordenar contratos entre áreas, integrar PRs e preparar apresentação | G01–G04 | README, Compose, `.github/`, roadmap/equipe/decisões | Enzo + donos das áreas |
| Caio | Autenticação real e perfis: revisar validações, mensagens, permissões e contrato de sessão | A01–A03 | `api/.../auth/`, `users/`, `config/SecurityConfig.java`; `docs/api.md` com Felipe | Felipe |
| Arthur Almirante | Catálogo web: busca, detalhe, profissionais, formulário e gestão de anúncios nos dois modos | W01–W03 | `web/src/features/catalog/`, `freelancer/` | Arthur |
| Arthur | Cadastro/login/perfil e fluxo mock de contratação, demanda/proposta, confirmação e avaliação | W04–W06 | `web/src/features/auth/`, `account/`, `contracts/`, `demands/` | Arthur Almirante |
| Felipe | Banco e API de catálogo: migrações, limites, propriedade, seed e busca; preparar modelo futuro | B01–B03 | `api/.../catalog/`, migrations, `config/DemoData.java`, `docs/dados.md` | Caio |
| Enzo | QA e administração mock: roteiro, regressões mobile, CSV, denúncias, extras e evidências | Q01–Q04 | `web/tests/`, `web/src/features/admin/`, `extra/`, `docs/testes-e-demonstracao.md` | Líder |

Estimativa inicial: líder6–8h, Caio6–9h, Arthur Almirante6–9h, Arthur8–12h, Felipe6–9h, Enzo8–12h, distribuídas ao longo da semana. São estimativas de revisão/complemento da base; recalibrar em 01/10 com a disponibilidade real. Se Arthur tiver sobrecarga, Enzo assume a revisão de demandas/propostas após concluir Q01.

## Integrações entre as pessoas

- Caio + Arthur: campos de cadastro/perfil, erros e expiração da sessão. Alterar DTO e tipos juntos em PR coordenado.
- Felipe + Arthur Almirante: formato de anúncio, categoria, preço, draft/inativo e busca. Cada mudança deve funcionar no mock e na API.
- Arthur + Enzo: contrato de estados da contratação e dados demonstrativos; testes devem usar os mesmos atores.
- Líder + todos: `App.tsx`, `store.tsx`, `types.ts`, `client.ts`, `fixtures.ts`, `Layout.tsx` e CSS são arquivos compartilhados. Avisar no canal do grupo antes de editar; uma pessoa integra o trecho combinado.

O revisor verifica execução e critério de aceite, não apenas leitura do diff. Ninguém deve mudar o contrato HTTP, migrações já aplicadas ou a estrutura global sem registrar a decisão e avisar o par dependente.

## Comunicação sugerida

Reunião curta em 01/10 para confirmar responsáveis e imagens; atualização diária com feito/próximo/bloqueio; integração conjunta em 05/10; congelamento do marco inicial em 06/10 às 17h. Depois de 07/10, revisar cada marco semanal do roadmap. Concluir novas funcionalidades até 11/11, congelar a versão final em 16/11, ensaiar em 17/11 e entregar em 18/11. O gestor abre os cards do [backlog](backlog.md) no quadro escolhido e substitui os nomes por responsáveis confirmados. Nenhum convite ou mensagem foi enviado automaticamente aos integrantes.
