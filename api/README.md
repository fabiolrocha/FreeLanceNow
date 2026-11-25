# API FreeLanceNow

API REST do FreeLanceNow. A aplicação web (`../web`) consome esta API. Em produção, a API está em
**https://freelancenow-api.onrender.com** (saúde: `/actuator/health`; endpoints: `/api/v1`).

## Instalação, configuração e execução

### Pré-requisitos

| Forma de execução | O que instalar |
|---|---|
| Com Docker (recomendada) | Git e Docker com Docker Compose v2 |
| Sem Docker | JDK **21** e PostgreSQL **15** (ou Docker só para o banco). O Maven não precisa ser instalado: o projeto traz o Maven Wrapper (`./mvnw`) |

As portas usadas no computador são `8081` (API) e `5435` (PostgreSQL). Se uma delas estiver ocupada, troque `API_PORT` ou `DB_PORT` no `.env` da raiz.

### Dependências

As dependências ficam no `pom.xml` e são baixadas automaticamente pelo Maven Wrapper no primeiro build:
Spring Boot 4.1 (Web MVC, Security com OAuth2 Resource Server para JWT, Data JPA, Validation, Actuator, Flyway), driver PostgreSQL, Stripe Java, Gson e os starters de teste do Spring Boot (JUnit). Não há instalação manual de bibliotecas.

### Variáveis de ambiente

O arquivo `.env.example`, na raiz do projeto, traz valores prontos para o ambiente local. Copie-o para `.env` antes de executar.

| Variável | Obrigatória | Valor local / padrão | Para que serve |
|---|---|---|---|
| `DB_URL` | Sim | `jdbc:postgresql://localhost:5435/freelancenow` | URL JDBC do PostgreSQL. No Docker Compose é fixada como `jdbc:postgresql://db:5432/freelancenow` |
| `DB_USERNAME` | Sim | `freelancenow` | Usuário do banco |
| `DB_PASSWORD` | Sim | `freelancenow-local` | Senha do banco |
| `JWT_SECRET` | Sim | `freelancenow-local-development-key-change-before-deploy-2026` | Chave dos tokens de login (mínimo 32 caracteres). Troque em qualquer publicação |
| `SPRING_PROFILES_ACTIVE` | Não | `dev` no Compose | `dev` para uso local; `prod` em produção (exige SSL no banco, `CORS_ORIGINS` e `PUBLIC_APP_URL`) |
| `PORT` | Não | `8081` | Porta HTTP da API |
| `SEED_DEMO` | Não | `true` no Compose, `false` fora dele | Cria contas e dados de demonstração em um banco vazio |
| `SEED_DEMO_PASSWORD` | Não | `Demo12345` (fora de `prod`) | Senha das contas de demonstração |
| `CORS_ORIGINS` | Em `prod` | `http://localhost:5173,http://127.0.0.1:5173,...` | Endereços da aplicação web que podem chamar a API, separados por vírgula |
| `PUBLIC_APP_URL` | Em `prod` | `http://127.0.0.1:5173` | Endereço da aplicação web usado nos links enviados por e-mail |
| `ADMIN_BOOTSTRAP_ENABLED` | Não | `false` | `true` cria o primeiro administrador na inicialização |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` / `ADMIN_BOOTSTRAP_NAME` | Se o item acima for `true` | vazio / vazio / `Administrador` | Dados do primeiro administrador (senha com 8+ caracteres, letras e números) |
| `STRIPE_SECRET_KEY` | Não | vazio | Chave de teste `sk_test_...` do Stripe. Vazia: contratações funcionam sem pagamento online. Chaves `sk_live_` são recusadas |
| `STRIPE_PUBLISHABLE_KEY` | Não | vazio | Chave publicável `pk_test_...` (cadastro da conta de recebimento do profissional) |
| `STRIPE_WEBHOOK_SECRET` / `STRIPE_CONNECT_WEBHOOK_SECRET` | Não | vazio | Segredos `whsec_...` dos webhooks do Stripe |
| `STRIPE_PAYMENT_METHODS` | Não | `CARD,PIX,BOLETO` | Formas de pagamento oferecidas |
| `PLATFORM_FEE_PERCENT` | Não | `10` | Comissão da plataforma, em % |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Não | vazio / `no-reply@freelancenow.test` | Envio de e-mail (recuperação de senha). Sem chave, o perfil `dev` escreve o e-mail no log |
| `JWT_REFRESH_TTL_SECONDS` | Não | `2592000` | Validade da sessão, em segundos (30 dias) |

### Executar com Docker (recomendado)

Na **raiz do projeto** (pasta acima de `api/`):

```sh
cp .env.example .env
docker compose up -d --build db api
```

O primeiro build baixa as dependências e pode levar alguns minutos. Quando terminar, confira:

```sh
curl http://localhost:8081/actuator/health
```

A resposta esperada é `{"status":"UP", ...}`. As tabelas são criadas automaticamente pelas migrações do Flyway na primeira inicialização.

Para subir também a aplicação web, use `docker compose up -d --build` (veja `../web/README.md`).

Para parar sem perder dados: `docker compose down`. Para apagar o banco e recomeçar: `docker compose down -v`.

### Executar sem Docker (JDK 21)

1. Inicie um PostgreSQL 15 com o banco `freelancenow`. O mais simples é usar só o banco do Compose, na raiz: `docker compose up -d db`.
2. Na pasta `api/`, exporte as variáveis e inicie a API:

```sh
cd api
export DB_URL='jdbc:postgresql://localhost:5435/freelancenow'
export DB_USERNAME='freelancenow'
export DB_PASSWORD='freelancenow-local'
export JWT_SECRET='freelancenow-local-development-key-change-before-deploy-2026'
export SPRING_PROFILES_ACTIVE='dev'
export SEED_DEMO='true'
./mvnw spring-boot:run
```

No Windows, use `mvnw.cmd spring-boot:run` e `set NOME=valor` (cmd) ou `$env:NOME='valor'` (PowerShell) no lugar de `export`.

O Spring não lê o `.env` da raiz quando iniciado pelo Maven; por isso as variáveis são exportadas no terminal.

Para gerar o pacote executável: `./mvnw package -DskipTests` cria `target/api-0.0.1-SNAPSHOT.jar`, executado com `java -jar target/api-0.0.1-SNAPSHOT.jar` e as mesmas variáveis.

### Contas para testar

Com `SEED_DEMO=true` em um banco novo, a API cria contas e dados de demonstração, todas as contas com a senha `Demo12345`:

| Perfil | E-mail |
|---|---|
| Cliente | `cliente@demo.freelancenow.test` |
| Freelancer | `freelancer@demo.freelancenow.test` |
| Administrador | `admin@demo.freelancenow.test` |

A lista completa e as contas da versão publicada estão em [contas de acesso](../docs/contas-de-acesso.md).

Fora dos dados de demonstração, o cadastro público não cria administradores. Para criar o primeiro, na raiz:

```sh
ADMIN_BOOTSTRAP_ENABLED=true \
ADMIN_BOOTSTRAP_EMAIL=admin@example.test \
ADMIN_BOOTSTRAP_PASSWORD=Admin12345 \
docker compose up -d --force-recreate api
```

Depois, entre com esse e-mail e senha. Volte `ADMIN_BOOTSTRAP_ENABLED` para `false` em seguida.

### Testes

Na raiz, em um banco de teste isolado (não usa o banco de desenvolvimento):

```sh
docker compose --profile test run --rm api-test
```

Com JDK 21, também é possível rodar `./mvnw test` dentro de `api/`, exportando `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` e `JWT_SECRET` de um banco PostgreSQL exclusivo para testes.

## Sobre a API

Java 21, Spring Boot 4.1, Spring Security com JWT, JPA/Hibernate e PostgreSQL 15 com migrações Flyway (`src/main/resources/db/migration`, V1–V18).

Módulos: autenticação e recuperação de senha, perfis, categorias e anúncios de serviço, contratações com prazos automáticos, avaliações, demandas e propostas, feed de publicações, avisos e chat por contratação, administração e moderação (usuários, categorias, denúncias, métricas e auditoria) e pagamentos com Stripe em modo de teste.

Perfis de acesso: **cliente**, **freelancer** e **administrador**. Cada endpoint verifica o perfil do usuário autenticado.

Documentação complementar:

- [Contrato dos endpoints](../docs/api.md)
- [Documento de Arquitetura](../docs/Documento%20de%20Arquitetura/Documento-de-Arquitetura.pdf) e [modelo de dados](../docs/DADOS/DADOS.pdf)
- [Contas de acesso](../docs/contas-de-acesso.md) e [publicação (Render, Neon, Stripe, Resend)](../docs/deploy.md)
