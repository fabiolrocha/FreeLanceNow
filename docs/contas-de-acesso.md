# Contas de acesso

Contas fictícias para avaliar o FreeLanceNow. Todos os e-mails usam o domínio `demo.freelancenow.test`, que não recebe mensagens. Nenhuma conta pertence a uma pessoa real.

## Versão publicada (avaliação)

Abra https://freelancenow.vercel.app/login. A API fica no plano gratuito do Render e hiberna sem uso, então o primeiro acesso pode levar até 1 minuto. Se o login demorar, aguarde e tente de novo.

| Perfil | E-mail | Senha | O que explorar |
|---|---|---|---|
| Cliente | `cliente@demo.freelancenow.test` | `Avaliacao2026` | Feed, busca, contratações em todas as etapas, chat, pagamento, avaliações, demandas com propostas, favoritos e avisos |
| Freelancer | `freelancer@demo.freelancenow.test` | `Avaliacao2026` | Painel, serviços publicados, solicitações recebidas, propostas, carteira, saque simulado, avaliações e posts no feed |
| Administrador | `admin@demo.freelancenow.test` | `Avaliacao2026` | Usuários, categorias, denúncias pendentes, disputas, métricas, transações e auditoria |

A conta de cliente (Beatriz Almeida) tem uma contratação em cada etapa: pendente, aceita aguardando pagamento, em andamento com chat, aguardando confirmação, em disputa, concluída, recusada e cancelada. A conta de freelancer (Tiago Ferreira) tem quatro serviços, solicitações para responder, uma contratação em andamento, avaliações recebidas e saldo na carteira. O administrador encontra denúncias pendentes e uma disputa para decidir.

Os pagamentos rodam em modo de teste do Stripe e nunca cobram dinheiro real. Para testar um pagamento, use o cartão `4242 4242 4242 4242`, qualquer validade futura e qualquer CVC.

Outras contas com a mesma senha, para ver o outro lado de uma conversa ou contratação:

| Perfil | Contas |
|---|---|
| Clientes | `carlos@`, `helena@`, `roberto@` |
| Freelancers | `renata@`, `diego@`, `fernanda@`, `gustavo@`, `leandro@` |

## Execução local (Docker)

Com `docker compose up -d --build` (veja o [README da raiz](../README.md)), a API cria o banco pelas migrações e carrega os mesmos dados de demonstração. Abra http://localhost:5173/login.

| Perfil | E-mail | Senha |
|---|---|---|
| Cliente | `cliente@demo.freelancenow.test` | `Demo12345` |
| Freelancer | `freelancer@demo.freelancenow.test` | `Demo12345` |
| Administrador | `admin@demo.freelancenow.test` | `Demo12345` |

Localmente, todas as contas de demonstração usam a senha `Demo12345`:

| Perfil | Contas |
|---|---|
| Clientes | `cliente@`, `ana@`, `pedro@`, `lucia@`, `carlos@`, `helena@`, `roberto@` |
| Freelancers | `freelancer@`, `marcos@`, `juliana@`, `rafael@`, `camila@`, `bruno@`, `renata@`, `diego@`, `fernanda@`, `gustavo@`, `leandro@` |
| Administrador | `admin@` |

Para recomeçar do zero, apague o volume do banco com `docker compose down -v` e suba de novo. As migrações e os dados de demonstração rodam outra vez.

## Como os dados são criados

- `DemoData` cria as primeiras contas, serviços, contratações e avaliações.
- `DemoShowcase` cria as contas de avaliação, as atividades em todas as etapas e as imagens dos serviços.
- Os dois só rodam com `SEED_DEMO=true`. A senha vem de `SEED_DEMO_PASSWORD`: localmente o padrão é `Demo12345`; em produção não há padrão e a senha não fica no repositório.
- As duas rotinas são idempotentes. Reiniciar a API não duplica dados.

O cadastro público não permite criar administradores. Fora dos dados de demonstração, o primeiro administrador é criado pelo bootstrap explícito (`ADMIN_BOOTSTRAP_ENABLED`, `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD`), descrito no [README da API](../api/README.md).

## Modo mock (sem API)

Com `VITE_DATA_MODE=mock`, a aplicação web roda só no navegador, sem API. Use os botões Cliente, Freelancer e Admin da tela de login, ou `ana@`, `marcos@` e `admin@demo.freelancenow.test` com a senha `Demo12345`. Os dados ficam na sessão do navegador.

## Dicas

- Use **Sair da conta** e entre com outro e-mail para trocar de perfil. No celular, a saída fica no menu da conta.
- **Esqueci minha senha** funciona no modo API. Sem `RESEND_API_KEY`, a API local não envia e-mail e mostra o link de redefinição no log (`docker compose logs api`).
- Se um login falhar, confira se a aplicação está no modo API ou mock e se a API está ligada.
