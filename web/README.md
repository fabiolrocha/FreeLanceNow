# Web FreeLanceNow

React 19, TypeScript 6 e Vite 8. `npm ci` instala as versões do lockfile e `npm run dev` inicia a aplicação. O modo padrão é `mock`; copie `.env.example` para `.env.local` e use `VITE_DATA_MODE=api` para integrar a API local.

Scripts: `build`, `lint`, `format`, `format:check`, `test` e `test:e2e`. Playwright exige `npx playwright install chromium`. Para o teste integrado, deixe API/banco ligados e rode `E2E_DATA_MODE=api npm run test:e2e`.

- [Execução completa](../README.md).
- [Telas, rotas e design](../docs/frontend.md).
- [Responsáveis](../docs/equipe.md) e [tarefas](../docs/backlog.md).
- [Imagens ainda em definição](../docs/imagens.md).
