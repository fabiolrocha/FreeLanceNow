# Design: todas as situações de pagamento com Stripe Connect (modo de teste)

Data: 15/11/2026, revisado em 16/11/2026 (cadastro dentro do app). Entrega final: 18/11/2026. Base: F09 na `main` (PR #55, ADR33).

## Intenção

O app continua em fase de teste, mas o fluxo de dinheiro deve cobrir todas as situações reais de uma plataforma intermediadora, como se fosse produção. Hoje o dinheiro entra pelo Stripe e fica em custódia, mas o repasse ao profissional é só um registro (saque simulado), e eventos que nascem fora do app (chargeback, reembolso pelo painel, falha de reembolso) são ignorados. O objetivo é fechar esses buracos usando Stripe Connect no sandbox, sem nenhuma chave ou dado real.

## Objetivos

1. O profissional cadastra a conta de recebimento **sem sair do app**: o formulário é um componente do Stripe embutido numa tela nossa (Connect embedded components). Ele não cria login nem senha no Stripe.
2. A liberação da custódia vira uma transferência real (Transfer) da plataforma para a conta conectada do profissional, com o valor líquido (bruto menos a comissão).
3. O saque vira um payout real da conta conectada para a conta bancária de teste dela, feito pelo componente de saques do Stripe embutido no app.
4. O app reage a eventos externos:
   - chargeback aberto, ganho ou perdido (`charge.dispute.*`);
   - reembolso total ou parcial feito pelo painel do Stripe (`charge.refunded`);
   - reembolso que falha (`refund.failed`);
   - mudança de estado da conta conectada (`account.updated`);
   - saque pago ou recusado (`payout.paid`, `payout.failed`).
5. Quando um reembolso ou chargeback atinge um valor já transferido, o app estorna a transferência (transfer reversal) na proporção certa.
6. O painel administrativo mostra essas situações: chargebacks abertos, reembolsos com falha, liberações aguardando conta do profissional e transferências com falha.

## Fora do escopo

- Modo de produção e chaves `sk_live_` (continuam recusadas).
- Reembolso parcial iniciado pelo app. A decisão de disputa interna continua tudo ou nada (`CONCLUIDO` libera, `CANCELADO` reembolsa). Reembolso parcial só entra quando feito pelo painel do Stripe.
- Contestar chargeback (enviar evidências) pelo app. Isso é feito no painel do Stripe.
- Boleto no sandbox atual: o método aparece como indisponível na conta e não se ativa pela API. O código continua aceitando `BOLETO`; o `.env` usa `STRIPE_PAYMENT_METHODS=CARD,PIX`.
- Notas fiscais e tributos.

## O que seria um fracasso

- Dinheiro sair duas vezes: transferência duplicada, payout acima do saldo, estorno aplicado duas vezes por webhook repetido.
- O app mostrar um saldo que o Stripe não tem.
- Quebrar o modo sem Stripe (sem `STRIPE_SECRET_KEY`): contratações, seed e saque simulado precisam continuar funcionando.
- Dados bancários ou documentos do profissional passarem pela API do app.

## Restrições

- Conta usada: sandbox "Área restrita de FabioRocha Faculdade" (`acct_1Ubs9qPdw72gqhsa`, BR, BRL). Cartão e Pix disponíveis; boleto indisponível; nenhum webhook nem conta conectada ainda.
- O Connect precisa estar ativado no painel da plataforma. Só o dono da conta faz isso.
- `stripe-java` 34.1.0, Spring Boot 4, JdbcTemplate, migrações Flyway (próxima: `V18`).
- Webhook atual é idempotente por `event.id` (`payment_webhook_event`); a ordem de trava é contratação → pagamento. Manter as duas regras.
- Eventos de contas conectadas (`account.updated`, `payout.*`) chegam por um endpoint "Connect" separado no Stripe, com outro segredo de assinatura.

## Abordagens consideradas

| Abordagem | Como funciona | Troca |
|---|---|---|
| **A. Só eventos externos, saque simulado** | Trata chargeback, reembolso pelo painel e falha de reembolso; repasse continua registro | Pequena, mas não fecha o repasse |
| **B. Connect, cobranças e transferências separadas (escolhida)** | Checkout continua cobrando na plataforma (custódia natural); na conclusão, `Transfer` com `source_transaction` para a conta do profissional; saque = `Payout` manual na conta conectada | Encaixa no fluxo atual sem mudar o Checkout; plataforma responde por chargebacks e reembolsos (recupera com reversal) |
| C. Connect com destination charge | Checkout já nasce com destino ao profissional | Exige conta do profissional pronta antes do pagamento e não permite segurar o valor até a conclusão sem truques |

Escolha do usuário: Connect (B). C foi descartada porque a custódia até a conclusão é regra central do app (ADR33).

## Decisões do design

### Conta de recebimento do profissional (componentes embutidos)

Escolha do usuário em 16/11: formulário do Stripe dentro do app (opção 2), em vez da página hospedada (opção 1) ou de um formulário próprio (opção 3, recusada porque CPF e dados bancários passariam pela nossa API).

- **Accounts v2** (`POST /v2/core/accounts`, chamado por `StripeClient.rawRequest`). Conferido no sandbox em 16/11: o Stripe recusa contas v1 em plataformas novas e não deixa esta plataforma assumir as perdas das contas conectadas. Por isso a conta tem duas configurações: `recipient` (capacidade `stripe_balance.stripe_transfers`, para receber transferências e sacar) e `merchant` (`card_payments`, MCC `8999`), que permite `losses_collector = stripe`. `fees_collector = application`, `dashboard = none`, país `br`, moeda `brl`. As cobranças continuam na plataforma, que segue respondendo por reembolsos e chargebacks delas.
- Pronto para receber = `stripe_transfers` com status `active`; pendências = entradas de `requirements` com `awaiting_action_from = user`.
- A Account Session (v1, `POST /v1/account_sessions`) funciona com a conta v2.
- Calendário de payout da conta conectada: **manual**, para o profissional decidir quando sacar. A forma de definir isso numa conta v2 fica para a etapa 3.
- Nova tabela `payout_account` (um registro por profissional): id da conta Stripe, `details_submitted`, `transfers_enabled`, `payouts_enabled`, pendências em texto curto, datas. Atualizada ao sair do formulário e por `account.updated`.
- Endpoints novos (só profissional):
  - `POST /users/me/payout-account/session`: cria a conta conectada se não existir e devolve o `client_secret` de uma Account Session com os componentes `account_onboarding`, `notification_banner`, `account_management` e `payouts` (este com `standard_payouts` ligado).
  - `GET /users/me/payout-account`: devolve o estado (e consulta o Stripe para atualizar, caso o webhook ainda não tenha chegado).
- Frontend: `@stripe/connect-js` e `@stripe/react-connect-js`, chave publicável `pk_test_` em `VITE_STRIPE_PUBLISHABLE_KEY` (valor público, pode ficar no front). Aparência ajustada às cores e fonte do app.

### Liberação vira transferência

- Ao confirmar o pagamento, guardar também o id da cobrança (`latest_charge` do PaymentIntent) em `payment.provider_charge_id`. O Checkout passa a definir `transfer_group = contract-<id>`.
- `onCompleted` continua marcando `RELEASED` e lançando `PAYOUT_RELEASE` no livro. Em seguida, se o pagamento é `STRIPE`, tenta a transferência:
  - profissional com conta pronta (`transfers_enabled`): `Transfer` de `net_amount` com `destination`, `source_transaction = provider_charge_id`, `transfer_group` e chave de idempotência `transfer-<paymentId>`. Grava `transfer_id`, `transferred_at` e lança `TRANSFER` no livro.
  - sem conta pronta: o pagamento fica `RELEASED` com `transfer_id` nulo ("aguardando conta de recebimento"); o profissional recebe aviso para cadastrar a conta.
  - falha do Stripe: não desfaz a conclusão; registra `transfer_error` e o painel admin mostra para nova tentativa.
- Quando `account.updated` indica conta pronta, o app transfere todas as liberações pendentes daquele profissional. O admin também tem um botão "Tentar transferir de novo".
- A transferência é feita depois do commit da conclusão, para uma falha no Stripe não travar a contratação. Repetir é seguro pela chave de idempotência.

### Saque vira payout (componente do Stripe)

- Com Stripe ligado, a tela `/saque` do profissional mostra o componente `payouts` do Stripe: saldo disponível e pendente da conta conectada, lista de saques e botão para sacar. O próprio Stripe valida o saldo e executa o payout; o app não calcula nem cria payouts.
- Sem Stripe (ou só com pagamentos `SIMULATED` do seed), o saque simulado atual continua igual, com a tabela `withdrawal`.
- A carteira do profissional (tela do app) mostra: em custódia, aguardando conta de recebimento e transferido para a conta Stripe, a partir do banco do app. Saldo e saques reais ficam no componente do Stripe.
- `payout.paid` e `payout.failed` geram só aviso interno ao profissional (o histórico fica no componente).

### Eventos externos

- `charge.refunded` (reembolso pelo painel ou pelo app): grava `refunded_amount`. Se o total foi reembolsado, status `REFUNDED`; se parcial, mantém o status e lança `REFUND` com o valor parcial. Se já havia transferência, cria reversal proporcional (`valor reembolsado × net / gross`, arredondado para baixo em centavos) com chave `reversal-refund-<refundId>`, lança `TRANSFER_REVERSAL`. Reembolso que o próprio app pediu não gera lançamento duplicado (comparar com o que já está no livro).
- `refund.failed`: status `REFUND_FAILED`, aviso ao admin e ao cliente; o painel admin lista.
- `charge.dispute.created`: grava `dispute_id` e `dispute_status = OPEN`; avisa admin, cliente e profissional. Enquanto o chargeback está aberto, a liberação **não transfere** (fica aguardando). Lança `CHARGEBACK` no livro com o valor contestado.
- `charge.dispute.closed`: `won` → `dispute_status = WON`, lança estorno do `CHARGEBACK` e libera a transferência pendente, se houver. `lost` → `dispute_status = LOST`, status `CHARGED_BACK`; se já havia transferência, reversal total com chave `reversal-dispute-<disputeId>`. Se o saldo da conta conectada não cobre o reversal, registrar a falha e mostrar ao admin (a plataforma arca, como previsto no Connect).
- `account.updated`, `payout.paid`, `payout.failed`: como descrito acima (payout só gera aviso).
- Todos continuam passando pela tabela `payment_webhook_event` (idempotência) e pela ordem contratação → pagamento quando há pagamento envolvido. Eventos de cobrança localizam o pagamento por `provider_payment_id` ou `provider_charge_id` (não há `metadata.paymentId` no objeto `charge` por padrão; copiar o metadata para o PaymentIntent já existe, então buscar pelo PaymentIntent).

### Webhook

- Mesmo caminho `/api/v1/payments/webhook`. A assinatura é verificada com `STRIPE_WEBHOOK_SECRET` e, se falhar, com o novo `STRIPE_CONNECT_WEBHOOK_SECRET`. Com `stripe listen` local, o mesmo `whsec_` serve aos dois.
- `PaymentGateway.GatewayEvent` deixa de ser só Checkout Session: passa a carregar o tipo do objeto e os ids relevantes (session, payment intent, charge, refund, dispute, account, payout, valores e status).

### Banco (`V18__stripe_connect.sql`)

- `payout_account` (nova).
- `payment`: `provider_charge_id`, `transfer_id`, `transferred_at`, `transfer_error`, `refunded_amount`, `dispute_id`, `dispute_status`; status passa a aceitar `REFUND_FAILED` e `CHARGED_BACK`.
- `ledger_entry.entry_type`: acrescenta `TRANSFER`, `TRANSFER_REVERSAL`, `CHARGEBACK`, `CHARGEBACK_REVERSAL`.
- `withdrawal`: sem mudança (continua só para o saque simulado).

### Interface

- Nova tela "Conta de recebimento" (profissional): componente de cadastro embutido; depois de pronto, mostra o componente de gestão da conta. O aviso de pendências do Stripe (`notification_banner`) aparece no topo da carteira.
- Carteira do profissional: cartão com o estado da conta de recebimento (não cadastrada, cadastro incompleto, em análise, pronta) e botão para a tela acima. Saldos do app conforme acima.
- Tela `/saque`: componente de saques do Stripe (modo API com Stripe) ou saque simulado (mock ou sem Stripe).
- Detalhe do pagamento (comprovante): novos tipos de lançamento com rótulos em português; selo de chargeback.
- Contratação: aviso quando o pagamento tem chargeback aberto.
- Admin `/admin/transacoes`: totais de transferido, revertido e em chargeback; filtros ou listas de pendências (aguardando conta, transferência com falha, reembolso com falha, chargeback aberto) e botão de nova tentativa de transferência.
- Modo mock: telas recebem os mesmos estados com dados fictícios, para a demonstração continuar funcionando sem API.

### Configuração do Stripe (feita por mim via MCP ou por você no painel)

- Ativar Connect na plataforma (você, no painel).
- Payment methods: manter cartão e Pix; boleto fica desligado no sandbox.
- Chave publicável `pk_test_` em `web/.env.local` (`VITE_STRIPE_PUBLISHABLE_KEY`) e na Vercel.
- Webhooks: local com `stripe listen --forward-to … --forward-connect-to …`; no Render, dois endpoints (conta e Connect) cadastrados quando houver URL pública.
- Chave `sk_test_` no `.env` local (você copia do painel; não passa pelo chat).

### Testes

- `FakePaymentGateway` ganha contas, sessões, transferências e reversals em memória.
- `PaymentIntegrationTests` cobre: criação de sessão e estado da conta (só profissional); liberação com e sem conta pronta; transferência após `account.updated`; aviso de payout pago e recusado; reembolso total e parcial pelo painel antes e depois da transferência; `refund.failed`; chargeback aberto bloqueando transferência, ganho e perdido (com e sem transferência feita); webhook repetido em cada caso; modo sem Stripe intacto.
- `StripePaymentGatewayTests` continua verificando assinatura (agora com os dois segredos).
- Playwright `payments-api.spec.ts`: carteira com estado da conta de recebimento e novos estados, com axe em 1280 e 390 px. Os componentes do Stripe (iframes) são conferidos no roteiro manual, não no teste automático.
- Roteiro manual no sandbox com cartões de teste: `4242…` (normal), `4000 0000 0000 0077` (saldo disponível na hora, para testar payout), `4000 0000 0000 0259` (gera chargeback).

### Documentação

- ADR34: Connect em modo de teste, cobranças e transferências separadas, payout manual; substitui a parte de saque simulado do ADR33.
- `deploy.md`, `desenvolvimento.md` (novas variáveis `STRIPE_CONNECT_WEBHOOK_SECRET` e `VITE_STRIPE_PUBLISHABLE_KEY`; corrige o trecho que dizia que o front não usa chave do Stripe), `api.md` (endpoints), `dados.md` (`V18`), `testes-e-demonstracao.md` (roteiro), backlog/roadmap.

## Decisões tomadas por Claude (conferir)

- Cancelamento com chargeback aberto: o app não pede reembolso ao Stripe (cobrança contestada não aceita reembolso); o pagamento fica aguardando o resultado do chargeback, que devolve o dinheiro ao cliente se ele ganhar. Se a plataforma ganhar, o app reembolsa nessa hora.
- Chargeback aberto com a contratação ainda em andamento: o app só avisa admin e as partes. A decisão sobre a contratação usa as ferramentas de disputa que já existem.
- Reembolso parcial pelo painel: a plataforma absorve a parte proporcional da comissão (o reversal cobra do profissional só a parte líquida).
- Trabalho em uma branch nova `feature/f09-connect`, partindo da branch com as correções de documentação.

## Deixado para quem implementar

- Nomes exatos de classes e métodos, e se o `PaymentService` (772 linhas) deve ser dividido (sugestão: `PayoutAccountService` e `ConnectEventHandler` separados).
- Capacidades exatas exigidas para conta conectada BR: confirmar no sandbox antes de escrever código.
- Texto exato dos avisos e rótulos, seguindo o tom das telas atuais.
