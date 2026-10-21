# Frontend React web

Revisado em **21/10/2026**, a partir de `web/src/App.tsx`, `Layout.tsx` e dos módulos de dados. React 19, TypeScript 6, Vite 8 e React Router 7. Features são carregadas por `lazy`/`Suspense`; o shell e os componentes compartilhados ficam em `app/` e `components/`. Fonte Public Sans instalada localmente. A marca oficial é exibida via `/images/logo.svg` e `/favicon.svg`; ícones Lucide ilustram as categorias de serviço até o upload de mídia (`F06`).

## Matriz de telas e acesso

| Fluxo atual | Rotas registradas | Perfil/participação | Dados |
|---|---|---|---|
| Início/busca/detalhe | `/`, `/servicos`, `/servicos/:id` | Público | Mock ou API (com filtro por nota mínima) |
| Profissionais/perfil | `/profissionais`, `/profissionais/:id` | Público | Mock ou API (média com 1 decimal e avaliações reais) |
| Entrada/cadastro | `/login`, `/cadastro` | Público | Auth mock/API |
| Recuperação de acesso | `/recuperar-senha` | Público | Apenas visual; sem envio de e-mail (`F07`) |
| Perfil/edição/complemento | `/perfil`, `/perfil/editar`, `/perfil/completar` | Autenticado | Mock ou API |
| Dashboard | `/inicio`, `/painel` (freelancer) | Autenticado | Mock ou API (catálogo e métricas de contratação reais) |
| Gestão de serviços | `/meus-servicos`, `/meus-servicos/novo`, `/meus-servicos/:id/editar` | Freelancer | Mock ou API |
| Solicitação | `/servicos/:id/solicitar` | Cliente | Mock ou API (`F01`) |
| Solicitação enviada | `/contratacoes/:id/enviada` | Autenticado | Confirmação visual do envio, com link para o detalhe da contratação (`F01`) |
| Lista/detalhe | `/contratacoes`, `/contratacoes/:id`, `/solicitacoes` (freelancer) | Participantes | Mock ou API (`F01`) |
| Conclusão/confirmar/contestar | `/contratacoes/:id/concluir`, `/contratacoes/:id/confirmar`, `/contratacoes/:id/contestar` | Freelancer conclui; cliente confirma/contesta | Mock ou API (`F01`) |
| Avaliação e resposta | `/contratacoes/:id/avaliar`, `/contratacoes/:id/avaliacao-publicada`; resposta no detalhe | Cliente avalia; freelancer responde | Mock ou API (`F03`) |
| Disputa | `/contratacoes/:id/disputa` | Participantes | Abertura via API (`F01`); decisão na moderação ligada à API, condicionada à sessão ADMIN (`F04`/`F05`) |
| Demandas/propostas | `/demandas`, `/demandas/nova`, `/demandas/:id`, `/demandas/:id/proposta`, `/demandas/:id/proposta/enviada` | Cliente/freelancer | Mock ou API (`F08`) |
| Avisos/chat | `/notificacoes`, `/mensagens` | Autenticado | Mock; chat nesta tela/sessão sem entrega externa (`F07`) |
| Carteira/transação | `/carteira`, `/transacao` | Autenticado | Simulação financeira (`F09` pendente) |
| Pagamento | `/pagamento`, `/pagamento/confirmado` | Cliente | Simulação financeira (`F09` pendente) |
| Saque | `/saque`, `/saque/enviado` | Freelancer | Simulação financeira (`F09` pendente) |
| Denúncia | `/denunciar`, `/denunciar/enviada` | Autenticado | Mock; admin vê a fila na mesma sessão (`F05`) |
| Gestão/relatórios/transações | `/admin/usuarios`, `/admin/categorias`, `/admin/relatorios`, `/admin/transacoes` | Admin; conta demo só no mock | Usuários/categorias locais e financeiro simulado; relatórios derivados do estado carregado (`F04`/`F09`) |
| Moderação | `/admin/moderacao` | Admin; provisionamento real pendente | Denúncias locais; disputas usam contratos/transições da API com sessão ADMIN (`F05` parcial) |
| Ajuda/termos/privacidade | `/ajuda`, `/termos`, `/privacidade` | Público | Texto acadêmico provisório |
| URL desconhecida | Qualquer rota não encontrada | Público | Tela 404 com retorno ao início |

Guards React protegem os grupos de rotas por role. Participação, estado e proprietário são verificados nos fluxos e, nas funcionalidades reais, pelo backend. O prefixo `/admin` redireciona para `/admin/usuarios`; não é outra tela de gestão.

## Telas demonstrativas e componentes reutilizados

Recuperação de senha, avisos/chat, financeiro, denúncias e gestão administrativa continuam no código e na navegação, mas não entregam seus fluxos completos pela API. A moderação é parcial: sua seção de disputas usa contratos e transições reais quando há sessão ADMIN; a base atual não provisiona essa conta, e denúncias/evidências/auditoria completa ainda faltam. Permanecem vinculados aos cards F04–F07/F09. Não foram classificados como abandonados apenas por serem simulados.

| Rotas/estados | Reutilização atual |
|---|---|
| `/inicio` e `/painel` | Mesmo `Dashboard`; `/painel` exige freelancer |
| `/perfil/editar` e `/perfil/completar` | Mesmo `EditProfile`, com título contextual |
| `/contratacoes` e `/solicitacoes` | `ContractList` com contexto de solicitações para freelancer |
| Ações de contratação e `/contratacoes/:id/disputa` | `ContractAction` varia conforme URL e estado |
| Proposta/enviada, pagamento/confirmado, saque/enviado e denúncia/enviada | Estados de confirmação no mesmo componente do respectivo fluxo |
| `/ajuda`, `/termos`, `/privacidade` | `Help` com textos/contextos diferentes |

Esses endereços não equivalem a implementações independentes. A remoção de uma rota exige conferir links e testes. A única página documental confirmada para retirar a função antiga foi a de delegação nominal, agora [colaboração](equipe.md). O protótipo HTML é referência histórica, não uma segunda aplicação mantida.

## Modos e estado

- `VITE_DATA_MODE=mock`: fixtures fictícias e persistência em `sessionStorage`; cadastro mock guarda digest com salt exclusivamente para simular login, sem pretensão de autenticação segura.
- `VITE_DATA_MODE=api`: catálogo, profissionais, sessão, perfil, anúncios, contratações, avaliações, demandas e propostas via API. Erro HTTP gera mensagem; nenhuma troca automática para fixtures.
- No modo mock, contratações/demandas/propostas/denúncias persistem na sessão para permitir alternar contas no ensaio. No modo API, contratações, avaliações, demandas e propostas são sincronizadas com o PostgreSQL. Mensagens, leitura de avisos e alguns controles admin permanecem em estado local até as fases `F04`–`F07`.
- O token real dura 15 minutos e sua expiração absoluta sobrevive ao reload. Novo login é necessário após expiração.

## Direção visual e acessibilidade

Preservar o verde, Public Sans, cards e ícones de serviço do HTML original. Hero com busca e um anúncio ilustrativo destaca a finalidade do produto. Não usar fotografias do carômetro ou números de reputação inventados.

| Token | Valor |
|---|---|
| Verde principal | `#16854c` |
| Texto principal | `#233b32` |
| Fundo | `#f6f8f6` |
| Superfície | `#ffffff` |
| Bordas | `#dce5de` |
| Texto secundário | `#65776b` |
| Raios | 8 px controles, 12 px cards, 18 px hero |
| Layout | Shell com sidebar desktop; menu expansível no celular |

Inputs têm rótulo, formulários validação básica, feedback com `role=alert/status`, controles com foco visível, link para pular conteúdo, idioma `pt-BR` e respeito a movimento reduzido. Layouts usam grid adaptativo, tabelas com rolagem interna e breakpoint 760 px. Não declarar conformidade WCAG completa sem auditoria própria.

A identidade oficial foi consolidada em `web/public/images/logo.svg` e `web/public/favicon.svg`. O upload de fotos reais de serviço será integrado no card `F06`. Ver [imagens.md](imagens.md).
