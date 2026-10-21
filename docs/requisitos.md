# Requisitos e rastreabilidade

Revisado em **21/10/2026**, conforme a base integrada. Referência principal: `originais/Documento Casos de Uso Final.docx`, v1.2. As regras abaixo traduzem o material em critérios de implementação. “Mock” significa comportamento demonstrativo no navegador; “API” significa verificação e persistência no backend. “Futuro” significa trabalho não entregue nesta base.

| ID | Regra | Implementação atual | Continuação |
|---|---|---|---|
| RN01 / UC01 | E-mail obrigatório e único, nome até 100, telefone brasileiro | API normaliza e-mail; constraint única; DTO validado | Verificação de e-mail e recuperação real |
| RN02 / UC01 | Senha com pelo menos 8 caracteres, letras e números | API bcrypt; limite técnico de 72 bytes; frontend valida | Política de tentativas/rate limit e 2FA |
| RN03 / UC01 | Perfis cliente/freelancer; administrador não é cadastro público | API rejeita `ADMIN`; rotas React por perfil | Provisionamento administrativo controlado |
| RN04 / UC01 | Aceite explícito de termos e tratamento de dados | API guarda versão `academic-v1` e data; checkbox obrigatório | Texto definitivo e mecanismo de direitos do titular |
| RN05 / UC02 | Anúncio: título até 80, descrição até 500, preço positivo, prazo positivo, categoria ativa | API e frontend; precisão monetária 2 casas, prazo técnico 1–365 | Refinar limite de prazo com o grupo |
| RN06 / UC02 | Até 20 anúncios ativos por freelancer | API com bloqueio do usuário na transação; mock valida limite | Teste de concorrência e carga |
| RN07 / UC02 | Rascunho, ativo e inativo; edição pelo dono | API preserva registros e restringe proprietário; público vê ativos | Histórico/auditoria de alterações |
| RN08 / UC02 | Até 5 imagens JPG/PNG, cada uma até 5 MB | Ícones provisórios | Storage, validação real de conteúdo, tamanho e autorização |
| RN09 / UC03 | Buscar por texto, categoria, localização, preço, avaliação | API: texto, categoria, cidade exata, faixa de preço, nota mínima (`minRating`) e paginação; frontend filtra catálogo carregado | Paginação server-side no React (`F06`) |
| RN10 / UC03 | Data futura, descrição até 300, endereço opcional, uma solicitação pendente por cliente/serviço | API e frontend com lock transacional e índice único parcial | Notificações externas por e-mail (`F07`) |
| RN11 / UC03 | Freelancer responde em até 48 horas; cancela automaticamente após prazo | Job idempotente na API com `Clock` injetável e testes de relógio | Notificação de cancelamento (`F07`) |
| RN12 / UC06 | `PENDENTE → ACEITO → EM_ANDAMENTO → AGUARDANDO_CONFIRMACAO → CONCLUIDO` | API transacional (`contract` + `contract_event`), snapshots de título/preço e React integrado | — |
| RN13 / UC06 | Freelancer sinaliza; cliente confirma ou contesta; disputa administrada | API/React persistem motivo e decisão administrativa auditada; ADMIN provisionado por opt-in (`F04`/`F05`) | Arquivos de evidência (`F06`) e avisos (`F07`) |
| RN14 / UC06 | Confirmação automática após 5 dias | Job idempotente na API (`AGUARDANDO_CONFIRMACAO → CONCLUIDO`) com testes de relógio | Repasse automático no gateway (`F09`) |
| RN15 / UC04 | Avaliação de 1 a 5, concluída, única, imutável, em até 7 dias; comentário até 500 | API e frontend persistentes (`review`), média com 1 decimal e resposta única do profissional até 200 caracteres | — |
| RN16 / UC05 | Admin gerencia categorias/usuários; suspensão preserva histórico | API/React gerenciam usuários/categorias; suspensão bloqueia token/login e preserva histórico; alterações auditadas (`F04`) | Avisos externos (`F07`); exclusão definitiva fora desta entrega |
| RN17 / UC05 | Denúncias, moderação e exportação CSV | API/React persistem denúncias de serviços/avaliações, relato/cópia textual, decisão fundamentada e auditoria; CSV local deriva de dados reais (`F05`) | Anexos (`F06`) e avisos externos (`F07`) |
| RN18 / protótipo | Demandas, propostas e aceite | API e frontend persistentes (`demand` + `proposal`), unicidade de proposta pendente e aceite gerando `contract` em `ACEITO` (`F08`) | — |
| RN19 / protótipo | Mensagens e notificações | Mock local; sem entrega para outras pessoas | Contrato, persistência e canal de envio |
| RN20 / pitch/HTML | Pix/cartão/boleto, carteira, custódia e saque | Somente exploração visual com valores fictícios | Gateway, webhooks idempotentes, livro financeiro e conciliação |

## Mudança de escopo — feed (F11)

| ID | Regra | Estado atual | Continuação |
|---|---|---|---|
| RN21 / mudança de escopo 21/10 | O início do aplicativo é um feed de publicações e oportunidades, com textos sobre trabalhos e ações para conectar pessoas/necessidades | Implementado na `main`; feed misto após login | F11: texto persistente, serviço/demanda, filtros/paginação, retirada própria e moderação auditada |
| RN22 / HTML e mudança de escopo | Manter continuidade visual do HTML entre feed, publicação, serviço, perfil e demandas | Feed em três colunas desktop/uma no celular; cabeçalho/menu compartilhados com publicação, detalhe e perfil | Continuar refinamentos específicos conforme validação do grupo |

A [especificação aprovada do feed](superpowers/specs/2026-10-21-feed-inicial-design.md) não transforma curtidas, comentários, seguidores ou fotos em funcionalidades já entregues. Regras existentes de proposta privada e contratação continuam válidas.

Os IDs RN/UC identificam regras e casos de uso; não atribuem pessoas. A implementação e a revisão são combinadas pela equipe conforme [colaboração](equipe.md). Para rotas demonstrativas e componentes reutilizados, consulte [frontend](frontend.md).

Os requisitos não funcionais dos documentos (páginas/busca P95 até 3s, solicitação até 5s, notificação até 10s, disponibilidade 99% e 200 acessos simultâneos) são **metas futuras ainda não medidas**. A verificação atual cobre funcionalidade e layout de 390 px/desktop; não certifica SLA ou capacidade de produção.

A API não expõe e-mail, telefone nem hash em perfis públicos. Tokens duram 15 minutos; não há refresh token ou revogação individual antecipada nesta base. Todas as entidades e endpoints administrativos futuros devem aplicar autorização no backend, além das rotas React.
