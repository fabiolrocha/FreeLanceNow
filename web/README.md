# Web FreeLanceNow

Aplicação web do FreeLanceNow. Ela consome a API do projeto (`../api`). Em produção, está publicada em
**https://freelancenow.vercel.app**, ligada à API em https://freelancenow-api.onrender.com.

## Instalação, configuração e execução

### Pré-requisitos

| Forma de execução | O que instalar |
|---|---|
| Com Docker (recomendada) | Git e Docker com Docker Compose v2 |
| Sem Docker (desenvolvimento) | Node.js **22.12 ou mais recente** e npm, além da API em execução (veja `../api/README.md`) |

Portas usadas no computador: `5173` (web), `8081` (API) e `5435` (PostgreSQL). Para trocar, altere `WEB_PORT`, `API_PORT` ou `DB_PORT` no `.env` da raiz.

### Dependências

As dependências estão em `package.json`, com as versões exatas em `package-lock.json`. Elas são instaladas pelo `npm ci` (ou automaticamente dentro do Docker):
React 19, React Router 7, TypeScript 6, Vite 8, Stripe Connect JS, Lucide (ícones) e fonte Public Sans. Para desenvolvimento e testes: Vitest, Playwright, axe-core, oxlint e Prettier.

### Variáveis de ambiente

As variáveis `VITE_*` são lidas **no momento do build** e ficam visíveis no navegador; nunca coloque segredos nelas.

| Variável | Onde configurar | Valor local / padrão | Para que serve |
|---|---|---|---|
| `VITE_DATA_MODE` | `.env` da raiz (Docker) ou `web/.env.local` (npm) | `api` | `api` usa a API real e o banco. `mock` usa dados fictícios no navegador, sem API (só para estudo de telas) |
| `VITE_API_BASE_URL` | `web/.env.local` ou Vercel | `/api/v1` | Endereço da API. Localmente, `/api/v1` passa pelo proxy (Vite ou Nginx). Em produção: `https://freelancenow-api.onrender.com/api/v1` |
| `API_PROXY_TARGET` | `web/.env.local` | `http://localhost:8081` | Só no `npm run dev`: para onde o Vite encaminha `/api` e `/actuator` |
| `VITE_SUPPORT_EMAIL` | `.env` da raiz ou `web/.env.local` | vazio | Opcional: e-mail de contato mostrado em Ajuda, Termos e Privacidade |

### Executar com Docker (recomendado)

Sobe banco, API e web juntos. Na **raiz do projeto** (pasta acima de `web/`):

```sh
cp .env.example .env
docker compose up -d --build
```

O primeiro build pode levar alguns minutos. A web só inicia depois que a API responde. Abra **http://localhost:5173**.

Depois de alterar o código ou o `.env`, repita `docker compose up -d --build`. Para parar: `docker compose down`.

### Executar sem Docker (Node.js)

1. Deixe o banco e a API rodando. Na raiz: `docker compose up -d --build db api` (ou siga `../api/README.md` para rodar a API com JDK 21).
2. Na pasta `web/`:

```sh
cd web
cp .env.example .env.local
npm ci
npm run dev
```

Abra **http://localhost:5173**. O Vite recarrega a página a cada alteração e encaminha `/api` para a API na porta `8081`.

Para gerar a versão de produção: `npm run build` cria a pasta `dist/`; `npm run preview` serve essa pasta localmente.

### Contas para testar

Com a API local iniciada pelo Docker Compose (banco novo com dados de demonstração), todas com a senha `Demo12345`:

| Perfil | E-mail |
|---|---|
| Cliente | `cliente@demo.freelancenow.test` |
| Freelancer | `freelancer@demo.freelancenow.test` |
| Administrador | `admin@demo.freelancenow.test` |

Também é possível criar uma conta de cliente ou freelancer pela tela de cadastro. A versão publicada usa outra senha, listada em [contas de acesso](../docs/contas-de-acesso.md).

Pagamentos usam o Stripe em **modo de teste** e só aparecem quando a API tem `STRIPE_SECRET_KEY` configurada; nenhum valor real é cobrado.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Verifica tipos e gera `dist/` |
| `npm run preview` | Serve o `dist/` gerado |
| `npm run lint` | Análise estática (oxlint) |
| `npm run format` / `npm run format:check` | Formata / confere a formatação (Prettier) |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes no navegador com dados fictícios (Playwright). Antes, rode `npx playwright install chromium` |
| `E2E_DATA_MODE=api npm run test:e2e` | Testes no navegador com a API real (banco e API ligados) |

### Publicação (Vercel)

A pasta `web/` é publicada na Vercel com `vercel.json` (build `npm run build`, saída `dist/`). Configure em Settings → Environment Variables: `VITE_DATA_MODE=api` e `VITE_API_BASE_URL=https://freelancenow-api.onrender.com/api/v1`. Roteiro completo em [deploy](../docs/deploy.md).

## Sobre a aplicação

Perfis de acesso: **cliente** (busca profissionais, publica demandas, contrata, paga e avalia), **freelancer** (publica serviços e posts no feed, envia propostas, conversa com o cliente e recebe) e **administrador** (usuários, categorias, moderação de denúncias, métricas e auditoria). Cada tela respeita o perfil do usuário autenticado, e a API repete essa verificação.

O layout se adapta a computador e celular (a partir de 390 px de largura).

Documentação complementar:

- [Documento de Arquitetura, com as telas do sistema](../docs/Documento%20de%20Arquitetura/Documento-de-Arquitetura.pdf)
- [Contas de acesso](../docs/contas-de-acesso.md)
- [Testes e roteiro de demonstração](../docs/testes-e-demonstracao.md)
