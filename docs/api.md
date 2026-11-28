# Contrato da API

Revisado em **14/11/2026**, conforme controllers, DTOs e serviços da base integrada. Base local: `http://localhost:8081/api/v1`. JSON com chaves em inglês; textos da interface e mensagens de negócio em português. Autenticação: `Authorization: Bearer <accessToken>`. A API expõe os endpoints abaixo. Recuperação de senha por e-mail, renovação de sessão e troca de senha estão em [Cadastro e login](#cadastro-e-login); pagamentos (F09) estão em [Pagamentos](#pagamentos-f09); mensagens por contratação e avisos internos estão abaixo. F04/F05 acrescentam os endpoints administrativos e denúncias abaixo; ADMIN é provisionado exclusivamente por configuração explícita de inicialização, sem cadastro público.

| Método | Caminho | Acesso | Resultado |
|---|---|---|---|
| POST | `/auth/register` | Público | 201 + sessão; cliente/freelancer |
| POST | `/auth/login` | Público | 200 + sessão |
| POST | `/auth/refresh` | Público (refresh token) | 200 + nova sessão; refresh token rotacionado |
| POST | `/auth/password/forgot` | Público | 202 sempre; envia link de redefinição se a conta existir e estiver ativa |
| POST | `/auth/password/reset` | Público (token do e-mail) | 204; define nova senha |
| POST | `/auth/email/verify` | Público (token do e-mail) | 204; confirma o e-mail da conta (ADR25); link inválido ou expirado retorna 400 |
| PUT | `/users/me/notification-settings` | Autenticado | Body `{emailNotifications}`; 200 + perfil. Liga/desliga a cópia por e-mail dos avisos (ADR28) |
| GET | `/users/me/favorites` | Autenticado | 200 `{serviceIds}`, mais recentes primeiro; anúncios inativos ficam de fora |
| PUT | `/services/{id}/favorite` | Autenticado | 204; salvar de novo não duplica. 404 se o anúncio não existe ou não está ativo; 409 acima de 200 salvos |
| DELETE | `/services/{id}/favorite` | Autenticado | 204, mesmo se o anúncio não estava salvo |
| POST | `/users/me/email-verification` | Autenticado | 202; reenvia o link de confirmação; 429 se pedido há menos de 60 s; nada faz se já confirmado |
| GET | `/users/me` | Autenticado | Perfil privado |
| PUT | `/users/me` | Autenticado | Atualiza nome, telefone, cidade, bio e área de atendimento (`serviceArea`, até 150, opcional) |
| PUT | `/users/me/avatar` | Autenticado | `multipart/form-data` com a parte `file` (JPG/PNG, até 2 MB); 200 + perfil com novo `avatarVersion` |
| DELETE | `/users/me/avatar` | Autenticado | 200 + perfil sem foto |
| GET | `/users/{id}/avatar` | Público | Bytes da foto, cache de 7 dias e `nosniff`; 404 sem foto ou conta inativa |
| DELETE | `/users/me` | Cliente/freelancer | Body `{password}`; 204. Anonimiza a conta (ADR24); 400 senha errada; 409 com contratação em aberto ou para admin |
| PUT | `/users/me/password` | Autenticado | 200 + nova sessão; exige a senha atual |
| GET | `/categories` | Público | Categorias ativas |
| GET | `/freelancers` | Público | Perfis públicos ativos |
| GET | `/freelancers/{id}` | Público | Perfil público de freelancer |
| GET | `/services` | Público | Página de anúncios ativos de usuários ativos |
| GET | `/services/{id}` | Público | Anúncio ativo; draft/inativo retorna 404 |
| GET | `/freelancer/services` | Freelancer | Todos os anúncios do dono |
| POST | `/services` | Freelancer | 201 + anúncio |
| PUT | `/services/{id}` | Freelancer/dono | Atualização completa |
| PATCH | `/services/{id}/status` | Freelancer/dono | Ativa, desativa ou põe em rascunho |
| DELETE | `/services/{id}` | Freelancer/dono | 204; só rascunho ou inativo nunca contratado (409 nos demais) |
| GET | `/contracts` | Autenticado | Lista contratações do participante (ou todas para admin) |
| GET | `/contracts/{id}` | Participante/Admin | Detalhe, histórico de eventos e avaliação da contratação |
| POST | `/contracts` | Cliente | 201 + solicitação `PENDENTE` com snapshot do serviço |
| PATCH | `/contracts/{id}/status` | Participante/Admin | Transição de estado e registro em `contract_event` |
| GET | `/contracts/{id}/messages` | Participante/Admin | Conversa da contratação em ordem cronológica; admin só lê |
| POST | `/contracts/{id}/messages` | Participante | 201 + mensagem `{text}` de 1–1000 chars; 409 se a contratação foi recusada/cancelada |
| GET | `/notifications` | Autenticado | Até 50 avisos mais recentes da própria conta e total não lido |
| GET | `/notifications/unread-count` | Autenticado | `{unread}` para o contador do cabeçalho |
| POST | `/notifications/{id}/read` | Dono do aviso | Marca um aviso como lido; aviso de outra conta retorna 404 |
| POST | `/notifications/read-all` | Autenticado | Marca todos os avisos da conta como lidos |
| POST | `/contracts/{id}/review` | Cliente (autor) | 201 + avaliação única (1–5, até 500 chars, janela de 7 dias) |
| POST | `/contracts/{id}/review/reply` | Freelancer (dono) | 200 + resposta única do profissional (até 200 chars) |
| GET | `/freelancers/{id}/reviews` | Público | Lista avaliações públicas recebidas pelo profissional |
| GET | `/services/{id}/reviews` | Público | Lista avaliações públicas vinculadas ao serviço |
| GET | `/demands` | Autenticado | Demandas do cliente ou todas as demandas para freelancer/admin |
| GET | `/demands/{id}` | Autorizado | Cliente dono, admin ou freelancer com acesso à demanda aberta/que já recebeu sua proposta |
| POST | `/demands` | Cliente | 201 + nova demanda aberta (`OPEN`) |
| PUT | `/demands/{id}` | Cliente dono | Edita a demanda aberta ainda sem propostas; 409 depois da primeira proposta |
| POST | `/demands/{id}/cancel` | Cliente dono | Demanda `CANCELLED`; propostas pendentes recusadas e profissionais avisados |
| GET | `/proposals` | Autenticado | Propostas recebidas (cliente), enviadas (freelancer) ou todas (admin) |
| GET | `/demands/{id}/proposals` | Autorizado | Propostas da demanda (todas para o dono/admin ou própria para freelancer) |
| POST | `/demands/{id}/proposals` | Freelancer | 201 + proposta única `PENDING` por profissional/demanda |
| POST | `/proposals/{id}/accept` | Cliente (dono da demanda) | 200 + encerra demanda, recusa demais propostas e cria contratação `ACEITO` |
| POST | `/proposals/{id}/reject` | Cliente (dono da demanda) | 200 + marca proposta como `REJECTED` |
| POST | `/proposals/{id}/withdraw` | Freelancer autor | 200 + proposta `WITHDRAWN`; só pendente em demanda aberta; cliente avisado |
| GET | `/admin/users` | Admin ativo | Contas, contatos privados, status (`active`, `deleted`) e data de cadastro; sem senha/hash |
| PATCH | `/admin/users/{id}/status` | Admin ativo | Suspende/reativa conta não-admin, com motivo e auditoria |
| GET | `/admin/categories` | Admin ativo | Categorias ativas/inativas |
| POST | `/admin/categories` | Admin ativo | 201 + categoria criada e auditada |
| PUT | `/admin/categories/{id}` | Admin ativo | Renomeia/ativa/desativa, preservando slug e vínculos |
| GET | `/admin/metrics` | Admin ativo | Totais reais por período de criação |
| GET | `/admin/audit` | Admin ativo | Até 200 ações mais recentes, ordem decrescente |
| POST | `/reports` | Autenticado ativo | 201 + denúncia de serviço/avaliação/publicação visível |
| GET | `/reports/mine` | Autenticado | Denúncias da própria conta com estado e nota da decisão, sem o nome de quem decidiu |
| GET | `/admin/reports` | Admin ativo | Fila e decisões, com relato e cópia do conteúdo |
| PATCH | `/admin/reports/{id}` | Admin ativo | Manter/remover com justificativa; remoção lógica e auditoria |
| GET | `/feed` | Autenticado ativo | Página cronológica mista de publicações, serviços e demandas autorizadas |
| POST | `/feed/posts` | Cliente/freelancer ativo | 200 + publicação profissional persistente |
| PATCH | `/feed/posts/{id}/hide` | Autor ativo | 200 + `{hidden:true}`; retirada lógica própria |
| GET | `/actuator/health` (fora da base) | Público | Saúde sem detalhes privados |

## Cadastro e login

```json
{
  "name": "Pessoa de demonstração",
  "email": "pessoa@example.test",
  "phone": "61999990000",
  "password": "Strong12345",
  "role": "FREELANCER",
  "acceptedTerms": true
}
```

Cadastro público rejeita `ADMIN`; termos ausentes/falsos e senha fraca retornam 400. E-mail duplicado retorna 409. Login recebe apenas `email` e `password`; falha usa mensagem genérica e 401.

```json
{
  "accessToken": "JWT emitido pela API",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshToken": "JWT de renovação",
  "refreshExpiresIn": 2592000,
  "user": {
    "id": "UUID",
    "name": "Pessoa de demonstração",
    "email": "pessoa@example.test",
    "phone": "61999990000",
    "role": "FREELANCER",
    "city": "",
    "bio": ""
  }
}
```

`expiresAt` e `refreshExpiresAt` são calculados pelo frontend e não pertencem à resposta HTTP. O access token vale 15 minutos. O refresh token vale 30 dias (`JWT_REFRESH_TTL_SECONDS`), só é aceito em `POST /auth/refresh` (`{refreshToken}`) e não autentica outras rotas. Cada renovação devolve um par novo. Logout apaga a sessão local.

**Login com Google.** Em modo API, o Google Identity Services entrega um ID token ao frontend. As rotas opcionais abaixo usam JSON e passam pelo mesmo limite de tentativas das outras rotas de autenticação.

| Rota | Entrada | Resultado |
|---|---|---|
| `POST /auth/google` | `{credential, verifier}` | `next=SIGNED_IN` com `session`, ou `next=REGISTER\|LINK` com `email` e `name` para concluir o primeiro acesso |
| `POST /auth/google/register` | `{credential, verifier, name, phone, role, acceptedTerms}` | 201 e a sessão da nova conta |
| `POST /auth/google/link` | `{credential, verifier, password}` | 200 e a sessão da conta local vinculada |
| `POST /auth/google/delete-account` | Bearer da conta e `{credential, verifier}` com `nonce` iniciado por `delete-account-` | 204 após confirmar a exclusão com a identidade já vinculada |

A API valida o ID token com as chaves públicas do Google, confere o cliente OAuth, o emissor, a validade e o `nonce` derivado do `verifier` aleatório do navegador. A conta vinculada é localizada pelo `sub` do Google. Para o primeiro vínculo com conta existente, o e-mail orienta a busca e a senha local confirma o vínculo. Administradores e contas inativas não entram por esse fluxo. E-mails Gmail e Google Workspace são considerados confirmados. Para um endereço de terceiros, o cadastro envia o link de confirmação por e-mail. Contas criadas pelo Google podem definir uma senha com o fluxo de recuperação. A redefinição de senha por e-mail remove o vínculo com o Google. A sessão e o perfil privado sinalizam o vínculo em `googleLinked`, sem expor o identificador.

**Recuperação de senha.** `POST /auth/password/forgot` recebe `{email}` e sempre responde 202, sem revelar se a conta existe. Pedidos repetidos para o mesmo e-mail em menos de 60 s são ignorados. A conta ativa recebe um link `PUBLIC_APP_URL/redefinir-senha?token=...` válido por 30 minutos. `POST /auth/password/reset` recebe `{token, password}`, aplica a regra de senha forte e responde 204; link inválido, expirado ou já usado retorna 400.

**Confirmação de e-mail.** O cadastro envia, em segundo plano, um link `PUBLIC_APP_URL/verificar-email?token=...` válido por 24 horas (`app.jwt.verify-ttl-seconds`). O token tem propósito `email-verify` e carrega o e-mail de destino, então não confirma outro endereço. `POST /auth/email/verify` recebe `{token}` e responde 204, também quando o e-mail já estava confirmado. `GET /users/me` e a sessão trazem `emailVerified`. A confirmação não bloqueia o uso da conta (ADR25).

**Avisos por e-mail.** Cada aviso interno, exceto mensagem de chat, também vai por e-mail depois do commit da ação, em segundo plano, para contas ativas com e-mail confirmado e `emailNotifications` ligado (padrão). O e-mail traz o texto do aviso e o link para a tela. Falha no envio não desfaz a ação nem o aviso interno (ADR28).

**Limite de tentativas.** Com `app.rate-limit.auth-per-minute` maior que zero (perfil `prod`: 20), cada endereço de origem pode fazer esse número de POSTs por minuto em `/auth/**`. Acima disso a API responde 429 com `Retry-After: 60` e a mensagem "Muitas tentativas em pouco tempo..." (ADR29).

**CORS.** Só as origens de `CORS_ORIGINS` recebem `Access-Control-Allow-Origin`; outra origem recebe 403. O bean precisa se chamar `corsConfigurationSource` para o Spring Security usá-lo.

**Id da requisição.** Toda resposta em `/api/**` traz `X-Request-Id`: o valor recebido no mesmo cabeçalho, quando tem de 8 a 64 caracteres seguros (o Render envia um), ou um UUID novo. O id entra em todas as linhas de log da requisição e o CORS o expõe ao navegador; em erro 5xx o frontend mostra os 8 primeiros caracteres como "Código do erro" (ADR30).

**Troca de senha.** `PUT /users/me/password` recebe `{currentPassword, newPassword}`. Senha atual errada ou nova senha igual à atual retornam 400. A resposta é uma sessão nova.

**Revogação.** Refresh tokens e links de redefinição carregam uma impressão do hash da senha. Trocar ou redefinir a senha invalida todos os refresh tokens e links emitidos antes, sem tabela extra. Access tokens já emitidos continuam válidos até expirar (no máximo 15 minutos). Conta desativada não consegue login e perde acesso ao perfil privado e à gestão de serviços mesmo com token ainda válido.

Perfil privado recebe PUT com `name`, `phone`, `city`, `bio`. E-mail e role não são alteráveis por esse endpoint. Perfil público retorna `id`, `name`, `role`, `city`, `bio`, `averageRating` (média com 1 casa decimal) e `reviewCount`, sem dados de contato.

## Anúncios e busca

```json
{
  "title": "Instalação de chuveiro elétrico",
  "description": "Instalação e teste de funcionamento. Materiais combinados à parte.",
  "categoryId": "10000000-0000-0000-0000-000000000001",
  "price": 180.00,
  "deliveryDays": 1,
  "status": "ACTIVE"
}
```

Resposta inclui `id`, `moderated` (booleano), campos do anúncio, `category: {id,name,slug}`, `freelancer: {id,name,role,city,bio,averageRating,reviewCount}` e `images: [{id,contentType}]` (ordem de envio; a primeira é a capa). O PATCH recebe `{"status":"INACTIVE"}`. O PUT envia o formulário completo; rascunhos também precisam de conteúdo válido nesta base.

Parâmetros de GET `/services`: `q` (texto, máx 100), `categoryId` (UUID), `city` (cidade exata sem diferenciar maiúsculas, máx 100), `minPrice`, `maxPrice`, `minRating` (1–5), `page` (>=0), `size` (1–50, padrão 12). Ordenação por criação decrescente. Faixa invertida retorna 400. Pesquisa textual escapa caracteres especiais de LIKE.

```json
{ "items": [], "page": 0, "size": 12, "totalElements": 0, "totalPages": 0 }
```

O React atual carrega páginas de 50 para compor o catálogo da entrega e filtra localmente (incluindo nota mínima e ordenação por melhor avaliação); paginação server-side na interface é tarefa futura (`F06`).

### Fotos do anúncio (F06 / RN08)

| Método | Rota | Acesso | Resultado |
|---|---|---|---|
| POST | `/services/{id}/images` | FREELANCER dono | `multipart/form-data` com uma ou mais partes `files`; 201 com o `ServiceView` atualizado |
| DELETE | `/services/{id}/images/{imageId}` | FREELANCER dono | 200 com o `ServiceView` atualizado |
| GET | `/services/{id}/images/{imageId}` | Público | Bytes da imagem com `Content-Type` detectado, `Cache-Control: public, max-age=604800` e `X-Content-Type-Options: nosniff` |

Regras: no máximo 5 imagens por anúncio somando as já salvas (409 ao exceder); cada arquivo com até 5 MB (413) e envio total até 25 MB; somente JPG/PNG, identificados pela assinatura do arquivo e não pelo nome ou `Content-Type` informado (415); o cabeçalho precisa ser legível e as dimensões não passam de 8000 px (415/400). Um envio é atômico: se um arquivo falha, nenhum é gravado. Outro freelancer recebe 403, CLIENT/ADMIN recebem 403 e sem token 401. Anúncio removido pela moderação não aceita alterações (409) e suas imagens deixam de ser servidas (404), assim como as de contas suspensas.

O GET é público porque `<img>` não envia o token; o identificador da imagem é um UUID aleatório e só é exposto nas respostas do anúncio. Imagens de rascunhos ficam acessíveis a quem tiver o link, para o dono conferir a capa antes de publicar.

## Contratações e prazos (F01/F02)

POST `/contracts` recebe:

```json
{
  "serviceId": "UUID do anúncio ativo",
  "date": "2026-11-01",
  "description": "Instalar o equipamento já comprado.",
  "address": "Endereço fictício opcional"
}
```

Substitua `serviceId` por UUID válido e `date` por uma data futura no momento da execução. A API usa `America/Sao_Paulo` para validar a data. Descrição é obrigatória (até 300 caracteres); endereço é opcional (até 200). Uma pendência por cliente/anúncio é permitida; duplicidade retorna 409. Título/preço são copiados do anúncio para preservar o acordo.

PATCH `/contracts/{id}/status` recebe `status` e `comment` opcional de até 500 caracteres, por exemplo `{"status":"AGUARDANDO_CONFIRMACAO","comment":"Serviço executado."}`.

| Estado atual | Próximo estado | Quem pode agir |
|---|---|---|
| `PENDENTE` | `ACEITO` ou `RECUSADO` | Freelancer participante |
| `PENDENTE` | `CANCELADO` | Cliente participante |
| `ACEITO` | `EM_ANDAMENTO` | Freelancer participante |
| `ACEITO` | `CANCELADO` | Cliente ou freelancer participante, com motivo |
| `EM_ANDAMENTO` | `AGUARDANDO_CONFIRMACAO` | Freelancer participante |
| `EM_ANDAMENTO` | `EM_DISPUTA` | Cliente ou freelancer participante, com motivo |
| `AGUARDANDO_CONFIRMACAO` | `CONCLUIDO` ou `EM_DISPUTA` | Cliente participante |
| `EM_DISPUTA` | `CONCLUIDO`, `EM_ANDAMENTO` ou `CANCELADO` | Admin, com justificativa |

Regra de saída (ADR23): qualquer parte cancela com motivo até o serviço começar; depois de `EM_ANDAMENTO`, só por disputa decidida pela administração. Contestação/disputa e cancelamento de contratação aceita exigem motivo não vazio de até 300 caracteres em `comment`; a decisão do admin exige justificativa de até 500 caracteres. Os três casos retornam 400 sem o texto. Participante incorreto recebe 403; transição incompatível com estado/perfil recebe 409. Não há transições manuais a partir de estados finais.

O job cancela `PENDENTE` após 48 horas sem resposta e confirma `AGUARDANDO_CONFIRMACAO` após 5 dias corridos. A checagem periódica usa `CONTRACT_DEADLINE_CHECK_MS`, padrão 60000 ms, e registra eventos idempotentes. Não depende do navegador aberto, mas exige API em execução. A confirmação automática libera o pagamento em custódia (F09); o job não envia e-mails próprios.

`ContractView` inclui IDs dos participantes, nomes, `serviceId` (pode ser nulo em contratação por proposta), título/preço, `date`, descrição/endereço, `status`, `history: [{status,at,comment,actorRole}]`, `completedAt`, `rating`, `review`, `reviewReply`, `reviewedAt`, `dispute` e `observations`. Campos opcionais podem ser nulos. Cada item de `history` traz o comentário do evento (motivo, observação ou justificativa) e o papel de quem agiu (`CLIENT`, `FREELANCER`, `ADMIN`, ou nulo para o job de prazos); o nome do administrador não é exposto. Decisões de disputa por ADMIN também são registradas em `audit_event`; a interface solicita justificativa.

## Avaliações e resposta (F03)

POST `/contracts/{id}/review` recebe `{"rating":5,"comment":"Serviço concluído conforme combinado."}`. Apenas o cliente da contratação concluída avalia, uma única vez, em até 7 dias da conclusão. Nota obrigatória de 1 a 5; comentário opcional de até 500 caracteres. Não há edição ou exclusão de avaliação nesta API.

POST `/contracts/{id}/review/reply` recebe `{"reply":"Obrigado pela avaliação."}`. Apenas o freelancer participante responde, uma única vez, com texto não vazio de até 200 caracteres.

As listas públicas por profissional/serviço retornam `ReviewView`: IDs da avaliação/contratação/serviço/participantes, título do serviço, nome do cliente, nota, comentário, resposta e datas (`createdAt`, `repliedAt`). `serviceId` pode ser nulo em avaliações de contratações originadas por propostas. A média do profissional é calculada com 1 casa decimal e exposta junto de `reviewCount` nos perfis públicos.

## Demandas e propostas (F08)

POST `/demands` recebe:

```json
{
  "title": "Pintura de um quarto",
  "description": "Preparar e pintar as paredes do quarto.",
  "categoryId": "UUID de categoria ativa",
  "budget": 500.00,
  "days": 5,
  "city": "Taguatinga, DF"
}
```

Use UUID válido em `categoryId`. Título até 80, descrição até 500, orçamento positivo com até 2 casas decimais, prazo de 1–365 dias e cidade obrigatória até 100 caracteres. Apenas clientes publicam. `DemandView` retorna os campos da demanda, `id`, `clientId`, `categoryName`, `status` (`OPEN`, `CLOSED`, `CANCELLED`), `createdAt` e `closedAt`.

PUT `/demands/{id}` recebe o mesmo corpo e só vale enquanto a demanda está aberta e sem nenhuma proposta, para que todos os profissionais respondam ao mesmo pedido. POST `/demands/{id}/cancel` encerra a demanda aberta como `CANCELLED`, recusa as propostas pendentes e avisa cada profissional com link para `/propostas`.

POST `/demands/{id}/proposals` recebe `{"price":450.00,"days":4,"message":"Posso executar conforme a descrição."}`. Apenas freelancers enviam para demanda aberta; preço positivo com 2 casas decimais, prazo 1–365 e mensagem não vazia até 600 caracteres. Há no máximo uma proposta **pendente** por profissional/demanda; a restrição não impede nova proposta após recusa enquanto a demanda estiver aberta. `ProposalView` inclui `id`, `demandId`, `demandTitle`, `demandStatus`, `freelancerId`, `freelancerName`, `freelancerAverageRating`, `freelancerReviewCount`, `freelancerAvatarVersion`, preço, prazo, mensagem, estado (`PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`), datas (`createdAt`, `decidedAt`) e `contractId` da contratação gerada no aceite. O autor retira uma proposta pendente com POST `/proposals/{id}/withdraw`; a retirada libera nova proposta enquanto a demanda estiver aberta.

As listas são arrays sem paginação nesta base. O cliente lista suas demandas/propostas recebidas; o freelancer lista todas as demandas e suas próprias propostas; o admin lista todas. No detalhe, o freelancer acessa demanda aberta ou uma demanda para a qual já enviou proposta. Na lista de propostas por demanda, o freelancer vê somente as próprias; dono/admin veem todas.

O cliente dono decide uma proposta pendente com POST `/proposals/{id}/accept` ou `/reject`. O aceite aceita o corpo opcional `{"date":"2026-11-20","address":"QNA 12 casa 3"}` e retorna `{demand,proposal,contract}`: fecha a demanda, aceita a proposta escolhida, recusa as demais pendentes e cria contratação `ACEITO`, em transação. A data deve ser futura (400 caso contrário); sem data, vale o dia do aceite em São Paulo acrescido do prazo da proposta. Sem endereço (até 200), a contratação usa a cidade da demanda. O título/valor acordado e os vínculos são preservados no banco; `demandId`/`proposalId` ainda não fazem parte de `ContractView`.

A recusa retorna a proposta `REJECTED` e mantém a demanda aberta. Demanda fechada ou proposta já decidida retorna 409; decisão por quem não é cliente dono retorna 403. A interface atual oferece ações de aceite e recusa no detalhe da demanda para o cliente dono.

## Administração e denúncias (F04/F05)

O backend verifica perfil e conta ativa em toda operação administrativa. Cliente/freelancer recebe 403; a suspensão também bloqueia tokens já emitidos. Não há endpoint de promoção pública nem exclusão definitiva de usuários.

- PATCH `/admin/users/{id}/status`: `{"active":false,"reason":"Suspensão após análise"}`. Motivo obrigatório, até 1000 caracteres. Alterar status de ADMIN retorna 409. Repetir o estado atual não cria evento duplicado.
- POST `/admin/categories`: `{"name":"Jardinagem"}`. Nome obrigatório, até 80 caracteres; nome/slug duplicado retorna 409. PUT `/admin/categories/{id}`: `{"name":"Jardim e paisagismo","active":false}`. Renomear conserva slug; desativar impede novos anúncios nessa categoria sem apagar os existentes.
- GET `/admin/metrics`: filtros opcionais `from`/`to` no formato `YYYY-MM-DD`, inclusivos, por data de criação no fuso São Paulo. Período invertido retorna 400. Retorna `users`, `services`, `contracts`, `reviews`, `reports`, `pendingReports`, `disputes`. Totais incluem registros preservados após suspensão/remoção lógica; pendências refletem o estado atual dos registros criados no período.
- GET `/admin/audit`: lista com `id`, `actorId`, `actorName`, `action`, `targetType`, `targetId`, `beforeValue`, `afterValue`, `reason`, `createdAt`. Sem endpoint de edição/exclusão. Criação de admin, mudanças em usuários/categorias, decisão de denúncia e decisão de disputa geram eventos na mesma transação.

POST `/reports` recebe:

```json
{
  "targetType": "SERVICE",
  "targetId": "UUID válido do anúncio",
  "reason": "Anúncio incorreto",
  "comment": "Relato detalhado com pelo menos quarenta caracteres para análise."
}
```

`targetType` aceita `SERVICE`, `REVIEW` ou `POST`; motivo obrigatório até 80 caracteres e relato de 40–1000 caracteres úteis após trim. O serviço precisa estar ativo e não moderado, com profissional ativo; a avaliação precisa estar visível e vinculada a profissional ativo. Alvo inexistente/invisível retorna 404. Só pode existir uma denúncia pendente do mesmo autor para o mesmo alvo (409 na duplicidade).

A resposta/fila inclui autor, tipo/ID do alvo, `targetTitle`, `targetContent` (cópia textual), motivo/relato, estado, justificativa, administrador e datas. GET `/admin/reports` é exclusivo de ADMIN; não há listagem pública de denúncias. O relato e a cópia do conteúdo são a evidência persistida nesta fase, sem upload de anexos.

PATCH `/admin/reports/{id}` recebe `{"status":"REMOVED","note":"Motivo fundamentado da decisão"}` ou estado `KEPT`. A justificativa é obrigatória, até 1000 caracteres. `PENDING` como decisão retorna 400; segunda decisão retorna 409. A remoção mantém registros e vínculos: anúncio fica `INACTIVE`/`moderated=true` e seu dono não pode editar/republicar; avaliação fica `hidden=true`, saindo de listas públicas, médias e busca por nota. O histórico privado da contratação e a unicidade da avaliação permanecem preservados.

Decisões são transacionais e usam locks para serializar alterações concorrentes no alvo. Não há operação de desfazer remoção nesta entrega. E-mail dos envolvidos pertence a F07; arquivos de evidência dependem de F06.

## Pagamentos (F09)

Stripe Checkout e Stripe Connect em modo de teste (ADR33, ADR34). Sem `STRIPE_SECRET_KEY` os pagamentos ficam desligados (`enabled: false`) e as contratações seguem sem cobrança. Com a chave, o cliente paga depois do aceite; o valor fica em custódia até a conclusão e só então vira saldo do profissional, já sem a comissão (`PLATFORM_FEE_PERCENT`, padrão 10%). Valores em reais.

| Método | Caminho | Acesso | Resultado |
|---|---|---|---|
| GET | `/contracts/{id}/payment` | Participante ou ADMIN | 200 `{enabled, methods, feePercent, payment}`; `payment` é o mais recente ou `null` |
| POST | `/contracts/{id}/payment` | Cliente da contratação | Body `{method: CARD\|PIX\|BOLETO}`; 201 `{paymentId, checkoutUrl}`. Só em `ACEITO`. Reaproveita o checkout aberto do mesmo método; trocar de método encerra o anterior. 409 se já pago, em compensação ou com pagamentos desligados; 502 se o Stripe recusar |
| GET | `/payments/{id}` | Participante ou ADMIN | 200 `{payment, entries}` com os lançamentos do livro; 404 para terceiros |
| GET | `/users/me/wallet` | Cliente ou freelancer | 200 com saldos (`held`, `available`, `released`, `withdrawn`, `transferred`, `awaitingAccount` para profissional; `paid`, `held`, `refunded` para cliente), pagamentos e saques. `available` conta só pagamentos de demonstração (`SIMULATED`) |
| POST | `/users/me/withdrawals` | Freelancer | Body `{amount}`; 201. Saque **simulado** do saldo de demonstração: reduz o saldo, não transfere dinheiro. 409 acima do disponível |
| GET | `/users/me/payout-account` | Freelancer | 200 `{enabled, status, transfersEnabled, payoutsEnabled, currentlyDue}`; `status` é `DISABLED`, `NOT_STARTED`, `INCOMPLETE`, `IN_REVIEW` ou `READY`. Consulta o Stripe se a conta não está pronta e, se ficou pronta, transfere o que esperava. 403 para outros perfis |
| POST | `/users/me/payout-account/session` | Freelancer | 200 `{clientSecret, publishableKey}` para os componentes embutidos do Stripe; cria a conta conectada no primeiro uso e reaproveita depois. 409 com pagamentos desligados; 502 se o Stripe recusar |
| GET | `/admin/payments` | ADMIN | 200 com totais (recebido, comissões, custódia, liberado, reembolsado, sacado, `transferred`, `reversed`, `inChargeback`), `issues` (pendências: `CHARGEBACK_OPEN`, `REFUND_FAILED`, `REVERSAL_FAILED`, `TRANSFER_FAILED`, `AWAITING_ACCOUNT`; `amount` é o valor bruto nas pendências do cliente e a parte atual do profissional, já descontado reembolso parcial, nas demais) e até 500 pagamentos |
| POST | `/admin/payments/{id}/transfer` | ADMIN | Nova tentativa de transferência de um pagamento liberado; 200 com o pagamento; 409 se não espera transferência, se há chargeback aberto, se a conta não está pronta ou se o Stripe recusar de novo |
| POST | `/payments/webhook` | Stripe (assinatura `Stripe-Signature`, segredo da plataforma ou do Connect) | 200; 400 com assinatura ausente ou inválida. Eventos `checkout.session.*`, `charge.refunded`, `refund.failed`, `charge.dispute.created`, `charge.dispute.closed` e, das contas conectadas, `account.updated`, `payout.paid` e `payout.failed`; cada `event.id` é processado uma vez |

Efeitos no ciclo da contratação: `ACEITO → EM_ANDAMENTO` exige pagamento `PAID` (409 caso contrário); `CONCLUIDO`, inclusive pela confirmação automática de 5 dias ou decisão de disputa, libera o valor (`RELEASED`); `CANCELADO` reembolsa o que já foi pago (`REFUNDED`) e encerra checkouts abertos. Dinheiro que chega depois que a contratação deixou de esperá-lo (boleto pago após cancelamento, checkout antigo pago) é reembolsado automaticamente.

Repasse (ADR34): na conclusão, o líquido é transferido para a conta de recebimento pronta do profissional; sem ela, espera. Reembolso pelo painel do Stripe e chargeback perdido tiram de volta da conta do profissional a parte dele (reversal). Chargeback aberto segura a transferência e, se a contratação for cancelada, o reembolso: ganho, o app reembolsa nessa hora. Status novos: `REFUND_FAILED` e `CHARGED_BACK`; `PaymentView` ganha `transferredAt`, `transferPending`, `refundedAmount` e `disputeStatus`.

## Erros e verificação manual

Erros usam Problem Details (`status`, `title`, `detail`, `instance` quando aplicável). Validações de DTO acrescentam mapa `errors` com campos. Sem token ou token inválido: 401; perfil/dono incorreto: 403; recurso invisível/ausente: 404; duplicidade ou limite 20: 409; payload/parâmetro inválido: 400.

```sh
curl http://localhost:8081/actuator/health
curl http://localhost:8081/api/v1/categories
curl 'http://localhost:8081/api/v1/services?size=12'
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"marcos@demo.freelancenow.test","password":"Demo12345"}'
```

Use a suíte de integração para os cenários de autorização; não compartilhe tokens reais em issues. OpenAPI/Swagger ainda não foi incluído; este contrato Markdown e os testes são a referência mantida do contrato atual.

## Feed e publicações (F11)

GET `/feed`: `page` padrão 0, `size` padrão 20 (1–100), `type` opcional `UPDATE`/`SERVICE`/`DEMAND`, `categoryId` opcional UUID. Ordenação por criação e ID decrescentes, tipo como desempate. A resposta usa `{items,page,size,totalElements,totalPages}`; filtros de visibilidade são aplicados no banco antes da paginação.

Cada item retorna `id`, `type`, `author: {id,name,role,city}`, `title`, `text`, `createdAt`, `category: {id,name}` ou nulo, `serviceId`, `price`, `days`, `city`. Campos sem aplicação são nulos. Não inclui contatos, endereço de contratação ou mensagens de proposta. Serviços inativos/moderados e autores suspensos não aparecem. Demandas devem estar abertas e ter autor ativo: cliente vê as próprias; freelancer/admin vê oportunidades abertas. O detalhe e a negociação mantêm suas regras existentes.

POST `/feed/posts` recebe `{"text":"Meu trabalho da semana", "categoryId":"UUID opcional", "serviceId":"UUID opcional"}`. Texto obrigatório de 1–500 caracteres (espaços isolados não são válidos); categoria deve estar ativa. Vincular serviço exige autoria, status ativo e ausência de moderação; a categoria é inferida do serviço, e outra categoria explícita é rejeitada. Administradores não publicam por essa operação. O retorno é o item `UPDATE`; a publicação aparece para outras contas autenticadas. Se o serviço vinculado ficar invisível, a publicação vinculada também sai do feed.

PATCH `/feed/posts/{id}/hide` não exige corpo; somente o autor pode agir. A retirada é lógica e não permite restaurar conteúdo moderado. Denunciar usa POST `/reports` com `targetType: "POST"`; relato, cópia do texto, decisão fundamentada e auditoria reaproveitam F05. Visitantes não têm acesso ao feed. Fotos, comentários, curtidas, seguidores e ranking personalizado permanecem fora de F11.
