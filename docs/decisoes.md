# Decisões técnicas

Decisões iniciais registradas em 30/09/2026; revisão em **14/11/2026**. A tabela distingue escolhas, comportamento implementado e evolução planejada. Mudanças devem atualizar os contratos afetados.

| ID | Decisão / motivo | Consequência |
|---|---|---|
| ADR01 | React web confirmado pelo líder | React Native/Expo fora da entrega atual |
| ADR02 | Monorepo `web/`, `api/`, `docs/`; reutilizar Git existente | Um conjunto de PRs/CI; documentação original preservada |
| ADR03 | Vite + TypeScript para SPA; React Router para navegação | Frontend simples de executar e entregar; Nginx precisa de fallback de rotas |
| ADR04 | Uma aplicação React com administração por perfil, mock/API | F04/F05 usam as mesmas rotas; não criar um frontend administrativo separado |
| ADR05 | Java 21, Maven Wrapper e Spring Boot 4.1.1 via Initializr | Usar documentação de Boot 4; material antigo Boot 3 fica como histórico |
| ADR06 | PostgreSQL 15 acompanha especificação existente | Flyway e teste real de banco; futuras atualizações precisam de validação |
| ADR07 | JWT HS256 com validade de 15 min, bcrypt, perfis públicos sem contato | Autenticação local funcional; refresh token stateless de 30 dias revogado pela troca de senha (ADR22); sem 2FA ou login social |
| ADR08 | Modo mock explícito e adapter HTTP no mesmo frontend | Grupo desenvolve telas sem backend; falha de API não vira mock silencioso |
| ADR09 | Mock explícito no marco inicial; contratações/prazos, avaliações e demandas/propostas integrados nas fases seguintes | F01/F02/F03/F08 implementados; F04/F05 integram administração/moderação no PR #40; financeiro e comunicação continuam pendentes |
| ADR10 | Logo vetorial oficial SVG (`web/public/images/logo.svg`), ícones por categoria e avatares por iniciais | Identidade visual fechada sem depender de fotos do carômetro |
| ADR11 | Stripe Sandbox escolhido, com comissão planejada de 10% | Checkout, registros financeiros, webhooks, reembolso e conciliação ainda serão implementados em F09 |
| ADR12 | Neon PostgreSQL escolhido para ambiente remoto; PostgreSQL 15 no Compose local | Migrações atuais V1–V13; TLS `verify-full` validado com Postgres TLS local; roteiro de publicação em `deploy.md` (ADR26) |
| ADR13 | Resend escolhido como provedor transacional de e-mail | Recuperação de senha enviada pela API HTTP do Resend; verificação e avisos por e-mail ainda previstos em F07 |
| ADR14 | Organização por entrega, sem designação fixa de pessoas por caso, área, arquivo ou revisão (21/10) | Tabela de delegação retirada; backlog/roadmap sem nomes; revisão combinada por disponibilidade |
| ADR15 | Markdown atual como referência; originais/protótipo/roadmap HTML preservados como histórico | `equipe.md` passa a guia de colaboração; evitar apagar outras páginas sem confirmar uso e conferir referências |
| ADR16 | Bootstrap administrativo opt-in, sem senha padrão e sem promoção automática de conta existente | Cadastro público continua sem ADMIN; reinício não altera credenciais nem reativa conta |
| ADR17 | Denúncia guarda relato/cópia textual; remoção de serviço/avaliação é lógica e auditada | Preserva histórico, bloqueia republicação e retira nota removida da reputação; anexos ficam em F06, avisos em F07 |
| ADR18 | Auditoria transacional no mesmo banco, sem API de alteração/exclusão | Consulta limitada aos 200 eventos recentes; retenção/controles operacionais de produção ficam em F10 |
| ADR19 | Feed como entrada principal, com publicações profissionais e oportunidades, retomando o HTML (mudança de escopo 21/10) | F11 implementa feed misto após login em `/inicio`; `/painel` mantém gestão; composição e visibilidade aprovadas em 21/10 |
| ADR20 | Manter Java 21 como versão-alvo da API | POM, CI e imagens de build/runtime/teste usam Java 21; Spring Boot 4.1.1 e o Maven Wrapper permanecem sem alterações |
| ADR21 | Fotos dos anúncios guardadas no PostgreSQL (`bytea`), sem storage externo (14/11) | A hospedagem da API (Render, ADR26) tem disco efêmero; o volume previsto (5 × 5 MB por anúncio) cabe no banco e segue o mesmo backup. Migrar para object storage (ex.: S3/R2) exige só trocar a camada de leitura/gravação |
| ADR22 | Refresh e redefinição de senha com JWT stateless e impressão do hash da senha (14/11) | Sem tabela nem migração. Trocar a senha invalida refresh tokens e links antigos, e o link de redefinição só funciona uma vez. Access tokens já emitidos valem até 15 min; revogação imediata exigiria lista de bloqueio |
| ADR23 | Saída de contratação: cancelamento com motivo até o início; depois, só por disputa (14/11) | Cliente ou freelancer cancela `ACEITO` com motivo. `EM_ANDAMENTO` não é cancelável: qualquer parte abre disputa e o admin confirma a conclusão, devolve à execução ou cancela, sempre com justificativa. Ações irreversíveis na interface pedem confirmação |
| ADR24 | Exclusão de conta pelo titular anonimiza em vez de apagar; foto de perfil no PostgreSQL (14/11) | Contratações, avaliações e auditoria continuam íntegras para a outra parte. Nome vira "Conta excluída", e-mail vira endereço `.invalid` (o original fica livre para novo cadastro), telefone/bio/foto são apagados e a senha deixa de valer. Bloqueada com contratação em aberto; anúncios saem do ar, propostas e demandas abertas são encerradas. A foto (até 2 MB) segue o ADR21 |
| ADR25 | Confirmação de e-mail por link JWT stateless, sem bloquear o uso da conta (14/11) | O cadastro envia o link pelo Resend; o token (`email-verify`, 24 h) carrega o e-mail de destino. A conta funciona sem confirmar, com aviso e reenvio limitado a 1 por minuto: bloquear exigiria tratar e-mails que não chegam (spam, Resend sem domínio). Contas anteriores à V13 contam como confirmadas. Exigir confirmação para ações específicas fica como evolução |
| ADR26 | API no Render (Docker, plano free, Virginia), banco no Neon (`aws-us-east-1`), frontend na Vercel (14/11) | Render roda o Dockerfile existente sem mudanças e expõe `PORT`; mesma região AWS do Neon reduz latência API–banco. TLS `verify-full` valida o certificado do Neon pelo trust store da JVM (`DefaultJavaSSLFactory`), testado com Postgres TLS local. O plano free hiberna após 15 min sem tráfego: o primeiro acesso demora e a verificação de prazos só roda com a instância acordada, recuperando os vencidos ao acordar |
| ADR27 | Telas financeiras simuladas só no modo mock; no modo API, "Em breve" até F09 (14/11) | Produção não exibe saldos ou pagamentos fictícios como se fossem reais. Itens de carteira e transações saem do menu; as rotas mostram orientação por perfil. O mock mantém a demonstração completa |
| ADR28 | Avisos importantes também por e-mail, com opção de desligar (15/11) | Envio depois do commit e em segundo plano, só para contas ativas com e-mail confirmado. Mensagens de chat ficam só no app para não virar uma enxurrada de e-mails. Falha no Resend não desfaz a ação; o aviso interno continua sendo a fonte da verdade |
| ADR29 | Limite de tentativas nas rotas públicas de autenticação, em memória (15/11) | 20 POSTs por minuto e endereço em `/auth/**` no `prod`, 429 com `Retry-After`. Janela fixa na própria instância: suficiente para uma instância no Render; várias instâncias exigiriam armazenamento compartilhado (ex.: Redis). Desligado em dev e testes |
| ADR30 | Logs estruturados com id de requisição (15/11) | No `prod`, logs em JSON no formato ECS. `RequestLogFilter` registra método, caminho, status e duração de cada chamada em `/api/**`, sem query string nem corpo (podem ter dados pessoais), e propaga `X-Request-Id`. Métricas do Actuator continuam fechadas; só `health` e `info` são públicos |
| ADR31 | Serviços salvos como tabela de pares, sem entidade (15/11) | `favorite_service` guarda só ids e data; `FavoriteController` usa `JdbcTemplate`. Limite de 200 por conta. Só anúncios ativos aparecem; o vínculo continua se o anúncio voltar a ser publicado |

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
