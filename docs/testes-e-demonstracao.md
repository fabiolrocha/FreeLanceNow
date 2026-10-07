# Testes e roteiro de apresentação

## Verificações da base

| Verificação | Comando | Cobertura |
|---|---|---|
| Tipos/build React | `cd web && npm run build` | TypeScript e bundle de produção |
| Lint | `cd web && npm run lint` | Regras React/TypeScript |
| Regras unitárias | `cd web && npm test` | Permissões de transição, janela 7 dias e senha 72 bytes |
| Browser mock | `cd web && npm run test:e2e` | Contratação completa, contestação com decisão do admin, demanda/proposta/aceite, denúncia na fila com CSV, draft/publicação, mobile, role e sessão expirada |
| API+PostgreSQL | `docker compose --profile test run --rm api-test` | Dezesseis testes: contexto+migrações, cadastro/login, termos, duplicidade com e-mail normalizado, admin, edição e perfil público sem contato, dono do anúncio, limite 20, filtros/paginação da busca, drafts/inativos ocultos, suspensão e seed idempotente |
| Browser API | `cd web && E2E_DATA_MODE=api npm run test:e2e` | Cadastro, perfil, anúncio persistente/reload, desativação, login e republicação |

Os testes de navegador selecionam a suíte correspondente ao modo; o outro conjunto aparece como `skipped` de propósito. Não significa funcionalidade pulada dentro do fluxo testado. A suíte API usa banco `db-test` exclusivo e temporário. O teste browser API usa o banco de desenvolvimento e cria dados fictícios; não rodar contra um ambiente público.

## Ensaio mock (6–8 minutos)

Verificação do marco de **07/10/2026** (branch `marco-1`): **16 testes Java**, **3 testes unitários web**, **7 testes de navegador mock** e **1 teste de navegador integrado à API** passaram. Build, lint, formatação e os 26 hashes também passaram. Um clone limpo subiu com `docker compose up -d --build` (web 200, `/actuator/health` UP), e o seed demo manteve 5 usuários e 8 anúncios após reiniciar a API. A navegação por perfil em 390 px seguiu sem erros de execução ou overflow horizontal.

Verificação executada em 30/09/2026 na máquina de origem: **9 testes Java**, **3 testes unitários web**, **4 testes de navegador mock** e **1 teste de navegador integrado à API** passaram. Build, lint sem avisos, formatação e verificação dos 26 hashes também passaram. A navegação por perfil foi percorrida em 390 px, sem erros de execução ou overflow horizontal. Essas evidências locais não substituem a revisão e o ensaio do grupo em outro computador.

1. Abra o modo mock e mostre o aviso acadêmico. Explore início, busca, categoria, detalhe e perfil.
2. Entre como **Cliente** no login. Solicite outro anúncio ainda sem pendência, por exemplo o serviço de troca de tomada; data futura e descrição.
3. Saia e entre como **Freelancer**, na mesma aba. Abra a contratação, aceite, inicie e marque como concluída.
4. Saia e entre como **Cliente**; confirme e avalie. Mostre que a avaliação não permite novo envio. Demonstre também uma disputa preexistente sem alterar este fluxo.
5. Entre como freelancer: crie rascunho, comprove que não aparece na busca, publique e desative.
6. Mostre demanda e proposta; mensagens e notificações como simulação. Não apresentar entrega externa ou troca real entre navegadores.
7. Entre como **Admin** mock, mostre usuários/categorias/relatórios/moderação; decida a disputa fictícia e exporte um CSV.
8. Abra uma tela financeira e explique os valores fictícios e o trabalho futuro. Finalize mostrando mobile e roadmap.

Dados de contratação e denúncia são compartilhados entre contas **na mesma sessão da aba** para facilitar o ensaio. Duas abas independentes não representam dois usuários sincronizados por servidor.

## Ensaio API (3–5 minutos)

1. Reconstrua o frontend com `VITE_DATA_MODE=api` ou rode Vite nesse modo. Verifique `/actuator/health`.
2. Cadastre um freelancer fictício, aceite termos e complete perfil; mostre as categorias reais do banco.
3. Publique um anúncio, recarregue a página, saia e entre novamente. O anúncio continua salvo.
4. Desative o anúncio e confirme que some da busca pública; publique novamente.
5. Mostre os testes de autorização e a estrutura das migrações. Explique que o banco contém usuário/categoria/anúncio; contratação e financeiro continuam mocks.

## Checklist do gestor/QA

- Executar todos os comandos aplicáveis em clone limpo e conferir CI.
- Percorrer cada grupo de rotas da matriz em `frontend.md` com ator apropriado.
- Inspecionar console, erros HTTP, estados vazios e tentativas de acesso indevido.
- Conferir layout de 390 px e desktop, teclado/foco, menu e validações.
- Registrar versão/commit, data, ambiente, comandos e falhas corrigidas no PR.
- Ter as contas fictícias e o roteiro prontos antes da apresentação.

Limitações conhecidas: sem OAuth/2FA/e-mail real, refresh token, uploads, administração real, contratação persistente, jobs 48h/5 dias, chat remoto, gateway, teste de carga ou certificação de acessibilidade. As metas de SLA dos documentos ainda não foram medidas.
