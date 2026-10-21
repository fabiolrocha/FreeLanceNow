# Arquitetura dos sistemas

Revisado em **21/10/2026**. Monorepositório com dois aplicativos e um banco. A aplicação web é uma SPA React; o backend é um monólito Spring Boot modularizado por domínio. Uma única API atende clientes e freelancers. F04/F05 acrescentam os módulos `admin` e `moderation`, com provisionamento explícito de ADMIN, gestão persistente, denúncias e auditoria transacional.

```mermaid
flowchart LR
  Pessoa[Cliente / Freelancer / Admin demo] --> Web[React + TypeScript + React Router]
  Web -->|modo mock| Mock[Fixtures e sessionStorage]
  Web -->|modo api: HTTP JSON| Proxy[Vite em dev / Nginx no Docker]
  Proxy --> API[Spring Boot 4.1.1 / Java 21]
  API --> Security[Spring Security / JWT / bcrypt]
  API --> Modulos[auth / users / catalog / contracts / reviews / demands / admin / moderation / feed]
  Modulos --> JPA[JPA / transações]
  Modulos --> JDBC[JDBC / feed paginado]
  JDBC --> DB
  JPA --> DB[(PostgreSQL 15 local)]
  Flyway[Flyway V1 a V8] --> DB
```

| Camada | Local | Responsabilidade |
|---|---|---|
| Rotas e shell | `web/src/App.tsx`, `web/src/app/` | Layout, sessão, navegação e guards |
| Features | `web/src/features/` | Formulários e fluxos por área |
| Dados web | `web/src/data/{client,admin,feed}.ts` | Seleção explícita mock/API e chamadas HTTP |
| Domínio web | `web/src/domain/` | Tipos e regras testáveis do fluxo simulado |
| Controllers/DTOs | `api/.../{auth,users,catalog,contracts,reviews,demands,admin,moderation,feed}` | HTTP, validação, representação pública/privada |
| Services | Mesmos módulos | Regras de negócio, prazos agendados (`@Scheduled`) e fronteiras transacionais |
| Repositories/entidades | Mesmos módulos | Persistência, busca, locks pessimistas e vínculos |
| Config/common | `api/.../{config,common}` | Segurança, `Clock` injetável, CORS, seed e Problem Details |
| Banco | `api/src/main/resources/db/migration/` | Esquema evolutivo versionado (`V1` a `V8`) |

JWT HS256 é emitido pelo próprio backend com issuer validado, expiração de 900s e segredo configurado por ambiente com pelo menos 32 bytes. Os endpoints de perfil privado, gestão de anúncios, contratações, avaliações e demandas/propostas verificam também que a conta existe e está ativa. O frontend guarda a sessão em `sessionStorage`, conserva a expiração absoluta após reload e elimina a sessão ao expirar. Uma fase futura deve avaliar cookies HttpOnly/CSRF ou outra política de sessão adequada à implantação pública.

Os dados privados aparecem em `/users/me`; os perfis de catálogo são DTOs sem contatos, enriquecidos com `averageRating` (1 casa decimal) e `reviewCount`. Não se serializam entidades JPA diretamente. O serviço de catálogo usa lock no usuário para evitar que duas publicações simultâneas ultrapassem o limite de anúncios ativos, e os serviços de contratações e demandas usam lock pessimista e índices únicos parciais para impedir solicitações ou propostas pendentes duplicadas.

Flyway controla o esquema e JPA executa `validate`; não usar `ddl-auto=update`. Categorias fazem parte das migrações. Usuários/anúncios fictícios são seed de desenvolvimento separado, desativado por padrão fora do Compose local.

## Ambiente local

| Serviço | Porta no host | Porta interna | Observação |
|---|---|---|---|
| Web | 5173 | 80 no Nginx | SPA fallback e proxy `/api` |
| API | 8081 | 8081 | Health em `/actuator/health` |
| PostgreSQL | 5435 | 5432 | Volume nomeado `postgres_data` |
| Banco de teste | Não publicado | 5432 | Isolado, armazenamento temporário |
| Vite dos testes | 5174 | 5174 | Servidor automático do Playwright |

Compose publica as portas em `127.0.0.1`. Não é uma infraestrutura de produção. Credenciais da `.env.example` são deliberadamente locais; produção requer configuração própria, TLS, migração controlada, backup/restauração e observabilidade.

## Sistemas e provedores definidos

| Sistema | Estado atual | Provedor / Próximo passo |
|---|---|---|
| Contratação/reputação (`F01`/`F02`/`F03`) | Implementado na API e no React (`contract`, `contract_event`, `review`, jobs 48h/5d) | Moderação e auditoria integradas nesta entrega F04/F05 |
| Administração/auditoria (`F04`/`F05`) | Implementadas: bootstrap opt-in, usuários/categorias, denúncias, remoção lógica, métricas e auditoria | E-mail em F07 e anexos em F06; manter verificação de autorização e regressão |
| Demandas/propostas (`F08`) | Implementado na API e no React (`demand`, `proposal`, aceite gerando `contract` em `ACEITO`) | — |
| Mensagens/notificações e e-mail (`F07`) | Provedor definido (**Resend**) | Implementar envio transacional e persistência de mensagens/avisos |
| Arquivos e catálogo (`F06`) | Upload ausente; busca da API paginada; marca SVG estática disponível | Definir storage, validar até 5 imagens/5 MB e paginar busca no React |
| Financeiro e banco externo (`F09`/`F10`) | Provedores escolhidos (**Stripe Sandbox** e **Neon PostgreSQL**); Compose usa banco local | Implementar checkout sandbox, webhooks e ledger; configurar e validar ambiente remoto |

As propriedades de Stripe/Resend em `application.yml` ainda não são consumidas por fluxos de pagamento ou e-mail. O Compose atual não repassa essas credenciais nem usa `DB_URL` da raiz para trocar seu banco interno. Consulte as variáveis e limites do ambiente em [desenvolvimento](desenvolvimento.md).
