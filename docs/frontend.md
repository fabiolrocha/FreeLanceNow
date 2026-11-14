# Frontend React web

Revisado em **09/11/2026**, a partir de `web/src/App.tsx`, `Layout.tsx` e dos módulos de dados. React 19, TypeScript 6, Vite 8 e React Router 7. Features são carregadas por `lazy`/`Suspense`; o shell e os componentes compartilhados ficam em `app/` e `components/`. Fonte Public Sans instalada localmente. A marca oficial é exibida via `/images/logo.svg` e `/favicon.svg`; ícones Lucide ilustram as categorias de serviço até o upload de mídia (`F06`).

## Correção de direção: início como feed

O HTML fornecido contém feeds de cliente/freelancer, publicação no topo, conteúdo em coluna central e apoio lateral de perfil, oportunidades e contratações. F11 recupera essa hierarquia e separa o feed inicial do Dashboard de gestão.

F11 transforma `/inicio` no feed de publicações/oportunidades e conserva `/painel` para gestão. O layout retoma o HTML e se adapta a uma coluna no celular; o cabeçalho e o menu da conta substituem a sidebar fixa nas áreas de cliente/freelancer, evitando uma quarta coluna. Os fluxos de serviço, demanda e contratação continuam ligados às ações de cada publicação.

A [especificação detalhada](superpowers/specs/2026-10-21-feed-inicial-design.md) foi aprovada. O feed possui campo de publicação (1–500 caracteres, categoria e serviço próprio opcionais), filtros tipo/categoria e páginas de 20 itens. Os formulários de serviço/demanda e as páginas de detalhe/perfil reutilizam o shell de descoberta e os fluxos existentes. O modo API trata erros sem fallback silencioso; o mock preserva publicações nesta sessão.

O feed e o cabeçalho variam por perfil:

| Perfil | Filtro inicial e abas | Cabeçalho | Coluna lateral |
|---|---|---|---|
| Cliente | Serviços; também Publicações, Minhas demandas e Tudo | Feed, Serviços, Profissionais, Minhas demandas | Contratações em andamento e Conheça profissionais |
| Freelancer | Demandas abertas; também Publicações e Tudo (anúncios de outros freelancers só em Tudo) | Feed, Demandas abertas, Meus serviços, Solicitações | Solicitações pendentes, contratações em andamento e Meus serviços |
| Admin | Tudo; também Publicações, Serviços e Demandas | Sem links do feed; menu administrativo | Contratações em andamento e profissionais |

A separação é de apresentação: a visibilidade dos itens continua aplicada pela API (`GET /feed`).

## Matriz de telas e acesso

| Fluxo atual | Rotas registradas | Perfil/participação | Dados |
|---|---|---|---|
| Início/busca/detalhe | `/`, `/servicos`, `/servicos/:id` | Público | Mock ou API (com filtro por nota mínima) |
| Profissionais/perfil | `/profissionais`, `/profissionais/:id` | Público | Mock ou API (média com 1 decimal e avaliações reais) |
| Entrada/cadastro | `/login`, `/cadastro` | Público | Auth mock/API |
| Recuperação de acesso | `/recuperar-senha`, `/redefinir-senha?token=` | Público | API: pede o link por e-mail e define nova senha; mock apenas registra o pedido |
| Confirmação de e-mail | `/verificar-email?token=` | Público | API: confirma o e-mail do link do cadastro. Enquanto não confirmado, um aviso no topo oferece "Reenviar link" (ADR25) |
| Perfil/edição/complemento | `/perfil`, `/perfil/editar`, `/perfil/completar` | Autenticado | Mock ou API. Edição traz foto (só API), área de atendimento (freelancer), troca de senha e exclusão de conta com senha |
| Minhas denúncias | `/denuncias` | Autenticado | Mock ou API: estado da análise e nota da moderação |
| Feed | `/inicio` | Cliente/freelancer (admin vai para `/admin/usuarios`) | Mock ou API: publicações, serviços e demandas autorizadas, filtros e paginação. Rótulos do compositor e textos laterais mudam por perfil |
| Dashboard de gestão | `/painel` | Freelancer | Mock ou API: métricas reais, propostas pendentes e demandas abertas compatíveis (categorias dos anúncios e cidade primeiro) |
| Minhas propostas | `/propostas` | Freelancer | Mock ou API: filtro por situação, retirada de pendentes e link para a contratação gerada |
| Gestão de serviços | `/meus-servicos`, `/meus-servicos/novo`, `/meus-servicos/:id/editar` | Freelancer | Mock ou API; rascunho ou inativo nunca contratado pode ser excluído |
| Solicitação | `/servicos/:id/solicitar` | Cliente | Mock ou API (`F01`) |
| Solicitação enviada | `/contratacoes/:id/enviada` | Autenticado | Confirmação visual do envio, com link para o detalhe da contratação (`F01`) |
| Lista/detalhe | `/contratacoes`, `/contratacoes/:id`, `/solicitacoes` (freelancer) | Lista: cliente/freelancer; detalhe: participantes e admin | Mock ou API (`F01`). O detalhe mostra o próximo passo conforme status e perfil (`nextStepHint`) |
| Conclusão/confirmar/contestar | `/contratacoes/:id/concluir`, `/contratacoes/:id/confirmar`, `/contratacoes/:id/contestar` | Freelancer conclui; cliente confirma/contesta | Mock ou API (`F01`) |
| Avaliação e resposta | `/contratacoes/:id/avaliar`, `/contratacoes/:id/avaliacao-publicada`; resposta no detalhe | Cliente avalia; freelancer responde | Mock ou API (`F03`) |
| Disputa | `/contratacoes/:id/disputa` | Participantes | Motivo, quem abriu e decisão da administração lidos do histórico; sem disputa, a tela informa isso |
| Cancelar contratação | `/contratacoes/:id/cancelar` | Participantes | Contratação aceita, antes de iniciar; motivo obrigatório |
| Demandas/propostas | `/demandas`, `/demandas/nova`, `/demandas/:id`, `/demandas/:id/proposta`, `/demandas/:id/proposta/enviada` | Cliente/freelancer (detalhe também admin) | Mock ou API (`F08`): filtros por categoria e cidade, "Mostrar mais", marcação de demanda já respondida |
| Editar/aceitar | `/demandas/:id/editar`, `/demandas/:id/propostas/:pid/aceitar` | Cliente dono | Edição só sem propostas; cancelamento no detalhe; aceite escolhe data e endereço da contratação |
| Avisos/chat | `/notificacoes`, `/mensagens?contratacao=:id` | Avisos: autenticado; chat: cliente/freelancer participante | Mock ou API: avisos persistentes com lido/não lido e contador no cabeçalho; conversa por contratação. Sem e-mail (`F07`) |
| Carteira/transação | `/carteira`, `/transacao` | Cliente/freelancer | Mock: simulação financeira. API: tela "Em breve" e item fora do menu até `F09` (ADR27) |
| Pagamento | `/pagamento`, `/pagamento/confirmado` | Cliente | Mock: simulação. API: "Em breve" (ADR27) |
| Saque | `/saque`, `/saque/enviado` | Freelancer | Mock: simulação. API: "Em breve" (ADR27) |
| Denúncia | `/denunciar`, `/denunciar/enviada` | Cliente/freelancer | Mock ou API: aberta pelo link "Denunciar" do anúncio, avaliação ou publicação, com motivos por tipo; sem conteúdo escolhido, a tela orienta onde denunciar (`F05`). O dono e o admin não veem o link no próprio anúncio |
| Gestão e relatórios | `/admin/usuarios`, `/admin/categorias`, `/admin/relatorios` | Admin | Mock ou API: usuários/categorias, filtros, métricas por período, CSV e auditoria (`F04`). Perfis e status traduzidos; conta excluída aparece como "Excluída", sem ação; auditoria mostra ação, alvo e valores em português |
| Transações administrativas | `/admin/transacoes` | Admin | Mock: simulação. API: "Em breve" e item fora do menu (ADR27) |
| Moderação | `/admin/moderacao` | Admin ativo | Mock ou API: denúncias/decisões persistentes, remoção lógica e disputas auditadas (`F05`) |
| Ajuda/termos/privacidade | `/ajuda`, `/termos`, `/privacidade` | Público | Textos de produção (versão 2026-11, LGPD); no mock, aviso de dados fictícios. Contato opcional via `VITE_SUPPORT_EMAIL` |
| URL desconhecida | Qualquer rota não encontrada | Público | Tela 404 com retorno ao início |

Guards React protegem os grupos de rotas por role e explicam a restrição pelo perfil exigido ("Esta área é para contas de cliente", "...de profissional", "...exclusiva da administração"). O menu lateral do freelancer prioriza o trabalho (painel, solicitações, contratações, demandas, propostas, serviços); o do cliente prioriza busca, profissionais, demandas e contratações. Status de contratação usam o feminino ("Aceita", "Concluída", "Recusada", "Cancelada") e notas usam vírgula decimal (`ratingLabel`). Participação, estado e proprietário são verificados nos fluxos e, nas funcionalidades reais, pelo backend. O prefixo `/admin` redireciona para `/admin/usuarios`; não é outra tela de gestão.

## Telas demonstrativas e componentes reutilizados

Financeiro continua simulado (F09). Recuperação de senha usa a API e o e-mail do Resend. Avisos e chat por contratação usam a API desde o PR #45. Gestão e moderação agora usam a API em F04/F05, incluindo denúncia de avaliações pelo perfil público, remoção lógica e auditoria. O modo mock mantém a demonstração anterior. ADMIN real depende de bootstrap explícito; não há credenciais padrão. Não foram classificados como abandonados apenas por serem simulados.

| Rotas/estados | Reutilização atual |
|---|---|
| `/inicio` e `/painel` | `Feed` e `Dashboard` separados; `/painel` exige freelancer |
| `/perfil/editar` e `/perfil/completar` | Mesmo `EditProfile`, com título contextual |
| `/contratacoes` e `/solicitacoes` | `ContractList` com contexto de solicitações para freelancer |
| Ações de contratação e `/contratacoes/:id/disputa` | `ContractAction` varia conforme URL e estado |
| Proposta/enviada, pagamento/confirmado, saque/enviado e denúncia/enviada | Estados de confirmação no mesmo componente do respectivo fluxo |
| `/ajuda`, `/termos`, `/privacidade` | `Help` com textos/contextos diferentes |

Esses endereços não equivalem a implementações independentes. A remoção de uma rota exige conferir links e testes. A única página documental confirmada para retirar a função antiga foi a de delegação nominal, agora [colaboração](equipe.md). O protótipo HTML é referência histórica, não uma segunda aplicação mantida.

## Modos e estado

- `VITE_DATA_MODE=mock`: fixtures fictícias e persistência em `sessionStorage`; cadastro mock guarda digest com salt exclusivamente para simular login, sem pretensão de autenticação segura.
- `VITE_DATA_MODE=api`: feed/publicações, catálogo, profissionais, sessão, perfil, anúncios, contratações, avaliações, demandas e propostas via API. Erro HTTP gera mensagem; nenhuma troca automática para fixtures.
- No modo mock, publicações/contratações/demandas/propostas/denúncias persistem na sessão para permitir alternar contas no ensaio. No modo API, contratações, avaliações, demandas e propostas são sincronizadas com o PostgreSQL. Denúncias e ações administrativas usam `web/src/data/admin.ts` no modo API; avisos e mensagens usam `web/src/data/inbox.ts`; o estado local fica restrito ao mock e ao financeiro ainda simulado. As telas administrativas tratam carregamento, falhas e nova tentativa.
- O access token dura 15 minutos e é renovado 60 s antes de expirar, ou após um 401, com o refresh token de 30 dias. Se a renovação falhar, a sessão é apagada e a pessoa volta ao login.
- **Manter conectado** (padrão) guarda a sessão em `localStorage`; desmarcado, em `sessionStorage`.
- Rota protegida aberta sem sessão leva ao login e, depois dele, de volta à página pedida. Destinos externos e telas de autenticação são ignorados.
- A troca de senha fica em **Minha conta → Segurança**.

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

A identidade oficial foi consolidada em `web/public/images/logo.svg` e `web/public/favicon.svg`. No modo API, o formulário de serviço envia até 5 fotos JPG/PNG (prévia local, validação de tipo/tamanho/quantidade e remoção); a primeira vira capa no card e a galeria aparece no detalhe. No modo mock, o envio fica desativado e o ícone da categoria continua. Ver [imagens.md](imagens.md).

No painel do freelancer, anúncios removidos pela moderação exibem esse estado e não oferecem edição/republicação. Relatórios administrativos exportam dados reais filtrados; a auditoria mostra até 200 eventos recentes sem filtro de período. Filtros de período dos totais usam a data de criação dos registros, não a data de cada transição.
