# Desenvolvimento e colaboração

Revisado em **21/10/2026**. O [README](../README.md) cobre o início rápido. O Compose fornece Java/Maven em container; o desenvolvimento fora dele requer JDK 21 e, para o web, Node 22.12+ e npm. Use as versões resolvidas nos arquivos de dependências do repositório.

## Clone e primeira execução

```sh
git clone https://github.com/fabiolrocha/FreeLanceNow.git
cd FreeLanceNow
cp .env.example .env
docker compose up -d --build
```

Use a `main` atualizada como ponto de partida. Ela já contém o marco inicial e F01/F02/F03/F08. Branches antigas de fase não são a base padrão de novas contribuições.

## Java fora do Docker

Com JDK21 e banco local ligado:

```sh
docker compose up -d db
cd api
export DB_URL='jdbc:postgresql://localhost:5435/freelancenow'
export DB_USERNAME='freelancenow'
export DB_PASSWORD='freelancenow-local'
export JWT_SECRET='freelancenow-local-development-key-change-before-deploy-2026'
export SPRING_PROFILES_ACTIVE='dev'
export SEED_DEMO='true'
./mvnw spring-boot:run
```

O Spring não carrega `.env` da raiz automaticamente quando iniciado por Maven. Compose injeta as variáveis. Para testar via Maven local, use outro banco PostgreSQL exclusivo e aponte `DB_URL`; não rodar a suíte no banco de desenvolvimento.

## Variáveis

| Variável | Aplicação | Finalidade |
|---|---|---|
| DB_URL | API fora do Compose | URL JDBC; Compose fixa `jdbc:postgresql://db:5432/freelancenow`; Neon é opção remota planejada |
| DB_USERNAME / DB_PASSWORD | API/banco | Acesso PostgreSQL |
| JWT_SECRET | API | Chave HS256 com pelo menos 32 bytes |
| PORT / API_PORT | API / Compose | Porta interna 8081 / publicação |
| DB_PORT / WEB_PORT | Compose | Portas host 5435 / 5173 |
| SPRING_PROFILES_ACTIVE / SEED_DEMO | API | Seed somente no perfil dev habilitado |
| CORS_ORIGINS | API | Origens permitidas, separadas por vírgula |
| CONTRACT_DEADLINE_CHECK_MS | API | Intervalo do job de prazos, lido em `app.contracts.deadline-check-ms` (padrão `60000` ms) |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET | API (reservadas) | Propriedades declaradas; checkout/webhooks ainda não implementados (`F09`) |
| PLATFORM_FEE_PERCENT | API (reservada) | Propriedade de comissão planejada, padrão `10`; não aplicada a pagamentos atuais |
| RESEND_API_KEY / RESEND_FROM_EMAIL | API (reservadas) | Propriedades declaradas; envio ainda não implementado (`F07`) |
| VITE_DATA_MODE | Web build/dev | `mock` ou `api` |
| VITE_API_BASE_URL | Web build/dev | Padrão `/api/v1`; somente valor público |
| API_PROXY_TARGET | Vite | Destino de `/api` e `/actuator` em dev |
| E2E_DATA_MODE | Testes web | `api` seleciona teste com backend real |

A tabela distingue variáveis consumidas pela aplicação das propriedades reservadas para integrações futuras. `VITE_STRIPE_PUBLIC_KEY` não é consumida pelo frontend atual. O Compose só injeta as variáveis declaradas em `compose.yml`: alterar `DB_URL` na `.env` da raiz não troca seu banco interno, e as credenciais Stripe/Resend, CORS e intervalo do job não são repassadas por ele atualmente. Uma futura implantação precisa configurar esse repasse e validar as integrações.

As credenciais de exemplo são públicas e locais. `.env`/`.env.local` são ignorados por Git. Não usar `VITE_*` para segredos.

## Git

O repositório já tem histórico e remoto. Atualize `main` com `git pull --ff-only origin main`, abra uma branch descritiva (`codex/f04-administracao`, por exemplo), faça commits pequenos e abra PR com aceite, evidência e limitações. A revisão é combinada com outro integrante disponível, sem pares ou áreas exclusivos. Consulte [CONTRIBUTING](../CONTRIBUTING.md) e [colaboração](equipe.md). Não há branch protection configurada automaticamente.

## Problemas comuns

| Sintoma | Verificação |
|---|---|
| Porta ocupada | `docker compose ps`; ajuste `WEB_PORT`, `API_PORT`, `DB_PORT` no `.env` e os destinos correspondentes |
| Web não mudou de modo | Reconstrua `web` no Docker ou reinicie Vite; variável é lida no build/dev |
| API indisponível | `docker compose logs api db`; confira health, JWT_SECRET e DB_URL |
| PostgreSQL rejeita senha após mudar `.env` | Volume existente conserva credenciais originais; alinhe a configuração ou crie outro ambiente/banco |
| Token expirou | Faça login novamente; expiração 15 min e sem refresh |
| Fixtures ficaram alteradas | Limpe `sessionStorage` da aba para reiniciar somente os dados mock |
| Java local não funciona | Use Compose; ou configure JDK21 e execute `./mvnw -v` |

`docker compose down` preserva o volume. A remoção de volumes apaga os cadastros; nunca inclua essa ação em instruções de rotina de atualização.
