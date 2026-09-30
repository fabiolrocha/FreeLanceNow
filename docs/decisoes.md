# Decisões técnicas iniciais

Registradas em 30/09/2026. Mudanças devem atualizar este documento e os contratos afetados.

| ID | Decisão / motivo | Consequência |
|---|---|---|
| ADR01 | React web confirmado pelo líder | React Native/Expo fora do marco07/10 |
| ADR02 | Monorepo `web/`, `api/`, `docs/`; reutilizar Git existente | Um conjunto de PRs/CI; documentação original preservada |
| ADR03 | Vite + TypeScript para SPA; React Router para navegação | Frontend simples de executar e entregar; Nginx precisa de fallback de rotas |
| ADR04 | Uma aplicação React com admin mock | Não criar Vue ou aplicativo administrativo separado agora |
| ADR05 | Java 21, Maven Wrapper e Spring Boot 4.1.1 via Initializr | Usar documentação de Boot 4; material antigo Boot 3 fica como histórico |
| ADR06 | PostgreSQL 15 acompanha especificação existente | Flyway e teste real de banco; futuras atualizações precisam de validação |
| ADR07 | JWT HS25615min, bcrypt, perfis públicos sem contato | Autenticação local funcional; sem refresh, 2FA ou login social |
| ADR08 | Modo mock explícito e adapter HTTP no mesmo frontend | Grupo desenvolve telas sem backend; falha de API não vira mock silencioso |
| ADR09 | Financeiro/comunicação/contratação simulados no primeiro marco | Priorizar auth, banco e catálogo; demais integrações entram no backlog |
| ADR10 | Ícones/iniciais até decisão de imagens | Fotos do carômetro não reaproveitadas como usuários do produto |

## Proveniência do scaffold

API solicitada ao [Spring Initializr](https://start.spring.io/) como projeto Maven/Java 21, grupo `br.com.freelancenow`, artifact `api`, com Web, Security, OAuth2 Resource Server, Data JPA, Validation, Actuator, Flyway e PostgreSQL. O metadado inicial retornou `4.1.1.RELEASE`; o parent com esse sufixo não estava no Maven Central. O `pom.xml` foi normalizado para a coordenada publicada **4.1.1**, compilada e testada com sucesso. Nenhum projeto existente Java foi sobrescrito.

Frontend gerado por `create-vite` com template `react-ts`; dependências resolvidas estão em `web/package-lock.json`. O template trouxe Oxlint, mantido como lint. Public Sans, Lucide, React Router, Vitest e Playwright foram acrescentados. Assets e tela de exemplo do Vite não fazem parte do produto final.

Referências oficiais consultadas para implementar e verificar compatibilidade:

- [Requisitos do Spring Boot](https://docs.spring.io/spring-boot/system-requirements.html).
- [Spring Security e JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html).
- [Testes de aplicações Spring Boot](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html).
- [Vite — guia](https://vite.dev/guide/).
- [React Router — instalação declarativa](https://reactrouter.com/start/declarative/installation).
- [Vitest — configuração](https://vitest.dev/config/).
