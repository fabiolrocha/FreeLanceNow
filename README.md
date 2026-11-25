# FreeLanceNow

Marketplace de serviços gerais. Clientes encontram profissionais, solicitam serviços ou publicam demandas para receber propostas. Freelancers publicam serviços, respondem às solicitações e recebem pelo trabalho. O administrador modera conteúdo, decide disputas e acompanha métricas.

Projeto da disciplina Soluções Computacionais (2026/2), turma GPE17M80586. Integrantes, vídeo de apresentação e documentos da entrega: [docs/README.md](docs/README.md).

| Aplicação | Pasta | Publicação | Instruções |
|---|---|---|---|
| Aplicação web (computador e celular) | `web/` | https://freelancenow.vercel.app | [web/README.md](web/README.md) |
| API REST | `api/` | https://freelancenow-api.onrender.com | [api/README.md](api/README.md) |

## Acesso para avaliação

A versão publicada já tem dados de demonstração. Entre em https://freelancenow.vercel.app/login com uma destas contas:

| Perfil | E-mail | Senha |
|---|---|---|
| Cliente | `cliente@demo.freelancenow.test` | `Avaliacao2026` |
| Freelancer | `freelancer@demo.freelancenow.test` | `Avaliacao2026` |
| Administrador | `admin@demo.freelancenow.test` | `Avaliacao2026` |

A API fica no plano gratuito do Render e hiberna sem uso. O primeiro acesso pode levar até 1 minuto. Os pagamentos usam o modo de teste do Stripe (cartão `4242 4242 4242 4242`, qualquer validade futura e qualquer CVC) e nunca cobram dinheiro real. Mais contas e o que explorar com cada uma: [docs/contas-de-acesso.md](docs/contas-de-acesso.md).

## Executar localmente com Docker

Pré-requisitos: Git e Docker com Docker Compose v2. Nenhuma outra instalação é necessária.

1. Na raiz do projeto, crie o arquivo de configuração local:

   ```sh
   cp .env.example .env
   ```

2. Construa e suba o banco, a API e a aplicação web:

   ```sh
   docker compose up -d --build
   ```

3. Espere de 1 a 3 minutos e abra http://localhost:5173.

4. Entre com `cliente@demo.freelancenow.test`, `freelancer@demo.freelancenow.test` ou `admin@demo.freelancenow.test`. Localmente, a senha de todas as contas é `Demo12345`.

Na primeira subida, a API cria o banco com as migrações do Flyway (V1 a V18, em `api/src/main/resources/db/migration`) e carrega os dados de demonstração. Nas próximas subidas, ela só aplica migrações novas e não duplica dados.

| Serviço | Endereço | Conteúdo |
|---|---|---|
| `web` | http://localhost:5173 | Aplicação web React, servida pelo Nginx no modo API |
| `api` | http://localhost:8081/actuator/health | API Spring Boot (endpoints em `/api/v1`) |
| `db` | `localhost:5435` | PostgreSQL 15, banco `freelancenow`, com volume persistente |

Comandos úteis:

| Comando | O que faz |
|---|---|
| `docker compose ps` | Mostra os serviços e a situação de cada um |
| `docker compose logs -f api` | Mostra o log da API (migrações e dados de demonstração) |
| `docker compose down` | Para os serviços e mantém os dados |
| `docker compose down -v` | Para os serviços e apaga o banco. Na próxima subida, migrações e dados de demonstração rodam outra vez |

Se a porta 5173, 8081 ou 5435 estiver ocupada, troque `WEB_PORT`, `API_PORT` ou `DB_PORT` no `.env`. Pagamentos reais com o Stripe e envio de e-mail são opcionais e ficam desligados sem as chaves no `.env`. Execução sem Docker e todas as variáveis: [api/README.md](api/README.md) e [web/README.md](web/README.md).

## Testes

Testes da API, com um PostgreSQL de teste separado:

```sh
docker compose --profile test run --rm api-test
```

Testes da aplicação web (requer Node 22.12 ou mais novo):

```sh
cd web
npm ci
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

A CI do GitHub executa essas verificações em cada pull request. Roteiro de demonstração e resultados: [docs/testes-e-demonstracao.md](docs/testes-e-demonstracao.md).

## Estrutura

```text
api/          API em Java 21 e Spring Boot 4.1 (Security, JPA, Flyway, Stripe)
web/          Aplicação web em React 19, TypeScript e Vite
docs/         Documentos da entrega, modelos editáveis, originais e guias técnicos
loadtest/     Roteiro de teste de carga com k6
scripts/      Geração das imagens de demonstração
.github/      CI e modelos de issue e pull request
compose.yml   Banco, API e web para execução local
render.yaml   Configuração da API no Render
```

## Tecnologias e serviços

- **Web:** React, TypeScript, Vite e React Router, publicada na Vercel.
- **API:** Java 21, Spring Boot, Spring Security com JWT, JPA e Flyway, publicada no Render em Docker.
- **Banco:** PostgreSQL (Neon em produção).
- **Integrações:** Stripe em modo de teste para pagamentos com custódia e Resend para e-mails.

Publicação e variáveis de produção: [docs/deploy.md](docs/deploy.md). Fluxo de contribuição: [CONTRIBUTING.md](CONTRIBUTING.md).
