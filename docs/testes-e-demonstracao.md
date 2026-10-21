# Testes e roteiro de apresentação

Revisado em **21/10/2026**. Os comandos abaixo descrevem a cobertura existente. A seção de F04/F05 registra a execução atual; resultados de entregas anteriores permanecem identificados como históricos.

## Verificações da base

| Verificação | Comando | Cobertura |
|---|---|---|
| Preservação das fontes | `node scripts/verify-documents.mjs` (raiz) | Tamanho e SHA-256 dos 26 arquivos inventariados; não valida conteúdo dos Markdown |
| Higiene do diff | `git diff --check` (raiz) | Erros de whitespace e marcadores de conflito introduzidos no diff |
| Tipos/build React | `cd web && npm run build` | TypeScript e bundle de produção |
| Lint | `cd web && npm run lint` | Regras React/TypeScript |
| Regras unitárias | `cd web && npm test` | Permissões de transição, janela 7 dias e senha 72 bytes |
| Browser mock | `cd web && npm run test:e2e` | Contratação completa, contestação com decisão do admin, demanda/proposta/aceite, denúncia na fila com CSV, draft/publicação, mobile, role e sessão expirada |
| API+PostgreSQL | `docker compose --profile test run --rm api-test` | 31 testes: contexto+migrações (`V1`–`V7`), bootstrap administrativo, permissões, suspensão/reativação, categorias/auditoria, denúncias e remoção lógica/reputação, métricas por período e concorrência de perfil/resposta; também cadastro/login, termos, duplicidade com e-mail normalizado, admin, edição e perfil público sem contato, dono do anúncio, limite 20, filtros/paginação da busca (`minRating`), drafts/inativos ocultos, suspensão, ciclo de contratação (`UC03`/`UC06`), snapshots, jobs de 48h/5 dias, avaliações (`UC04`), média com 1 decimal, janela de 7 dias, resposta do profissional, demandas/propostas (`F08`, unicidade pendente e aceite gerando contratação) e seed idempotente |
| Browser API | `cd web && E2E_DATA_MODE=api npm run test:e2e` | Quatro fluxos completos quando `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` são fornecidos: (1) cadastro, perfil, anúncio persistente/reload, desativação e republicação; (2) ciclo completo de contratação entre duas contas, confirmação, avaliação 5 estrelas, resposta do profissional e persistência após reload; (3) demanda publicada, proposta única, aceite gerando contratação `ACEITO` no PostgreSQL e bloqueio de novas propostas em demanda encerrada; (4) admin gerencia categoria/usuário e decide denúncia com auditoria após reload |

Os testes de navegador selecionam a suíte correspondente ao modo; o outro conjunto aparece como `skipped` de propósito. O cenário administrativo em API também exige credenciais explícitas `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`; sem elas, somente esse teste é skipped com motivo. Não significa funcionalidade pulada dentro do fluxo testado. A suíte API usa banco `db-test` exclusivo e temporário. O teste browser API usa o banco de desenvolvimento e cria dados fictícios; não rodar contra um ambiente público.

## Revisão documental de 21/10/2026

Base: `main` em `7a6e769`; revisão na branch `codex/atualizar-documentacao`. Conferidos os links locais dos Markdown, as 50 rotas da matriz de frontend contra `App.tsx` (além do redirecionamento `/admin`) e os 29 endpoints de negócio contra os controllers. A revisão independente de leitura conferiu colaboração, fases, telas, moderação, variáveis e fontes históricas; a descrição da integração parcial de disputas foi corrigida conforme o código.

`node scripts/verify-documents.mjs` confirmou tamanho e SHA-256 dos 26 arquivos preservados. `git diff --check` passou. Estas verificações são documentais; as suítes Java, React e Playwright não foram executadas novamente nesta mudança.

## Evidências históricas de execução

Os parágrafos seguintes preservam os resultados registrados nas entregas anteriores. Nesta revisão de 21/10, o estado funcional foi conferido pela leitura do código, sem repetir essas suítes.

Verificação das fases **01, 02 e 03** em **17/10/2026** (branches `fase-01`, `fase-02` e `fase-03`): **22 testes Java**, **3 testes unitários web**, **7 testes de navegador mock** e **3 testes de navegador integrados à API** passaram. Build, lint (`oxlint` 0 avisos/erros) e os 26 hashes originais também passaram.

Verificação do marco de **07/10/2026** (branch `marco-1`): **16 testes Java**, **3 testes unitários web**, **7 testes de navegador mock** e **1 teste de navegador integrado à API** passaram. Build, lint, formatação e os 26 hashes também passaram. Um clone limpo subiu com `docker compose up -d --build` (web 200, `/actuator/health` UP), e o seed demo manteve 5 usuários e 8 anúncios após reiniciar a API. A navegação por perfil em 390 px seguiu sem erros de execução ou overflow horizontal.

Verificação executada em 30/09/2026 na máquina de origem: **9 testes Java**, **3 testes unitários web**, **4 testes de navegador mock** e **1 teste de navegador integrado à API** passaram. Build, lint sem avisos, formatação e verificação dos 26 hashes também passaram. A navegação por perfil foi percorrida em 390 px, sem erros de execução ou overflow horizontal. Essas evidências locais não substituem a revisão e o ensaio do grupo em outro computador.

## Ensaio mock (6–8 minutos)

1. Abra o modo mock e mostre o aviso acadêmico. Explore início, busca, categoria, detalhe e perfil.
2. Entre como **Cliente** no login. Solicite outro anúncio ainda sem pendência, por exemplo o serviço de troca de tomada; data futura e descrição.
3. Saia e entre como **Freelancer**, na mesma aba. Abra a contratação, aceite, inicie e marque como concluída.
4. Saia e entre como **Cliente**; confirme e avalie. Mostre que a avaliação não permite novo envio. Demonstre também uma disputa preexistente sem alterar este fluxo.
5. Entre como freelancer: crie rascunho, comprove que não aparece na busca, publique e desative.
6. Mostre demanda e proposta; mensagens e notificações como simulação. Não apresentar entrega externa ou troca real entre navegadores.
7. Entre como **Admin** mock, mostre usuários/categorias/relatórios/moderação; decida a disputa fictícia e exporte um CSV.
8. Abra uma tela financeira e explique os valores fictícios e o trabalho futuro. Finalize mostrando mobile e roadmap.

Dados de contratação e denúncia no modo mock são compartilhados entre contas **na mesma sessão da aba** para facilitar o ensaio. No modo API, contratações, avaliações, demandas e propostas ficam salvas no PostgreSQL.

## Ensaio API (4–6 minutos)

1. Reconstrua o frontend com `VITE_DATA_MODE=api` ou rode Vite nesse modo. Verifique `/actuator/health`.
2. Cadastre um freelancer fictício, aceite termos e complete perfil; mostre as categorias reais do banco.
3. Publique um anúncio, recarregue a página, saia e entre novamente. O anúncio continua salvo.
4. Cadastre um cliente fictício, busque o anúncio publicado e solicite o serviço com data futura.
5. Entre novamente como o freelancer, aceite a solicitação, inicie o serviço e marque como concluído com observações finais.
6. Entre como o cliente, confirme o recebimento, publique uma avaliação de 1 a 5 estrelas e mostre a nota média com 1 decimal no perfil do profissional. Entre como freelancer e responda à avaliação.
7. Publique uma demanda aberta como cliente, envie uma proposta como freelancer e aceite a proposta como cliente, demonstrando a geração imediata da contratação em estado `ACEITO`.

## Checklist de validação da equipe

- Executar todos os comandos aplicáveis em clone limpo e conferir CI.
- Percorrer cada grupo de rotas da matriz em [frontend](frontend.md) com o perfil apropriado, distinguindo API, simulação e texto estático.
- Inspecionar console, erros HTTP, estados vazios e tentativas de acesso indevido.
- Conferir layout de 390 px e desktop, teclado/foco, menu e validações.
- Registrar versão/commit, data, ambiente, comandos e falhas corrigidas no PR.
- Ter as contas fictícias e o roteiro prontos antes da apresentação.

A validação e a revisão podem ser feitas por qualquer integrante disponível, sem nome ou par fixo. Em mudanças apenas documentais, conferir links locais, consistência com código/configuração, preservação das fontes e higiene do diff; não relatar execução das suítes da aplicação sem rodá-las.

Limitações conhecidas: sem e-mail/chat remoto (`F07`), refresh token, upload/anexos (`F06`), gateway (`F09`) e teste de carga (`F10`). F04/F05 preservam relato/cópia textual, removem conteúdo de forma lógica e auditam decisões. Não há exclusão definitiva de usuários, operação de desfazer remoção ou credenciais ADMIN padrão. A auditoria é transacional no banco, sem endpoint de alteração/exclusão; controles operacionais/retenção de produção pertencem a F10. OAuth/2FA e auditoria completa de acessibilidade são evoluções sem entrega confirmada. As metas de SLA das fontes históricas ainda não foram medidas.

## Ensaio administrativo em modo API

1. Provisionar uma conta ADMIN de teste conforme o guia de desenvolvimento; desabilitar o bootstrap após a criação.
2. Entrar pelo login comum; criar/renomear/desativar uma categoria e recarregar para mostrar persistência.
3. Filtrar um usuário fictício, informar motivo, suspender e conferir o bloqueio de seu token; reativar preservando seus registros.
4. Como cliente, denunciar um anúncio ou avaliação com relato de 40–1000 caracteres. Como ADMIN, conferir o relato e a cópia do conteúdo, registrar justificativa e manter/remover.
5. Recarregar, conferir o resultado público e a auditoria. Para avaliação removida, conferir que sai das listas/notas sem permitir nova avaliação da mesma contratação.
6. Mediar uma disputa e consultar o evento correspondente na auditoria; mostrar métricas por período e exportar CSV de dados reais.

## Verificação F04/F05 — 21/10/2026

Branch `codex/fase-04-05-administracao-moderacao`, baseada em `717ee99`. Passaram 31 testes Java/PostgreSQL, 3 unitários web, 7 cenários browser mock e 4 cenários browser API (incluindo credenciais explícitas de admin). Build, lint e formatação foram conferidos. Os testes novos observaram falha antes da implementação; as regressões de concorrência confirmaram que editar perfil/responder avaliação não desfaz suspensão/remoção administrativa. A edição de anúncio preserva sua categoria atual mesmo desativada.

Os 26 originais mantêm tamanho e SHA-256; o contrato documenta 39 endpoints de negócio. Esta execução é local; resultados da CI do PR devem ser consultados separadamente.
