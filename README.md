# FreeLanceNow

Marketplace acadêmico de serviços gerais: clientes encontram profissionais e freelancers publicam seus serviços. Este monorepositório reúne o frontend **React web**, a API **Java / Spring Boot**, PostgreSQL e a documentação do Grupo 2.

**Documentação revisada em 21/10/2026. Entrega final: quarta-feira, 18 de novembro de 2026.** A base atual inclui o marco de 7 de outubro e as integrações de contratações/prazos, avaliações e demandas/propostas (`F01`, `F02`, `F03`, `F08`). F04/F05 acrescentam administração e moderação persistentes. Comunicação, upload e financeiro continuam pendentes. O [roadmap](docs/roadmap.md) distingue o estado atual das próximas janelas sugeridas. A entrega é React web; aplicativo móvel está fora do escopo.

A próxima prioridade é **F11 — feed inicial e publicações**, conforme a mudança de escopo de 21/10: o início deve conectar pessoas a trabalhos/oportunidades, retomando o HTML de referência. Essa experiência ainda não está implementada; veja a [proposta do feed](docs/superpowers/specs/2026-10-21-feed-inicial-design.md). F04/F05 estão publicadas no [PR #40](https://github.com/fabiolrocha/FreeLanceNow/pull/40), aberto com CI aprovada.

## Começar

Pré-requisitos: Git e Docker com Compose. Para desenvolver o React fora do Docker: Node **22.12+** e npm. Para desenvolver a API fora do Docker: **JDK 21**; o Maven Wrapper está incluído.

```sh
cp .env.example .env
docker compose up -d --build
```

Abra **http://localhost:5173**. A API responde em **http://localhost:8081/actuator/health**. O PostgreSQL local usa a porta **5435**. Essas portas evitam conflitos com outros projetos presentes na máquina de origem.

Por padrão, a aplicação roda em **modo mock**, sem depender da API para navegar. Na tela de login, os botões **Cliente**, **Freelancer** e **Admin** abrem contas fictícias. Todas usam a senha `Demo12345`. Dados simulados ficam na sessão do navegador; fechar a aba ou limpar `sessionStorage` reinicia a experiência. Ações financeiras nunca movimentam dinheiro.

### Usar a API real

Altere `VITE_DATA_MODE=api` no `.env` da raiz e reconstrua o frontend:

```sh
docker compose up -d --build web
```

No modo API, cadastro, login, edição de perfil, categorias, profissionais, criação/edição/ativação de anúncios, **solicitação e ciclo completo de contratações (com prazos automáticos de 48h/5 dias), avaliações com nota média e resposta do profissional e publicação de demandas com propostas e aceite gerando contratação (`F01`, `F02`, `F03`, `F08`)** passam pelo Spring Boot e persistem no PostgreSQL. Gestão de usuários/categorias, denúncias de anúncios/avaliações, decisões de moderação, métricas e auditoria também estão integradas (`F04`/`F05`). Comunicação e financeiro continuam simulados; upload permanece pendente. Não há fallback silencioso para mocks quando a API falha.

Crie uma conta pela interface, ou entre com `marcos@demo.freelancenow.test` / `Demo12345` para explorar um freelancer fictício sem criar conta. O seed está restrito ao perfil `dev` com `SEED_DEMO=true`. A API impede cadastro público de administradores. Para criar o primeiro ADMIN real, configure no `.env` ignorado `ADMIN_BOOTSTRAP_ENABLED=true`, `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD` (mínimo 8 caracteres com letras/números, máximo 72 bytes), então reconstrua/recrie `api`. Não há credenciais padrão. Depois da criação, desabilite o bootstrap e recrie a API. Reiniciar não redefine senha nem promove uma conta comum existente. Veja [desenvolvimento](docs/desenvolvimento.md).

### Desenvolver com atualização automática

```sh
docker compose up -d --build db api
cd web
npm ci
npm run dev
```

O Vite abre em http://localhost:5173 e encaminha `/api` para a API na porta 8081. Para alterar seu modo, copie `web/.env.example` para `web/.env.local`, ajuste `VITE_DATA_MODE` e reinicie o Vite. Variáveis do frontend são incorporadas durante o build; não coloque segredos nelas. Para Java local, veja [guia de desenvolvimento](docs/desenvolvimento.md).

## Verificar

```sh
cd web
npm ci
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Na raiz, execute os testes da API em banco isolado:

```sh
docker compose --profile test run --rm api-test
```

Com `db` e `api` ligados, execute o fluxo real pelo navegador:

```sh
cd web
E2E_DATA_MODE=api npm run test:e2e
# Para incluir o fluxo administrativo, forneça as credenciais do ADMIN provisionado:
E2E_DATA_MODE=api E2E_ADMIN_EMAIL='seu-admin@example.test' E2E_ADMIN_PASSWORD='sua-senha-de-teste' npm run test:e2e
```

Os testes integrados criam contas fictícias `@example.test`. A suíte da API usa `db-test`, nunca o banco de desenvolvimento. A CI executa preservação dos documentos originais, lint, formatação, build, testes unitários, navegação mock e integração da API com PostgreSQL. O fluxo de navegador em modo API é uma verificação local adicional. Para mudanças apenas documentais, execute também `node scripts/verify-documents.mjs` e confira links e `git diff --check`.

## Estrutura e equipe

```text
api/                  Java 21, Spring Boot, Spring Security, JPA, Flyway
web/                  React, TypeScript, Vite, React Router
docs/                 Documentação atual, fontes preservadas e decisões
.github/              CI, modelos de issue e pull request
compose.yml           Desenvolvimento e testes locais
```

Comece por estes documentos:

- [Plano da entrega e cronograma](docs/roadmap.md).
- [Colaboração sem papéis fixos](docs/equipe.md) e [backlog com dependências e critérios de aceite](docs/backlog.md).
- [Leitura dos materiais e divergências resolvidas](docs/leitura-do-projeto.md).
- [Arquitetura](docs/arquitetura.md), [contrato da API](docs/api.md) e [modelo de dados](docs/dados.md).
- [Marca e imagens](docs/imagens.md), [rotas e estado das telas](docs/frontend.md), [roteiro de demonstração](docs/testes-e-demonstracao.md).
- [Índice completo](docs/README.md) e [fluxo de contribuição](CONTRIBUTING.md).

A equipe organiza contribuições por entrega, sem designar pessoas ou revisores fixos para cada caso. O índice das docs identifica os guias atuais e as fontes históricas.

O repositório Git e o remoto `fabiolrocha/FreeLanceNow` já existiam no início da organização. O marco inicial (`marco-1`) foi integrado na `main`, seguido pelas entregas incrementais nas branches `fase-01` (`F01`/`F02`), `fase-02` (`F03`) e `fase-03` (`F08`). Os documentos originais foram realocados sem alterar seu conteúdo; hashes e caminhos estão no [inventário](docs/referencias/inventario.json).

Para parar os serviços sem perder dados: `docker compose down`. O volume `postgres_data` guarda os cadastros. Este ambiente é local e acadêmico; o roadmap descreve o trabalho necessário antes de um lançamento público.
