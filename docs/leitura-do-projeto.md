# Leitura integral dos materiais

Foram examinados o documento de visão `.doc`, os DOCX completos incluindo tabelas, os PDFs em todas as páginas, os textos dos slides e suas imagens, o BMC, o conteúdo visual do protótipo HTML, seu script de navegação, o runtime `support.js` e o roadmap HTML. Os diagramas e as imagens embutidas foram inspecionados junto às extrações textuais. Arquivos duplicados em `uploads/` foram comparados por SHA-256; cópias idênticas foram preservadas como parte da exportação.

## O que cada fonte acrescenta

| Fonte | Conteúdo encontrado | Efeito sobre o início |
|---|---|---|
| Documento de Visão Final, v1.1 | Marketplace responsivo, clientes, freelancers e administrador; futuras integrações e aplicativo móvel; campos de template ainda vazios | Define o produto, mas não é uma especificação final para lançamento |
| Documento Casos de Uso Final, v1.2 | UC01–UC06, validações, limites, prazos, permissões, disputas e auditoria | Fonte principal das regras funcionais |
| Documento de Arquitetura | Java/Spring Boot, PostgreSQL 15, camadas, JWT/bcrypt e visões 4+1; comunicação e armazenamento futuros | API em módulos de domínio e banco relacional com migrações |
| FreeLanceNOW DOCX / PDF | Apresentação do Grupo 2, integrantes/carômetro e contextualização | Contexto acadêmico; composição atual do grupo informada pelo líder prevalece |
| Pitch Deck Definitivo | Problema, proposta de valor, reputação, intermediação financeira e hipóteses de mercado | Benefícios como intenção do produto; números de mercado exigem fontes antes de publicação |
| Apresentação Documentação PPTX | Visão geral e material visual de documentação | Fonte histórica, sem fotos prontas de catálogo |
| BMC.png | Segmentos de clientes, canais, receitas por intermediação e parceiros | Pagamentos e parcerias entram em fases posteriores |
| Protótipo HTML + support.js | Navegação de cliente/freelancer, catálogo, demandas, propostas, pagamentos, mensagens, notificações e cinco áreas administrativas | Convertido em rotas React com estado de demonstração; runtime gerado não foi reutilizado |
| Roadmap HTML antigo | 18 etapas (0–17), React, backend, banco, aplicação administrativa separada e integrações | Referência de longo prazo, replanejada para o prazo atual |

O HTML anuncia “42 telas”, mas contém variações e estados adicionais (confirmações, abas e formulários). A matriz atual em [frontend.md](frontend.md) usa **rotas e fluxos verificáveis**, sem tratar a contagem editorial como requisito. O HTML original tem largura mínima de desktop; a versão React acrescenta adaptação para celular.

## Divergências e decisões

| Divergência | Decisão atual | Origem da decisão |
|---|---|---|
| React Native mencionado, seguido de React somente web | React web; nenhuma aplicação Expo/Native nesta entrega | Resposta explícita do líder |
| Vue/admin separado em roadmap antigo | Uma aplicação React com área administrativa simulada e acesso por perfil | Escopo atual e prazo curto; evita um terceiro frontend |
| Documento menciona pessoas diferentes/quantidades anteriores | Seis: líder, Caio, Arthur Almirante, Arthur, Felipe e Enzo | Lista atual fornecida pelo líder |
| Usuário informou não haver repositório | Já existiam `.git`, `main` e remoto `fabiolrocha/FreeLanceNow` | Inspeção do workspace; histórico preservado |
| Financeiro aparece como central no pitch/HTML e futuro em especificações | Telas financeiras simuladas agora; gateway, custódia e conciliação depois | Corte explícito da primeira entrega |
| Java 21 / Boot 3 em planejamento antigo | Java 21 / Spring Boot 4.1.1 na base gerada hoje | Spring Initializr atual; decisão registrada em `decisoes.md` |
| Prazos de 48h, 5 dias, 7 dias | Fluxo mock respeita sequência e janela de avaliação; jobs de prazo futuro | UC03, UC04, UC06; nenhuma promessa de automação já pronta |
| Fotos de pessoas nos materiais | Carômetro não vira imagem de usuários; produto usa iniciais e ícones | Imagens do produto ainda pendentes de decisão do grupo |

## Lacunas para o grupo resolver

- Especialidades e disponibilidade dos cinco colegas: a distribuição inicial é uma proposta revisável.
- Seleção de fotos de serviço, avatares e logo final: ver [imagens.md](imagens.md).
- Categorias finais, taxa de comissão e política comercial: os valores atuais são ilustrativos.
- Fonte e data dos números de mercado do pitch; não os apresentar como medição do projeto.
- Termos, retenção/exclusão de dados e suporte para uma versão pública; os textos atuais são acadêmicos.
- Requisitos de upload, moderação real, 2FA/OAuth, notificações e rotinas automáticas de prazos.

O [inventário](referencias/inventario.json) permite provar que a realocação não alterou nenhum dos 26 arquivos relevantes. Os artefatos de sistema, como `.DS_Store`, não fazem parte da documentação funcional.
