# Backlog da entrega de 07/10

P0 bloqueia a entrega; P1 melhora a versão sem ampliar o produto. **Base entregue** indica código inicial disponível, não aceite automático pelo responsável. Os IDs são prontos para usar como título de issue (`W01 — revisar busca e filtros`, por exemplo). Não há tarefas financeiras reais nesta semana.

| ID | Prioridade / dono | Trabalho sobre a base | Dependência | Critério de aceite | Estimativa |
|---|---|---|---|---|---|
| G01 | P0 / líder | Confirmar escopo React web e responsáveis | — | Equipe lê este plano; competências/disponibilidade registradas | 1h |
| G02 | P0 / líder | Resolver imagens e identidade final ou manter provisórias | G01 | Inventário de imagens atualizado; nenhuma imagem com direito/origem desconhecidos | 1h |
| G03 | P0 / líder | Integrar branches, revisar CI e ambiente | A01,B01,W01,Q01 | Clone novo sobe pelos comandos do README; CI verde | 2–3h |
| G04 | P0 / líder | Congelar versão e ensaiar apresentação | Q02,Q03,G03 | Duas demonstrações sem bloqueios, limites apresentados com clareza | 2–3h |
| A01 | P0 / Caio | Revisar cadastro/login JWT, duplicidade e termos | Base API entregue | 201/400/401/409 corretos; sem cadastro admin; senha nunca retorna | 2–3h |
| A02 | P0 / Caio | Revisar perfil privado/público e conta inativa | A01 | Contatos só no privado; token de inativo recusado; campos validados | 2–3h |
| A03 | P1 / Caio | Complementar testes e documentar sessão/limites | A01,A02 | Casos relevantes negativos cobertos; documentação igual à API | 2–3h |
| B01 | P0 / Felipe | Revisar migrações PostgreSQL e seed | Base DB entregue | Banco vazio migra; reinício não duplica seed; DBteste isolado | 2–3h |
| B02 | P0 / Felipe | Revisar anúncio, proprietário, status e limite20 | B01,A01 | Cliente não publica; outro freelancer não edita; 21º ativo409; drafts ocultos | 2–3h |
| B03 | P1 / Felipe | Revisar busca/paginação e modelo futuro | B02 | Preço/categoria/texto/cidade e parâmetros inválidos testados; próximas entidades descritas | 2–3h |
| W01 | P0 / Arthur Almirante | Consolidar catálogo, filtros e estados vazios | Base React entregue,B03 | Busca/detalhe/perfil navegáveis no desktop e390 px; erro da API tem retry | 2–3h |
| W02 | P0 / Arthur Almirante | Revisar formulário e gestão de anúncios | W01,B02 | Criar draft, publicar, editar e desativar nos dois modos | 2–3h |
| W03 | P1 / Arthur Almirante | Refinar catálogo/design com imagens decididas | G02,W02 | Sem distorção/overflow; ícones continuam se imagens pendentes | 2–3h |
| W04 | P0 / Arthur | Revisar cadastro/login/perfil e sessão | A01,A02 | Aceite obrigatório; erro compreensível; reload não estende token; logout limpa sessão | 2–3h |
| W05 | P0 / Arthur | Revisar ciclo completo de contratação mock | W04 | Cliente solicita; freelancer aceita/inicia/sinaliza; cliente confirma/contesta/avalia; sem saltos | 3–4h |
| W06 | P1 / Arthur | Revisar demandas/propostas mock | W05 | Publicar, propor e aceitar gera contratação coerente; não aceitar demanda fechada | 2–3h |
| Q01 | P0 / Enzo | Rodar/revisar suites e regressões por perfil | W01,W04,B02 | Sem erros de console; fluxo E2E mock e API verde; acessos indevidos bloqueados | 2–3h |
| Q02 | P0 / Enzo | Consolidar admin/denúncia/disputa/CSV mock | W05 | Cinco áreas abrem; denúncia na fila; decisão de disputa; CSV utilizável | 2–3h |
| Q03 | P0 / Enzo | Validar mobile e roteiro final | Q01,Q02 | 390 px sem rolagem horizontal; menu e formulários utilizáveis; evidência de execução | 2–3h |
| Q04 | P1 / Enzo | Revisar mensagens, notificações, financeiro mock | Q02 | Ações simuladas coerentes e rotuladas; sem solicitar cartão/CPF/dados bancários reais | 1–2h |

## Definition of Done

Uma tarefa termina quando satisfaz seu aceite, passa as verificações relevantes, atualiza documentos/tipos afetados e recebe revisão de outro integrante. Dados de teste são fictícios; não commitar `.env`, tokens, builds ou logs. O PR deve explicar o comportamento e a validação executada.

## Backlog após 07/10

| ID futuro | Área | Resultado necessário |
|---|---|---|
| F01 | Contratação | Persistir UC03/UC06, histórico, participantes e snapshots |
| F02 | Prazos | Jobs idempotentes48h/5 dias com testes de relógio |
| F03 | Avaliação | UC04 persistente, média/nota, janela/imutabilidade e resposta |
| F04 | Admin | Provisionar admin, gerenciar categorias/usuários e registrar auditoria |
| F05 | Moderação | Denúncias/disputas persistentes e autorização para decisão |
| F06 | Catálogo | Upload até 5 imagens/5 MB, storage e paginação real no web |
| F07 | Comunicação | Recuperação de senha/verificação de e-mail, mensagens e notificações |
| F08 | Demandas | Refinar contrato e persistir demandas/propostas com unicidade |
| F09 | Financeiro | Escolher gateway, especificar comissão, webhooks/reembolsos/ledger e conciliação |
| F10 | Operação | Termos definitivos, retenção, backup, observabilidade, rate limit e teste de carga |

As etapas futuras precisam de novo prazo e estimativa; não são promessas de conclusão em 07/10.
