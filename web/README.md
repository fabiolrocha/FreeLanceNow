# Web FreeLanceNow

Revisado em **21/10/2026**. React 19, TypeScript 6 e Vite 8. `npm ci` instala as versões do lockfile e `npm run dev` inicia a aplicação. O modo padrão é `mock`; copie `.env.example` para `.env.local` e use `VITE_DATA_MODE=api` para integrar a API local.

Scripts: `build`, `lint`, `format`, `format:check`, `test` e `test:e2e`. Playwright exige `npx playwright install chromium`. Para o teste integrado, deixe API/banco ligados e rode `E2E_DATA_MODE=api npm run test:e2e`.

- [Execução completa](../README.md).
- [Telas, rotas e design](../docs/frontend.md).
- [Colaboração sem papéis fixos](../docs/equipe.md) e [tarefas](../docs/backlog.md).
- [Marca, ícones e upload planejado](../docs/imagens.md).

No modo API, auth, perfis, catálogo, contratações, avaliações e demandas/propostas são persistentes. Recuperação de senha, mensagens, notificações, financeiro e administração ainda têm telas visuais/simuladas. Consulte a matriz de frontend antes de apresentar um fluxo como integrado.
