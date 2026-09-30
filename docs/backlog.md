# Backlog — marco de 07/10 e entrega final de 18/11/2026

P0 bloqueia a entrega; P1 melhora a versão sem ampliar o produto. **Base entregue** indica código inicial disponível, não aceite automático pelo responsável. Os IDs são prontos para usar como título de issue (`W01 — revisar busca e filtros`, por exemplo). Não há tarefas financeiras reais nesta semana.

Os cards G01–G04, A01–A03, B01–B03, W01–W06 e Q01–Q04 cobrem o **marco inicial de 07/10**. Os cards F01–F10 cobrem as integrações planejadas para a **entrega final de 18/11/2026**.

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

## Integrações planejadas até 18/11

| ID | Área | Resultado necessário | Período sugerido | Responsáveis propostos |
|---|---|---|---|---|
| F01 | Contratação | Persistir UC03/UC06, histórico, participantes e snapshots | 08–14/10 | Felipe + Arthur |
| F02 | Prazos | Jobs idempotentes de 48h/5 dias com testes de relógio | 08–14/10 | Felipe + Enzo |
| F03 | Avaliação | UC04 persistente, média/nota, janela/imutabilidade e resposta | 15–21/10 | Felipe + Arthur |
| F04 | Admin | Provisionar admin, gerenciar categorias/usuários e registrar auditoria | 15–21/10 | Caio + Arthur Almirante |
| F05 | Moderação | Denúncias/disputas persistentes e autorização para decisão | 15–21/10 | Caio + Enzo |
| F06 | Catálogo | Upload até 5 imagens/5 MB, storage e paginação real no web | 22–28/10 | Felipe + Arthur Almirante |
| F07 | Comunicação | Recuperação de senha/verificação de e-mail, mensagens e notificações | 22–28/10 | Caio + Arthur |
| F08 | Demandas | Refinar contrato e persistir demandas/propostas com unicidade | 15–21/10 | Felipe + Arthur |
| F09 | Financeiro | Gateway de testes, comissão, webhooks/reembolsos/ledger e conciliação | Decisões em 08–09/10; implementação em 29/10–04/11 | Líder + Felipe + Caio + Arthur Almirante |
| F10 | Operação | Termos, retenção, backup, observabilidade, rate limit e teste de carga | 05–11/11 | Líder + Caio + Felipe + Enzo |

Datas e responsáveis são exemplos de planejamento a validar com a disponibilidade do grupo. A entrega final em **18/11/2026** é o prazo informado pelo líder. Reservar **12–16/11** para regressão e correções, **17/11** para ensaio e **18/11** para entrega. Cada card F01–F10 inclui integração da respectiva tela React à API e testes de aceite; funcionalidade só mockada não encerra esses cards. O financeiro será demonstrado no sandbox do gateway escolhido.
