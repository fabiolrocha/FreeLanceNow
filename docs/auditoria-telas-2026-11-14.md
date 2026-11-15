# Auditoria de telas — 14/11/2026

Varredura manual de todas as rotas do React em **modo API**, a partir da `main` (`4b88380`), com banco isolado e dados de seed. Fluxos executados de ponta a ponta: cadastro de cliente → completar perfil → solicitar serviço → chat → freelancer aceita/inicia/conclui → cliente confirma e avalia; demanda → proposta → aceite; contestação → disputa na moderação; denúncia → fila do admin. Também conferido em 375 px (sem estouro horizontal em nenhuma tela).

**Fora do escopo desta lista (ficam para a etapa final):** pagamentos (carteira, pagamento, saque, transação, `/admin/transacoes`) e deploy. Upload de fotos de anúncio está no PR em andamento (`codex/f06-upload-imagens`) e aparece aqui só onde afeta outras telas.

## O que já funciona bem

- Catálogo: busca por texto (inclusive nome do profissional), filtros de categoria/preço/nota/cidade, ordenação, detalhe do serviço, perfil público, avaliações e média.
- Ciclo de contratação completo com histórico, prazos visíveis (48 h / 5 dias / 7 dias), chat por contratação e avisos no sino.
- Demandas e propostas: publicar, propor, aceitar (gera contratação `ACEITO`).
- Admin: usuários (filtros, suspensão com motivo, CSV), categorias, fila de denúncias e disputas com justificativa, relatórios e auditoria.
- Feed: publicar, filtrar por aba, retirar publicação.
- Layout responsivo sem quebras em 375 px.

## P0 — impede um usuário comum de usar o app sozinho

| # | Tela / rota | Problema | O que fazer |
|---|---|---|---|
| 1 | `/recuperar-senha` | Tela diz "O envio de e-mail ainda está em desenvolvimento. Entre em contato com o grupo". Quem esquece a senha fica trancado. | Implementar fluxo com token (e-mail via Resend, link de 30 min) e tela "definir nova senha". |
| 2 | Conta (todas) | Não existe **alterar senha** logado (nem endpoint na API). | `PUT /users/me/password` (senha atual + nova) e seção "Segurança" no perfil. |
| 3 | Sessão | Token dura 15 min (`ttl-seconds: 900`) sem renovação, e a sessão fica em `sessionStorage`: fechar a aba ou abrir link em nova aba desloga. Usuário perde formulário no meio. | Refresh token (ou TTL maior) e persistência opcional ("manter conectado"). Ao expirar, avisar e voltar à mesma página após login. |
| 4 | `/login` | Depois do login sempre vai para `/inicio` (ou `/admin/usuarios`). Visitante que clicou "Solicitar serviço" perde o contexto. | Guardar a rota de origem no `Guard` (`state.from`) e redirecionar para ela. |
| 5 | `/contratacoes/:id/disputa` | Tela simulada: badge "Em disputa" fixo (aparece mesmo sem disputa), aviso "dados simulados", "mediação simulada", embora a API já faça mediação. | Ler status/motivo reais, mostrar decisão do admin e esconder a rota quando não houver disputa. |
| 6 | Detalhe da contratação (freelancer) | Link "Denunciar anúncio" aparece para o **dono** do anúncio. | Mostrar só para o cliente. |
| 7 | Detalhe da contratação | Depois de `ACEITO`/`EM_ANDAMENTO` nenhuma das partes consegue cancelar; só o cliente cancela enquanto `PENDENTE`. | Definir regra (ex.: cancelar com motivo até iniciar; depois, só via disputa) e expor na API e na tela. |
| 8 | Ações irreversíveis | "Aceitar proposta" (recusa as demais), "Aceitar/Recusar solicitação", "Confirmar recebimento", "Desativar serviço" executam sem confirmação. | Diálogo de confirmação explicando a consequência. |
| 9 | Textos de placeholder visíveis | "Fotos deste serviço serão definidas pelo grupo", "Fotos ainda estão em definição", "Foto de perfil será definida depois", "O cliente poderá comparar sua proposta com as demais **na demonstração**", checkbox do cadastro "Autorizo o uso dos dados **para esta demonstração**". | Trocar por texto de produto (as fotos de anúncio entram com o PR do F06). |

## P1 — funcionalidades que faltam para o app ficar completo

### Cliente

- **Demandas:** não dá para editar, encerrar ou cancelar uma demanda aberta; o detalhe não mostra categoria nem data de publicação. O formulário não pede data desejada nem endereço, e a contratação gerada pelo aceite recebe data automática e a cidade como endereço — pedir esses dados na demanda ou no aceite.
- **Propostas recebidas:** nome do profissional sem link para o perfil e sem nota média; o cliente não consegue avaliar quem está propondo.
- **Denúncias:** depois de enviar, não há onde acompanhar o status.

### Freelancer

- **Minhas propostas:** não existe tela (a API já tem `GET /proposals`). Falta listar propostas enviadas com status e permitir retirar uma proposta pendente.
- **Demandas abertas:** sem filtro de categoria/cidade e sem paginação. Qualquer profissional propõe em qualquer categoria (eletricista conseguiu propor em "Pintura"), mas o texto diz "profissionais da categoria" — decidir a regra e alinhar API e texto. O subtítulo da página é o do cliente ("Um pedido bem descrito…").
- **Painel (`/painel`):** "Oportunidades para você" lista serviços de **outros profissionais** (concorrentes); deveria listar demandas abertas compatíveis. O card "Tudo combinado… Descreva o que precisa" é texto para cliente.
- **Meus serviços:** rascunho não pode ser excluído; "1 dias" (plural errado).
- **Perfil profissional:** faltam foto, categorias/especialidades, área de atendimento e "membro desde"; o perfil público não mostra a nota média no topo.

### Conta e perfil (todos)

- Foto de perfil (avatar) — hoje só iniciais.
- Excluir ou desativar a própria conta (LGPD) e verificação de e-mail no cadastro.
- Menu "Meu perfil" abre `/perfil/editar`; deveria abrir `/perfil` (visualização).
- Menu logado não tem link para Ajuda.

### Catálogo e páginas públicas

- `/profissionais` não aparece no menu público ("Para profissionais" leva ao cadastro) e não tem busca, filtro, nota nem paginação.
- Card de destaque da landing é fixo no código ("Instalação de chuveiro elétrico · Marcos Vieira", badge "Demonstração"); usar um serviço real bem avaliado ou remover o badge.
- Detalhe do serviço: categoria do breadcrumb não é clicável; nota média não aparece junto ao título.
- Detalhe da contratação: título não leva ao serviço nem ao perfil da outra parte.

### Feed

- Após publicar, a aba continua em "Serviços" e a publicação não aparece; trocar para "Publicações" ou mostrar confirmação.
- Publicações só de texto (sem imagem, curtida ou comentário). Decidir se entra no escopo; se não, deixar claro.

### Admin

- Admin não recebe aviso de nova denúncia ou disputa (o sino fica vazio).
- Item da fila de moderação não tem link para o conteúdo denunciado.
- Não há listagem de contratações, serviços ou demandas para consulta administrativa (só via disputa → "Consultar histórico").

### Conteúdo

- `/termos` e `/privacidade` têm **o mesmo texto**, marcado como provisório ("deve ser revisado antes de disponibilizar o produto ao público"). Escrever textos reais e separados.
- `/ajuda` é curta: sem FAQ, sem canal de contato/suporte.
- Faixa no topo "Ambiente acadêmico…" e rodapé "Grupo 2 · Projeto acadêmico": decidir se ficam na versão final.

## P2 — polimento

- Telefone sem máscara e com erro genérico do navegador ("É preciso que o formato corresponda ao exigido"); mostrar o formato esperado.
- Cadastro sem "mostrar senha" e sem confirmação de senha.
- Nota exibida como `4.0`; usar `4,0` (pt-BR).
- Card de serviço repete a categoria (ícone e etiqueta).
- Ordenação da busca não vai para a URL; ao voltar, perde a ordenação.
- Título da aba do navegador é sempre "FreeLanceNow · Serviços gerais"; usar título por página.
- Bloco "Próximo passo" da contratação mostra sempre "O início depende do aceite do profissional…", em qualquer status; ajustar por status (o trecho de pagamento entra com o F09).
- Cada navegação recarrega contratos, demandas, propostas e `services?size=50` inteiros; com mais dados isso pesa e o catálogo do store para em 50 itens.

## Sugestão de ordem

1. P0 1–4 (senha e sessão) — afetam qualquer usuário.
2. P0 5–9 (disputa real, permissões, confirmações, textos de demonstração).
3. Telas que faltam: minhas propostas, gestão de demandas, painel do freelancer, alterar senha/excluir conta, avatar.
4. Admin (avisos e links), conteúdo (termos/privacidade/ajuda).
5. Polimento P2.
6. Por último: pagamentos (F09) e deploy (F10).
