# Decisões técnicas

Decisões iniciais registradas em 30/09/2026; revisão em **21/10/2026**. A tabela distingue escolhas, comportamento implementado e evolução planejada. Mudanças devem atualizar os contratos afetados.

| ID | Decisão / motivo | Consequência |
|---|---|---|
| ADR01 | React web confirmado pelo líder | React Native/Expo fora da entrega atual |
| ADR02 | Monorepo `web/`, `api/`, `docs/`; reutilizar Git existente | Um conjunto de PRs/CI; documentação original preservada |
| ADR03 | Vite + TypeScript para SPA; React Router para navegação | Frontend simples de executar e entregar; Nginx precisa de fallback de rotas |
| ADR04 | Uma aplicação React com admin mock | Não criar Vue ou aplicativo administrativo separado agora |
| ADR05 | Java 21, Maven Wrapper e Spring Boot 4.1.1 via Initializr | Usar documentação de Boot 4; material antigo Boot 3 fica como histórico |
| ADR06 | PostgreSQL 15 acompanha especificação existente | Flyway e teste real de banco; futuras atualizações precisam de validação |
| ADR07 | JWT HS256 com validade de 15 min, bcrypt, perfis públicos sem contato | Autenticação local funcional; sem refresh, 2FA ou login social |
| ADR08 | Modo mock explícito e adapter HTTP no mesmo frontend | Grupo desenvolve telas sem backend; falha de API não vira mock silencioso |
| ADR09 | Mock explícito no marco inicial; contratações/prazos, avaliações e demandas/propostas integrados nas fases seguintes | F01/F02/F03/F08 implementados; financeiro, comunicação e gestão administrativa continuam pendentes/parciais |
| ADR10 | Logo vetorial oficial SVG (`web/public/images/logo.svg`), ícones por categoria e avatares por iniciais | Identidade visual fechada sem depender de fotos do carômetro |
| ADR11 | Stripe Sandbox escolhido, com comissão planejada de 10% | Checkout, registros financeiros, webhooks, reembolso e conciliação ainda serão implementados em F09 |
| ADR12 | Neon PostgreSQL escolhido para ambiente remoto; PostgreSQL 15 no Compose local | Migrações atuais V1–V5; implantação e compatibilidade remota precisam de validação |
| ADR13 | Resend escolhido como provedor transacional de e-mail | Recuperação, verificação e avisos previstos em F07; parâmetros declarados, sem envio implementado |
| ADR14 | Organização por entrega, sem designação fixa de pessoas por caso, área, arquivo ou revisão (21/10) | Tabela de delegação retirada; backlog/roadmap sem nomes; revisão combinada por disponibilidade |
| ADR15 | Markdown atual como referência; originais/protótipo/roadmap HTML preservados como histórico | `equipe.md` passa a guia de colaboração; evitar apagar outras páginas sem confirmar uso e conferir referências |

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
