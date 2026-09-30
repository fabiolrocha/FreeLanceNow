# FreeLanceNow

Marketplace acadêmico de serviços gerais: clientes encontram profissionais e freelancers publicam seus serviços. Este monorepositório reúne o frontend **React web**, a API **Java / Spring Boot**, PostgreSQL e a documentação do Grupo 2.

**Entrega prevista: quarta-feira, 7 de outubro de 2026.** A primeira entrega contempla a aplicação web navegável com dados simulados e uma API inicial persistente para cadastro, login, perfis, categorias e anúncios. React Native ficou fora desta entrega por decisão do líder.

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

No modo API, cadastro, login, edição de perfil, categorias, profissionais e criação/edição/ativação de anúncios passam pelo Spring Boot e persistem no PostgreSQL. As demais áreas continuam simuladas e exibem aviso. Não há fallback silencioso para mocks quando a API falha.

Crie uma conta pela interface, ou entre com `marcos@demo.freelancenow.test` / `Demo12345` para explorar um freelancer fictício sem criar conta. O seed está restrito ao perfil `dev` com `SEED_DEMO=true`. **Admin existe somente no mock nesta etapa.** A API impede cadastro público de administradores.

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
```

Os testes integrados criam contas fictícias `@example.test`. A suíte da API usa `db-test`, nunca o banco de desenvolvimento. A CI executa lint, build, testes unitários, navegação mock e integração da API com PostgreSQL.

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
- [Divisão entre os seis integrantes](docs/equipe.md) e [backlog com critérios de aceite](docs/backlog.md).
- [Leitura dos materiais e divergências resolvidas](docs/leitura-do-projeto.md).
- [Arquitetura](docs/arquitetura.md), [contrato da API](docs/api.md) e [modelo de dados](docs/dados.md).
- [Imagens a definir](docs/imagens.md), [telas e design](docs/frontend.md), [roteiro de demonstração](docs/testes-e-demonstracao.md).
- [Índice completo](docs/README.md) e [fluxo de contribuição](CONTRIBUTING.md).

O repositório Git e o remoto `fabiolrocha/FreeLanceNow` já existiam no início da organização. O trabalho inicial está na branch `codex/bootstrap-freelancenow`. Os documentos originais foram realocados sem alterar seu conteúdo; hashes e caminhos estão no [inventário](docs/referencias/inventario.json).

Para parar os serviços sem perder dados: `docker compose down`. O volume `postgres_data` guarda os cadastros. Este ambiente é local e acadêmico; o roadmap descreve o trabalho necessário antes de um lançamento público.
