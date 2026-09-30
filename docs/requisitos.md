# Requisitos e rastreabilidade

Referência principal: `originais/Documento Casos de Uso Final.docx`, v1.2. As regras abaixo traduzem o material em critérios de implementação. “Mock” significa comportamento demonstrativo no navegador; “API” significa verificação e persistência no backend. “Futuro” significa trabalho não entregue nesta base.

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
| RN09 / UC03 | Buscar por texto, categoria, localização, preço, avaliação | API: texto, categoria, cidade exata, faixa de preço e paginação; frontend filtra catálogo carregado | Filtro por nota após avaliações reais; paginação server-side no React |
| RN10 / UC03 | Data futura, descrição até 300, endereço opcional, uma solicitação pendente por cliente/serviço | Mock | API, constraint/concorrência e notificações |
| RN11 / UC03 | Freelancer responde em até 48 horas; cancela automaticamente após prazo | Prazo exibido no mock | Job idempotente e testes de relógio |
| RN12 / UC06 | `PENDENTE → ACEITO → EM_ANDAMENTO → AGUARDANDO_CONFIRMACAO → CONCLUIDO` | Mock com transições por ator e histórico | API transacional, snapshots de preço e auditoria |
| RN13 / UC06 | Freelancer sinaliza; cliente confirma ou contesta; disputa administrada | Mock; admin resolve para concluído ou execução | API, provas/anexos, fila e notificações |
| RN14 / UC06 | Confirmação automática após 5 dias | Texto/fluxo mock | Job e política de disputa |
| RN15 / UC04 | Avaliação de 1 a 5, concluída, única, imutável, em até 7 dias; comentário até 500 | Mock valida nota, prazo e unicidade | API, média com 1 decimal; resposta do profissional até 200 |
| RN16 / UC05 | Admin gerencia categorias/usuários; suspensão preserva histórico | Telas simuladas; API recusa login/token de usuário inativo | Endpoints administrativos e trilha de auditoria |
| RN17 / UC05 | Denúncias, moderação e exportação CSV | Mock/CSV local com neutralização de fórmulas | API com fila, autorização e auditoria |
| RN18 / protótipo | Demandas, propostas e aceite | Mock cria contratação fictícia | Especificar estados e implementar persistência |
| RN19 / protótipo | Mensagens e notificações | Mock local; sem entrega para outras pessoas | Contrato, persistência e canal de envio |
| RN20 / pitch/HTML | Pix/cartão/boleto, carteira, custódia e saque | Somente exploração visual com valores fictícios | Gateway, webhooks idempotentes, livro financeiro e conciliação |

Os requisitos não funcionais dos documentos (páginas/busca P95 até 3s, solicitação até 5s, notificação até 10s, disponibilidade 99% e 200 acessos simultâneos) são **metas futuras ainda não medidas**. A verificação atual cobre funcionalidade e layout de 390 px/desktop; não certifica SLA ou capacidade de produção.

A API não expõe e-mail, telefone nem hash em perfis públicos. Tokens duram 15 minutos; não há refresh token ou revogação individual antecipada nesta base. Todas as entidades e endpoints administrativos futuros devem aplicar autorização no backend, além das rotas React.
