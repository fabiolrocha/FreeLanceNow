# Roadmap — entrega final em 18 de novembro de 2026

Revisado em **21/10/2026**. Prazo final: **18/11/2026, quarta-feira**, horário de Brasília. As janelas intermediárias são sugestões de planejamento, sujeitas ao andamento real do projeto. Não há distribuição fixa por pessoa; o grupo combina o trabalho por entrega e dependência.

## Estado atual

| Etapa | Estado verificado no código da `main` (`7a6e769`) |
|---|---|
| Marco inicial de 07/10 (`marco-1`) | Base React navegável em mock e API persistente de auth, perfis, categorias e anúncios |
| Contratações e prazos (`fase-01`, F01/F02) | Integrados: histórico, participantes, snapshots e jobs de 48h/5 dias |
| Avaliações (`fase-02`, F03) | Integradas: nota, média, janela de avaliação e resposta do profissional |
| Demandas/propostas (`fase-03`, F08) | Integradas: proposta pendente única e aceite gerando contratação |
| Administração/moderação (F04/F05) | Pendentes/parciais: contestação e decisão de disputa ligadas à API na interface, condicionadas à conta ADMIN; gestão e denúncias permanecem locais |

As entregas de F04/F05 estavam na janela de 15–21/10 e precisam de replanejamento. Seu estado permanece explícito no [backlog](backlog.md). Os registros de testes anteriores estão em [testes e demonstração](testes-e-demonstracao.md); esta revisão documental não constitui nova execução das suítes da aplicação.

## Próximas janelas sugeridas

| Período | Entrega | Critério para encerrar |
|---|---|---|
| A partir de 21/10 | Replanejar e integrar administração/moderação — F04/F05 | Admin provisionado de forma controlada, gestão e fila persistentes, decisão autorizada e auditável |
| 22–28/10 | Upload, paginação no web, mensagens, notificações e e-mail — F06/F07 | Upload validado; busca paginada; comunicação entre contas e recuperação de senha verificadas |
| 29/10–04/11 | Financeiro em Stripe Sandbox — F09 | Pagamento/reembolso de teste, comissão, eventos repetidos e conciliação testados |
| 05–11/11 | Integração e operação — F10 | Ambiente de demonstração reproduzível, fluxos persistentes, backup/restauração e verificações de acesso/carga |
| 12–16/11 | Regressão, correções e documentação | Sem bloqueios de entrega; documentação corresponde à versão; congelamento sugerido em 16/11 |
| 17/11 | Ensaio e conferência dos materiais | Roteiro executado do início ao fim; versão e instruções conferidas |
| **18/11** | **Entrega final** | **Código, sistema web, documentação, evidências e apresentação entregues** |

As próximas janelas precisam acomodar F04/F05. Ao revisar capacidade e dependências, atualizar calendário e backlog juntos; não assumir que a passagem de uma data conclui a etapa. Não há previsão de trabalho obrigatório em fins de semana.

## Provedores e dependências

Stripe Sandbox, Neon PostgreSQL e Resend foram escolhidos no Passo 0. O código atual contém parâmetros de Stripe/Resend, mas não implementa checkout, webhooks ou envio de e-mail. O Compose usa PostgreSQL local; a escolha do Neon não comprova ambiente remoto implantado. Storage de imagens ainda precisa ser definido.

- F04/F05 dependem de autorização administrativa e do ciclo de contratação já persistente.
- F06 inclui paginação da interface; a paginação do endpoint de busca já existe.
- F07 inclui comunicação persistente e entrega externa, além das telas demonstrativas atuais.
- F09 depende de regras de contratação, confirmação e disputa; demonstrar pagamentos exclusivamente em sandbox nesta entrega.
- F10 fecha operação e evidências; funcionamento local não comprova metas de produção.

## Critérios da entrega final

- React web responsivo com os fluxos previstos de cliente, freelancer e administrador integrados à API.
- Cadastro, perfis, anúncios, contratações, avaliações, demandas/propostas, denúncias/disputas, mensagens e notificações persistidos e autorizados.
- Upload, paginação, e-mail e rotinas de prazo verificados; financeiro testado em sandbox com idempotência e conciliação.
- Testes de fluxo e cenários negativos com evidências; sem bloqueios de navegação, formulário, autorização ou execução.
- Migrações, dados de demonstração, execução e backup/restauração conferidos.
- Documentação correspondente à versão entregue e apresentação ensaiada até 17/11. Horário de entrega/apresentação em 18/11 ainda não informado.

## Acompanhamento

A cada entrega, conferir dependências, demonstrar frontend e backend juntos e atualizar o backlog. Revisão e regressão são combinadas entre integrantes disponíveis. Avisar o grupo sobre mudanças em contratos, migrações e arquivos compartilhados, conforme [colaboração](equipe.md).

| Risco | Ação |
|---|---|
| Pendências de administração acumularem com as próximas fases | Replanejar F04/F05 primeiro e conferir a capacidade para F06/F07 |
| Conflitos em store, tipos, adapter, rotas e CSS | Combinar edições e integrar PRs pequenos |
| Provedor escolhido ser tratado como integração concluída | Exigir execução e evidência do fluxo real ou sandbox |
| Mock ser confundido com funcionalidade persistente | Usar a matriz de frontend e fechar os cards apenas pelo aceite |
| Falhas descobertas perto do prazo | Preservar 12–16/11 para correções e 17/11 para ensaio |

O HTML em `legado/` é histórico. Este roadmap e o backlog são as referências de planejamento atuais. Aplicativo móvel permanece fora do escopo.
