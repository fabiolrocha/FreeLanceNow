# Documentação do FreeLanceNow

Revisada em **21/10/2026**. A revisão documental foi integrada à `main` pelo PR #39; F04/F05 (PR #40) e F11 (revisada no PR #41) também estão na `main`. Os Markdown desta pasta descrevem o produto atual e seu planejamento; protótipo e materiais originais são fontes históricas. A documentação é mantida por entrega, **sem atribuições fixas por pessoa**.

## Mudança de escopo: feed inicial

A página inicial do aplicativo deve ser um feed de publicações e oportunidades, retomando o HTML de referência. `/inicio` agora abre o feed misto autenticado; `/painel` conserva a gestão do freelancer. A [especificação aprovada do feed](superpowers/specs/2026-10-21-feed-inicial-design.md) registra layout, publicação e fluxos implementados.

F04/F05 foram integradas à `main` pelo [PR #40](https://github.com/fabiolrocha/FreeLanceNow/pull/40). A implementação de F11, dependente de F04/F05, também foi integrada à `main`.

## Onde consultar

| Documento | Uso atual |
|---|---|
| [Escopo](escopo.md) | Produto, integrações disponíveis e entrega final |
| [Requisitos](requisitos.md) | Regras dos casos de uso, estado e rastreabilidade |
| [Arquitetura](arquitetura.md) | Camadas, módulos, ambientes e integrações |
| [Dados](dados.md) | Migrações V1–V8, tabelas e evolução planejada |
| [API](api.md) | Endpoints, payloads, transições, erros e autenticação |
| [Frontend](frontend.md) | Rotas existentes, acesso, dados reais e telas demonstrativas |
| [Desenvolvimento](desenvolvimento.md) | Instalação, variáveis, ambiente e Git |
| [Contas de desenvolvimento](contas-desenvolvimento.md) | Login local de cliente, freelancer e administrador; diferenças API/mock |
| [Testes e demonstração](testes-e-demonstracao.md) | Comandos, roteiro, evidências históricas e limites |
| [Backlog](backlog.md) | Entregas por funcionalidade, dependências e aceite |
| [Roadmap](roadmap.md) | Estado das fases, janelas sugeridas e prazo de 18/11/2026 |
| [Colaboração da equipe](equipe.md) | Branches, revisão e coordenação sem papéis fixos |
| [Decisões técnicas](decisoes.md) | Decisões atuais e histórico das escolhas |
| [Imagens](imagens.md) | Marca, ícones, avatares e requisitos de upload |
| [Leitura do projeto](leitura-do-projeto.md) | Proveniência, divergências e lacunas das fontes antigas |

## Revisão de páginas e telas

- A antiga página de **delegação de papéis** (`equipe.md`) deixou de distribuir pessoas, arquivos e revisores. O mesmo endereço agora contém apenas orientações de colaboração, preservando os links existentes.
- O checklist de revisão de 07/10 foi condensado no backlog para rastreabilidade; os cards F01–F10 representam as entregas atuais.
- A matriz de frontend distingue telas integradas à API, simulações, páginas estáticas e rotas que reutilizam componentes. Uma rota existente não comprova uso pelo grupo nem integração completa.
- Não há outras páginas confirmadas como sem uso. Antes de retirar uma, conferir referências, navegação e impacto no roteiro; registrar a decisão aqui e atualizar links e backlog.

## Fontes históricas preservadas

| Local | Finalidade |
|---|---|
| `originais/` | DOC, DOCX, PDF, PPTX e Business Model Canvas da organização inicial |
| `prototipo/` | Exportação HTML, `support.js` e `uploads/`; referências visuais com caminhos internos preservados |
| `legado/Roadmap FreeLanceNow.html` | Planejamento anterior, substituído pelo roadmap Markdown |
| `referencias/textos/` | Extrações para busca; não substituem diagramas e originais |
| [inventario.json](referencias/inventario.json) | Caminhos, tamanho e SHA-256 dos 26 arquivos preservados |

Não editar os originais para corrigir a especificação atual. Registre a decisão nos Markdown e confira a preservação com `node scripts/verify-documents.mjs`, na raiz. `api/HELP.md` é somente um ponto de entrada para os guias da API, sem contrato independente.

As fotos do carômetro e os dados pessoais dos documentos acadêmicos permanecem nos originais; não representam usuários do produto.
