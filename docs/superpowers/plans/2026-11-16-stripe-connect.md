# Stripe Connect (todas as situações de pagamento) — plano

> Execução: Claude implementa etapa por etapa nesta sessão; o usuário confere cada etapa no app antes da próxima.

**Objetivo:** repasse e saque reais (modo de teste) com Stripe Connect e componentes embutidos, mais tratamento de reembolso externo, falha de reembolso e chargeback.

**Spec:** `docs/superpowers/specs/2026-11-15-stripe-connect-design.md`

**Stack:** Spring Boot 4 + JdbcTemplate + Flyway, `stripe-java` 34.1.0; React 19 + Vite, `@stripe/connect-js` e `@stripe/react-connect-js`.

## Restrições globais

- Só modo de teste; `sk_live_`/`rk_live_` continuam recusadas.
- Sem `STRIPE_SECRET_KEY`, tudo funciona como antes (seed, saque simulado).
- CPF, documentos e dados bancários nunca passam pela API do app.
- Webhook idempotente por `event.id`; trava contratação → pagamento.
- A chave publicável (`pk_test_`) é servida pela API (`STRIPE_PUBLISHABLE_KEY`), não por variável `VITE_*`: um lugar só para configurar (Render ou `.env` do Compose).

## Pontos de atenção na revisão

1. Profissional abre a sessão duas vezes seguidas: deve reaproveitar a mesma conta Stripe (nunca criar duas).
2. Cliente ou admin chamando os endpoints da conta de recebimento: 403.
3. Stripe fora do ar ao criar conta/sessão: 502 com mensagem clara, sem gravar conta pela metade.
4. Webhook repetido de reembolso/chargeback: nenhum lançamento duplicado.
5. Liberação com chargeback aberto: não transfere.

---

## Etapa 1 — Conta de recebimento (feita em 16/11; aguardando conferência do usuário)

**Arquivos:**
- Criar: `api/src/main/resources/db/migration/V18__stripe_connect.sql` (tabela `payout_account` e todas as colunas das etapas seguintes, para não abrir outra migração no meio do caminho).
- Criar: `api/src/main/java/br/com/freelancenow/api/payments/PayoutAccountService.java`.
- Modificar: `PaymentGateway` (+ `createConnectedAccount`, `createAccountSession`, `retrieveAccount`, record `ConnectedAccount`), `StripePaymentGateway`, `PaymentDtos` (+ `PayoutAccountView`, `AccountSessionStarted`), `PaymentController`, `application.yml`, `compose.yml`, `render.yaml`, `.env.example`.
- Testes: `FakePaymentGateway`, `PaymentIntegrationTests` (novos casos), `ApiIntegrationTests` (18 migrações).
- Web: `web/src/data/payments.ts`, nova `web/src/features/payments/payout-account.tsx`, rota `/conta-recebimento` em `App.tsx`, cartão na carteira.

**Interfaces:**
- `GET /api/v1/users/me/payout-account` → `PayoutAccountView { enabled, status: NOT_STARTED|INCOMPLETE|IN_REVIEW|READY, transfersEnabled, payoutsEnabled, currentlyDue: string[] }`.
- `POST /api/v1/users/me/payout-account/session` → `AccountSessionStarted { clientSecret, publishableKey }`. Só FREELANCER; 409 se Stripe desligado.
- Status: `READY` = `transfers_enabled`; `IN_REVIEW` = `details_submitted` e nada em `currently_due`; `INCOMPLETE` = conta criada, faltando dados; `NOT_STARTED` = sem conta.

**Testes (PaymentIntegrationTests):**
- `payoutAccountStartsNotStarted`: profissional novo → `status = NOT_STARTED`.
- `sessionCreatesOneAccountAndReusesIt`: duas chamadas → `gateway.accounts.size() == 1`, dois `clientSecret`.
- `onlyFreelancersHavePayoutAccounts`: cliente → 403 nos dois endpoints.
- `statusFollowsStripe`: fake marca a conta como pronta → GET devolve `READY`.
- `ApiIntegrationTests`: contagem de migrações 18.

**Resultado:** 87 testes da API verdes; build, lint e testes do web verdes; formulário do Stripe exibido em `/conta-recebimento` com o sandbox real (contas criadas pela API v2, ver spec).

**Verificação:** `make api-test` verde; `cd web && npm run check` (ou o script existente) verde; com chaves de teste, abrir `/conta-recebimento` como profissional e ver o formulário do Stripe.

## Etapa 2 — Repasse real (feita em 16/11; aguardando conferência do usuário)

**Arquivos:** novos `PayoutTransferService` e `PayoutAccountStore`; modificados `PaymentGateway` (+ `chargeOf`, `transfer`, record `TransferRequest`), `StripePaymentGateway` (Transfer com `source_transaction`, `transfer_group` também no Checkout), `PaymentService` (repasse após o commit da conclusão, aviso conforme a conta), `PaymentDtos` (`transferredAt`, `transferPending`, carteira com `transferred` e `awaitingAccount`), `PayoutAccountService`; web `data/payments.ts` e `features/payments/pages.tsx`.

**Como funciona:**
- Na conclusão, depois do commit, transfere o líquido para a conta pronta (`transfer-<paymentId>` como chave de idempotência, `contract-<id>` como grupo). Falha do Stripe não desfaz a conclusão: fica em `transfer_error` e é tentada de novo.
- Sem conta pronta, o valor fica "aguardando conta de recebimento". É transferido quando o app consulta a conta e a vê pronta, ou pela rotina periódica (`app.stripe.transfer-check-ms`, padrão 5 min), que também atualiza contas ainda não prontas. Não há webhook de conta: a API v2 manda eventos "finos", que ficam fora do escopo.
- Chargeback aberto (`dispute_status = OPEN`) segura a transferência.

**Testes:** `releaseTransfersTheNetAmountToAReadyAccount`, `releasedMoneyWaitsForTheAccountAndGoesWhenItIsReady`, `failedTransferIsRecordedAndRetried`, `openChargebackHoldsTheTransfer`.

**Resultado:** 91 testes da API verdes; lint, build e testes do web verdes; carteira mostra "Na conta de recebimento".

**Pendente para a etapa 3:** o saldo "Disponível" e o saque simulado ainda contam dinheiro do Stripe; na etapa 3 o saque passa a ser o do Stripe e o simulado fica só para pagamentos de demonstração.

## Etapa 3 — Saque real (feita em 16/11; aguardando conferência do usuário)

**Descoberta:** o Stripe recusa saque manual para contas do Brasil ("You cannot be on a manual payout plan in country BR."). O saque é automático: o Stripe deposita o saldo da conta de recebimento na conta bancária pelo calendário. O componente `payouts` deixa o profissional mudar o calendário (`edit_payout_schedule: true`) e mostra saldo, próximos depósitos e histórico.

**Arquivos:** `StripePaymentGateway` (segundo segredo `STRIPE_CONNECT_WEBHOOK_SECRET`, leitura de eventos de conta conectada), `PaymentGateway.GatewayEvent` (+ `account`, `objectId`, `amount`, `detail`), `PaymentService` (eventos de conta vão para `PayoutAccountService.onAccountEvent`; saldo do saque simulado só conta pagamentos `SIMULATED`), `PayoutAccountStore.ownerOf`; web `StripePayouts` em `payout-account.tsx`, `/saque` e carteira em `pages.tsx`.

**Eventos de conta conectada (webhook Connect):**
- `payout.paid`: aviso "Saque depositado" com o valor.
- `payout.failed`: aviso "Saque não realizado" com o motivo do Stripe e link para a conta de recebimento.
- `account.updated`: atualiza a situação da conta e transfere o que estava esperando.
- Conta desconhecida: ignorada (200), sem nova tentativa.

**Saque simulado:** continua no modo mock e sem Stripe. Com Stripe, só gasta o "saldo de demonstração" (pagamentos do seed); dinheiro pago pelo Stripe não entra nele.

**Testes:** `simulatedWithdrawalSpendsOnlyDemoMoney`, `payoutEventsNotifyTheFreelancerOnce`, `accountUpdatedEventSendsWaitingMoney`, `connectSecretVerifiesPayoutEventsOfConnectedAccounts`; teste principal ajustado (dinheiro do Stripe não é sacável pelo simulado).

**Resultado:** 95 testes da API verdes; lint, build e testes do web verdes; `/saque` mostra o aviso de cadastro incompleto para a conta de teste.

**Configuração (etapa 5 documenta):** no painel do Stripe, um destino de webhook "contas conectadas" para `/api/v1/payments/webhook` com `payout.paid`, `payout.failed` e `account.updated`; o segredo vai em `STRIPE_CONNECT_WEBHOOK_SECRET`. Localmente, `stripe listen --forward-to ... --forward-connect-to ...` usa um segredo só (`STRIPE_WEBHOOK_SECRET`).

## Etapa 4 — Imprevistos (feita em 16/11; aguardando conferência do usuário)

**Arquivos:** novo `PaymentIncidentService`; `PaymentGateway` (+ `reverseTransfer`, `GatewayEvent.chargeId`), `StripePaymentGateway.chargeEvent` (lê cobrança, reembolso e disputa pelo JSON), `PaymentService` (encaminha `charge.*`/`refund.*`; reembolso do app grava `refunded_amount`; cancelamento com chargeback aberto não reembolsa), `PayoutTransferService` (transfere o líquido menos a parte já reembolsada), `PaymentView` (+ `refundedAmount`, `disputeStatus`); web: status `REFUND_FAILED`/`CHARGED_BACK`, avisos de contestação e reembolso recusado.

**Regras como implementadas:**
- `charge.refunded` traz o total reembolsado até agora; o app só lança a diferença (evento repetido ou reembolso feito pelo próprio app não duplica). Total: status `REFUNDED`. Parcial: status mantido, "reembolso parcial".
- Parte do profissional após reembolso: `líquido − reembolsado × líquido / bruto` (arredondado para baixo). O que ele recebeu acima disso volta por reversal (`reversal-refund-<paymentId>-<centavos>`). Antes da transferência, a transferência já sai menor.
- `refund.failed`: `REFUNDED` vira `REFUND_FAILED`; aviso ao cliente e aos admins.
- `charge.dispute.created`: `OPEN`, lançamento `CHARGEBACK`, avisos a cliente, profissional e admins; transferência segurada.
- `charge.dispute.closed`: `won`/`warning_closed` → `WON`, `CHARGEBACK_REVERSAL`, transfere o que esperava ou, se a contratação foi cancelada durante a contestação, reembolsa nessa hora. `lost` → `LOST`, status `CHARGED_BACK`, reversal de tudo que foi transferido (`reversal-dispute-<id>`).
- Reversal recusado (saldo do profissional baixo): fica em `transfer_error` ("Estorno: …") e os admins são avisados; a plataforma arca.

**Testes:** `dashboardRefundOfEscrowIsRecordedOnce`, `appRefundIsNotRecordedAgainByItsEvent` (inclui `refund.failed`), `partialThenFullRefundAfterTransferTakesBackTheFreelancerShare`, `partialRefundBeforeTheTransferLowersWhatIsSent`, `chargebackHoldsTheTransferUntilItIsWon`, `lostChargebackTakesBackTheWholeTransfer`, `failedReversalIsRecordedForTheAdmin`, `cancellationDuringAChargebackRefundsOnlyIfItIsWon`, `chargeRefundAndDisputeEventsCarryPaymentIntentAndAmounts`.

**Resultado:** 104 testes da API verdes; lint, build e testes do web verdes.

**Configuração:** o destino de webhook da plataforma precisa também dos eventos `charge.refunded`, `refund.failed`, `charge.dispute.created` e `charge.dispute.closed` (etapa 5 documenta).

## Etapa 5 — Fechamento (feita em 16/11; aguardando conferência do usuário)

**Arquivos:** `PaymentDtos` (`AdminSummary` com `transferred`, `reversed`, `inChargeback`, `issues`; record `AdminIssue`), `PaymentService.issues` e `retryTransfer`, `PayoutAccountService.refresh`, `PaymentController` (`POST /admin/payments/{id}/transfer`), `application.yml` (`STRIPE_TRANSFER_CHECK_MS`); web `AdminIssues` em `pages.tsx`, `adminIssueLabel`/`adminIssueHint` e `retryTransfer` em `data/payments.ts`.

**Pendências do admin**, em ordem de urgência: contestação aberta, reembolso recusado, estorno não feito, transferência recusada (com "Tentar transferir") e aguardando conta do profissional (o botão consulta o Stripe de novo).

**Docs:** ADR34 em `decisoes.md` (ADR33 aponta para ele); `deploy.md` (Connect, dois destinos de webhook, novas variáveis); `api.md`; `dados.md` (V18); `desenvolvimento.md` (chave publicável pela API, segredo Connect, intervalo da rotina); roteiro manual em `testes-e-demonstracao.md`; `backlog`, `escopo`, `frontend`, `requisitos`, `roadmap`, `leitura-do-projeto`.

**Testes:** `adminSeesIssuesAndRetriesAFailedTransfer`, `adminSeesWaitingAccountsAndOpenChargebacks`.

**Resultado:** 106 testes da API verdes; lint, build e testes do web verdes.
