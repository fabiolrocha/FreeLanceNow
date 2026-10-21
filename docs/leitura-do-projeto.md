# Leitura dos materiais e decisões atuais

Revisado em **21/10/2026**. Este documento resume a análise inicial das fontes e atualiza as divergências resolvidas. Não substitui a especificação atual nem constitui uma nova inspeção integral dos arquivos binários.

Na análise inicial, foram examinados o documento de visão `.doc`, os DOCX completos incluindo tabelas, os PDFs em todas as páginas, os textos dos slides e suas imagens, o BMC, o conteúdo visual do protótipo HTML, seu script de navegação, o runtime `support.js` e o roadmap HTML. Os diagramas e as imagens embutidas foram inspecionados junto às extrações textuais. Arquivos duplicados em `uploads/` foram comparados por SHA-256; cópias idênticas foram preservadas como parte da exportação.

## O que cada fonte acrescenta

| Fonte | Conteúdo encontrado | Uso como referência |
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

A revisão de escopo em 21/10 identificou que o HTML já contém feeds de cliente/freelancer e um campo de publicação. F11 substitui o Dashboard inicial pelo feed misto autenticado e recupera a composição em três colunas, conforme a [especificação do feed](superpowers/specs/2026-10-21-feed-inicial-design.md).

O HTML anuncia “42 telas”, mas contém variações e estados adicionais (confirmações, abas e formulários). A matriz atual em [frontend.md](frontend.md) usa **rotas e fluxos verificáveis**, sem tratar a contagem editorial como requisito. O HTML original tem largura mínima de desktop; a versão React acrescenta adaptação para celular.

## Divergências e decisões

| Divergência | Decisão atual | Origem da decisão |
|---|---|---|
| React Native mencionado, seguido de React somente web | React web; nenhuma aplicação Expo/Native nesta entrega | Resposta explícita do líder |
| Vue/admin separado em roadmap antigo | Uma aplicação React com administração mock/API por perfil; F04/F05 persistentes nesta branch | Escopo atual; evita um terceiro frontend |
| Distribuição nominal proposta na organização inicial | Sem pessoas específicas por caso, área, arquivo ou revisão; antiga página de delegação substituída por guia de colaboração | Orientação do grupo em 21/10; ver `equipe.md` |
| Usuário informou não haver repositório | Já existiam `.git`, `main` e remoto `fabiolrocha/FreeLanceNow` | Inspeção do workspace; histórico preservado |
| Financeiro aparece como central no pitch/HTML e futuro em especificações | Telas financeiras simuladas agora; gateway, custódia e conciliação depois | Corte explícito da primeira entrega |
| Java 21 / Boot 3 em planejamento antigo | Java 21 / Spring Boot 4.1.1 na base do repositório | `pom.xml` e decisão registrada em `decisoes.md` |
| Prazos de 48h, 5 dias, 7 dias | API implementa jobs de 48h/5 dias e janela de avaliação de 7 dias | F01/F02/F03 e testes existentes; mock não equivale ao job agendado |
| Fotos de pessoas nos materiais | Carômetro não vira imagem de usuários; marca SVG, iniciais e ícones disponíveis | Decisões de `imagens.md`; upload ainda pendente |

## Lacunas para o grupo resolver

- Uso de outras páginas/telas: apenas a função de delegação nominal foi confirmada como descontinuada. As demais rotas existem; revisar o uso com o grupo antes de remover.
- Storage e upload de fotos de serviço; marca SVG e avatares por iniciais já estão definidos em [imagens.md](imagens.md).
- Categorias finais e política comercial: comissão planejada de 10% para Stripe Sandbox, ainda sem fluxo financeiro implementado.
- Fonte e data dos números de mercado do pitch; não os apresentar como medição do projeto.
- Termos, retenção/exclusão de dados e suporte para uma versão pública; os textos atuais são acadêmicos.
- Implementação de upload/anexos, comunicação e financeiro; F04/F05 agora persistem gestão, denúncias/evidência textual e auditoria. Restante detalhado em F06/F07/F09/F10. OAuth/2FA permanecem como evolução futura, sem entrega confirmada.
- Neon, Stripe e Resend são escolhas de provedores, não evidência de implantação nem de fluxos externos funcionando.

O [inventário](referencias/inventario.json) permite provar que a realocação não alterou nenhum dos 26 arquivos relevantes. Os artefatos de sistema, como `.DS_Store`, não fazem parte da documentação funcional.
