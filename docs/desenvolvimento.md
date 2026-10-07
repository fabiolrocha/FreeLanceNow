# Desenvolvimento e colaboração

O [README](../README.md) cobre o início rápido. O Compose fornece Java/Maven em container, evitando necessidade de instalar JDK no host. Na máquina de origem não havia JDK configurado; a compilação e os testes Java foram feitos pelo Docker.

## Clone e primeira execução

```sh
git clone https://github.com/fabiolrocha/FreeLanceNow.git
cd FreeLanceNow
git switch codex/bootstrap-freelancenow
cp .env.example .env
docker compose up -d --build
```

Depois de integrar a base na branch principal, novos integrantes usam `main` como ponto de partida. A branch de bootstrap permite revisar as mudanças e os movimentos dos documentos antes da integração.

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
| DB_URL | API | URL JDBC; Docker usa hostname `db` |
| DB_USERNAME / DB_PASSWORD | API/banco | Acesso PostgreSQL |
| JWT_SECRET | API | Chave HS256 com pelo menos 32 bytes |
| PORT / API_PORT | API / Compose | Porta interna 8081 / publicação |
| DB_PORT / WEB_PORT | Compose | Portas host 5435 / 5173 |
| SPRING_PROFILES_ACTIVE / SEED_DEMO | API | Seed somente no perfil dev habilitado |
| CORS_ORIGINS | API | Origens permitidas, separadas por vírgula |
| VITE_DATA_MODE | Web build/dev | `mock` ou `api` |
| VITE_API_BASE_URL | Web build/dev | Padrão `/api/v1`; somente valor público |
| API_PROXY_TARGET | Vite | Destino de `/api` e `/actuator` em dev |
| E2E_DATA_MODE | Testes web | `api` seleciona teste com backend real |

As credenciais de exemplo são públicas e locais. `.env`/`.env.local` são ignorados por Git. Não usar `VITE_*` para segredos.

## Git

O repositório já tinha histórico e remoto. A organização preservou esses elementos e abriu `codex/bootstrap-freelancenow`. Consulte [CONTRIBUTING](../CONTRIBUTING.md) para branches, revisões e arquivos compartilhados.

Fluxo sugerido: atualizar a base, abrir branch por card (`codex/a01-auth`, por exemplo), fazer commits pequenos, rodar testes relevantes, abrir PR com ID/aceite/evidência e pedir revisão ao par. O líder integra PRs aprovados. Não há branch protection configurada automaticamente.

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
