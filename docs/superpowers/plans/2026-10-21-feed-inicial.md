# Feed inicial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Execução inline autorizada pelo usuário em 21/10/2026.

**Goal:** substituir o Dashboard inicial por um feed misto autenticado, com publicações persistentes, descoberta e moderação.

**Architecture:** módulo `feed` no monólito Spring, migração V8 aditiva e consulta paginada que une publicações, serviços e demandas sem duplicar oportunidades. React usa adapter próprio e shell de descoberta em três colunas; gestão continua nas rotas existentes.

**Tech Stack:** Java 21, Spring/JPA/JDBC, PostgreSQL 15, React/TypeScript, Playwright. Sem novas dependências.

**Spec:** `docs/superpowers/specs/2026-10-21-feed-inicial-design.md` (aprovada).

## Global Constraints

- Feed misto após login; sem acesso público novo. Propostas e contatos permanecem privados.
- Texto de 1–500 caracteres; vínculo opcional a serviço próprio visível; categoria opcional ativa.
- Paginação inicial de 20, ordenação determinística data/ID e filtros tipo/categoria.
- Sem curtidas/comentários/seguidores fictícios; fotos ficam em F06.
- Remoção própria e administrativa lógica, denúncias/auditoria aproveitam F05.
- Public Sans/verde/superfícies claras; três colunas desktop e coluna única em 390 px.

## Review Focus

- Demandas de terceiros: cliente não vê demanda alheia; freelancer só recebe oportunidades abertas de conta ativa no feed.
- Serviço vinculado fica inativo/moderado: publicação associada deixa de expor uma oportunidade indisponível.
- Mesmo instante em fontes diferentes: ordenar também por ID/tipo para evitar paginação instável.
- Atualizações de conta removida/suspensa: token antigo e conteúdo deixam de ser aceitos/expostos.
- Falha de publicação/carregamento: manter texto e permitir nova tentativa, sem fallback mock em API.

### Task 1: API de feed e moderação

**Files:** criar `api/.../feed/{FeedController,FeedService,FeedDtos,FeedPost,FeedPostRepository}.java`, `V8__feed.sql`, `FeedIntegrationTests.java`; modificar `moderation/{ModerationService,ContentReport}.java`.

**Interfaces:** `GET /api/v1/feed?page=0&size=20&type=UPDATE|SERVICE|DEMAND&categoryId=UUID` retorna `{items,page,size,totalElements,totalPages}`; itens com autor seguro, texto, data, categoria, referência ao serviço/demanda, valor/prazo. `POST /feed/posts` recebe `{text,categoryId?,serviceId?}`; `PATCH /feed/posts/{id}/hide` retira publicação própria. Denúncias recebem alvo `POST`.

- [x] Testar HTTP real: autenticação, persistência entre contas, espaços/limites, vínculo próprio, ausência de contato, filtros/paginação, suspensão, remoção própria, moderação/auditoria e demandas autorizadas; observar 404/RED.
- [x] Implementar entidade/migração/consulta SQL UNION ALL paginada com filtros de visibilidade no banco e DTO específico; moderação usa o mesmo hide lógico.
- [x] Executar `docker compose --profile test run --rm api-test`; todos os testes passam. Commit.

### Task 2: Experiência web

**Files:** criar `web/src/data/feed.ts`, `web/src/features/feed/{pages.tsx,feed.css}`, `web/tests/feed.spec.ts`; modificar `App.tsx`, `Layout.tsx`, tipos/datas de mock, adapter/telas de denúncias.

**Interfaces:** adapter tipado consome Task 1; mock usa sessionStorage com os mesmos tipos e recursos do store, sem simular resposta da API em falha.

- [x] E2E primeiro: login abre feed, publicar/recarregar/trocar conta, filtros e links reais, retirada própria, demanda/serviço pelo composer, navegação mobile e sem overflow; observar RED.
- [x] Implementar shell sem quarta coluna, composer, cards cronológicos, filtros/paginação e estados de erro/vazio/carregamento. Manter `/painel` para gestão e entrada autenticada `/` redirecionada ao feed.
- [x] Integrar POST em denúncia/moderação API e mock, incluindo teste de publicação denunciada/moderada. Executar unitários, lint, build, format e Playwright mock/API. Commit.

### Task 3: Evidência, revisão e publicação

- [x] Atualizar documentação com comportamento entregue e endpoints novos; preservar fontes/hash.
- [x] Revisão independente do diff completo, corrigir achados relevantes com regressão RED→GREEN.
- [x] Verificar suíte completa e navegador desktop/390 px; commit/push, PR próprio baseado em F04/F05 enquanto #40 estiver aberto (sem mesclar por autorização implícita).

## Registro

- Base `335d88b`; F04/F05 dependência no PR #40. Usuário aprovou proposta completa e execução em 21/10.
- Pre-flight: Task 2 consome o DTO/endpoints de Task 1; campos definidos acima. Task 3 comprova os fluxos de ambas.

- Task 1: concluída em `389437f`. Cinco testes novos falharam por endpoints ausentes e passaram após implementação; suíte completa 36/36, V8 aditiva.
- Task 2: concluída em `2b751df`, com ajuste posterior de paginação. Publicação/reload/troca de conta/filtros/retirada e navegação mock/API verificados; API indisponível mantém o texto.
- Revisão independente: sem Critical/Important; um Minor confirmado (retirar último item da última página). Regressão observada RED antes de ajustar índice ao novo total, depois GREEN; suíte mock 11/11.
- Verificação: 36 Java, 3 Vitest, 11 browser mock e 5 browser API; lint/build/formatação verdes, 42 endpoints de negócio documentados e 26 fontes preservadas. Screenshots desktop/390 px em `docs/evidencias/f11/`.
- Ruling: feed autenticado preserva permissões de demanda; não tornar uma demanda alheia visível ao cliente para preencher o feed. Sem fotos/likes/comentários/seguidores em F11.
- Ruling: o shell de descoberta é compartilhado pelas páginas regulares, substituindo sidebar fixa por cabeçalho/menu da conta. ADMIN conserva a sidebar administrativa.
- Integração: publicar PR separado com base na branch de #40 enquanto F04/F05 aguardam integração. Nenhum merge foi autorizado para essas duas entregas.
