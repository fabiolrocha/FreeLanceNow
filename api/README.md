# API FreeLanceNow

Java 21 / Spring Boot 4.1.1 / Maven Wrapper / PostgreSQL 15. Revisado em **21/10/2026**. A API contém autenticação, perfis, catálogo, contratações, jobs de prazo, avaliações e demandas/propostas, com migrações V1–V5. Administração/moderação completa, upload, comunicação e financeiro permanecem pendentes/parciais; parâmetros de provedores não significam integração entregue.

Na raiz, `docker compose up -d --build db api` sobe o ambiente sem JDK no host. `docker compose --profile test run --rm api-test` executa os testes em banco isolado.

- [Contrato dos endpoints](../docs/api.md).
- [Arquitetura](../docs/arquitetura.md) e [banco/migrações](../docs/dados.md).
- [Variáveis e execução com JDK local](../docs/desenvolvimento.md).
- [Colaboração sem papéis fixos](../docs/equipe.md) e [backlog](../docs/backlog.md).
