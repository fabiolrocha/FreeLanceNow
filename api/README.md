# API FreeLanceNow

Java 21 / Spring Boot 4.1.1 / Maven Wrapper / PostgreSQL 15. A API foi gerada pelo Spring Initializr e complementada com autenticação, perfis, catálogo e migrações.

Na raiz, `docker compose up -d --build db api` sobe o ambiente sem JDK no host. `docker compose --profile test run --rm api-test` executa os testes em banco isolado.

- [Contrato dos endpoints](../docs/api.md).
- [Arquitetura](../docs/arquitetura.md) e [banco/migrações](../docs/dados.md).
- [Variáveis e execução com JDK local](../docs/desenvolvimento.md).
- [Responsáveis e backlog](../docs/equipe.md).
