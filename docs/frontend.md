# Frontend React web

React 19, TypeScript 6, Vite 8 e React Router 7. Features são carregadas por `lazy`/`Suspense`; o shell e os componentes compartilhados ficam em `app/` e `components/`. Fonte Public Sans instalada localmente. Ícones Lucide substituem as imagens indefinidas do catálogo.

## Matriz de telas e acesso

| Fluxo do protótipo | Rotas atuais | Perfil | Dados |
|---|---|---|---|
| Início/busca/detalhe | `/`, `/servicos`, `/servicos/:id` | Público | Mock ou API |
| Profissionais/perfil | `/profissionais`, `/profissionais/:id` | Público | Mock ou API; avaliações mock |
| Entrada/cadastro/recuperação | `/login`, `/cadastro`, `/recuperar-senha` | Público | Auth mock/API; recuperação apenas visual |
| Perfil/complete | `/perfil`, `/perfil/editar`, `/perfil/completar` | Autenticado | Mock ou API |
| Dashboard | `/inicio`, `/painel` (freelancer) | Autenticado | Catálogo API; métricas de contratação mock |
| Gestão de serviços | `/meus-servicos`, `/meus-servicos/novo`, `/meus-servicos/:id/editar` | Freelancer | Mock ou API |
| Solicitação | `/servicos/:id/solicitar`, `/contratacoes/:id/enviada` | Cliente | Mock |
| Lista/detalhe | `/contratacoes`, `/contratacoes/:id`, `/solicitacoes` (freelancer) | Participantes | Mock |
| Conclusão/confirmar/contestar | `/contratacoes/:id/concluir`, `/confirmar`, `/contestar` (prefixo da contratação) | Ator da etapa | Mock |
| Disputa/avaliação | `/contratacoes/:id/disputa`, `/avaliar`, `/avaliacao-publicada` | Participantes | Mock |
| Demandas/propostas | `/demandas`, `/demandas/nova`, `/demandas/:id`, `/demandas/:id/proposta`, `/demandas/:id/proposta/enviada` | Cliente/freelancer | Mock |
| Avisos/chat | `/notificacoes`, `/mensagens` | Autenticado | Mock; chat nesta tela/sessão sem entrega externa |
| Carteira/pagamento | `/carteira`, `/pagamento`, `/pagamento/confirmado`, `/transacao` | Perfil apropriado | Simulação financeira |
| Saque | `/saque`, `/saque/enviado` | Freelancer | Simulação financeira |
| Denúncia | `/denunciar`, `/denunciar/enviada` | Autenticado | Mock; admin vê a fila na mesma sessão |
| Administração | `/admin/usuarios`, `/admin/categorias`, `/admin/moderacao`, `/admin/relatorios`, `/admin/transacoes` | Admin demo | Mock; alterações de categorias/usuários restritas à tela |
| Ajuda/termos/privacidade | `/ajuda`, `/termos`, `/privacidade` | Público | Texto acadêmico provisório |
| URL desconhecida | Qualquer rota não encontrada | Público | Tela 404 com retorno ao início |

Os sufixos de ação na tabela se referem sempre ao prefixo completo da contratação. Guards protegem rotas por role; regras de participação e transição também são verificadas no estado mock. O backend verifica sua própria autorização para as funcionalidades reais.

## Modos e estado

- `VITE_DATA_MODE=mock`: fixtures fictícias e persistência em `sessionStorage`; cadastro mock guarda digest com salt exclusivamente para simular login, sem pretensão de autenticação segura.
- `VITE_DATA_MODE=api`: catálogo, profissionais, sessão, perfil e anúncios via API. Erro HTTP gera mensagem; nenhuma troca automática para fixtures.
- Contratações/demandas/propostas/denúncias persistem na sessão para permitir alternar contas no ensaio. Mensagens, leitura de avisos e alguns controles admin são estado de tela e podem reiniciar ao navegar/recarregar.
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

Imagens ainda exigem decisão do grupo. O CSS principal usa componentes/classes consistentes; trocar ativos deve preservar dimensões, fallback e texto alternativo. Ver [imagens.md](imagens.md).
