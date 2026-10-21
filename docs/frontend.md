# Frontend React web

React 19, TypeScript 6, Vite 8 e React Router 7. Features são carregadas por `lazy`/`Suspense`; o shell e os componentes compartilhados ficam em `app/` e `components/`. Fonte Public Sans instalada localmente. A marca oficial é exibida via `/images/logo.svg` e `/favicon.svg`; ícones Lucide ilustram as categorias de serviço até o upload de mídia (`F06`).

## Matriz de telas e acesso

| Fluxo do protótipo | Rotas atuais | Perfil | Dados |
|---|---|---|---|
| Início/busca/detalhe | `/`, `/servicos`, `/servicos/:id` | Público | Mock ou API (com filtro por nota mínima) |
| Profissionais/perfil | `/profissionais`, `/profissionais/:id` | Público | Mock ou API (média com 1 decimal e avaliações reais) |
| Entrada/cadastro/recuperação | `/login`, `/cadastro`, `/recuperar-senha` | Público | Auth mock/API; recuperação apenas visual (`F07`) |
| Perfil/complete | `/perfil`, `/perfil/editar`, `/perfil/completar` | Autenticado | Mock ou API |
| Dashboard | `/inicio`, `/painel` (freelancer) | Autenticado | Mock ou API (catálogo e métricas de contratação reais) |
| Gestão de serviços | `/meus-servicos`, `/meus-servicos/novo`, `/meus-servicos/:id/editar` | Freelancer | Mock ou API |
| Solicitação | `/servicos/:id/solicitar`, `/contratacoes/:id/enviada` | Cliente | Mock ou API (`F01`) |
| Lista/detalhe | `/contratacoes`, `/contratacoes/:id`, `/solicitacoes` (freelancer) | Participantes | Mock ou API (`F01`) |
| Conclusão/confirmar/contestar | `/contratacoes/:id/concluir`, `/confirmar`, `/contestar` (prefixo da contratação) | Ator da etapa | Mock ou API (`F01`) |
| Avaliação e resposta | `/contratacoes/:id/avaliar`, `/avaliacao-publicada` e resposta no detalhe | Cliente / Freelancer | Mock ou API (`F03`) |
| Disputa | `/contratacoes/:id/disputa` | Participantes | Abertura via API (`F01`); mediação admin simulada (`F05`) |
| Demandas/propostas | `/demandas`, `/demandas/nova`, `/demandas/:id`, `/demandas/:id/proposta`, `/demandas/:id/proposta/enviada` | Cliente/freelancer | Mock ou API (`F08`) |
| Avisos/chat | `/notificacoes`, `/mensagens` | Autenticado | Mock; chat nesta tela/sessão sem entrega externa (`F07`) |
| Carteira/pagamento | `/carteira`, `/pagamento`, `/pagamento/confirmado`, `/transacao` | Perfil apropriado | Simulação financeira (`F09` pendente) |
| Saque | `/saque`, `/saque/enviado` | Freelancer | Simulação financeira (`F09` pendente) |
| Denúncia | `/denunciar`, `/denunciar/enviada` | Autenticado | Mock; admin vê a fila na mesma sessão (`F05`) |
| Administração | `/admin/usuarios`, `/admin/categorias`, `/admin/moderacao`, `/admin/relatorios`, `/admin/transacoes` | Admin demo | Mock; alterações de categorias/usuários restritas à tela (`F04`) |
| Ajuda/termos/privacidade | `/ajuda`, `/termos`, `/privacidade` | Público | Texto acadêmico provisório |
| URL desconhecida | Qualquer rota não encontrada | Público | Tela 404 com retorno ao início |

Os sufixos de ação na tabela se referem sempre ao prefixo completo da contratação. Guards protegem rotas por role; regras de participação e transição também são verificadas no estado mock. O backend verifica sua própria autorização para as funcionalidades reais.

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
