# Contrato da API

Revisado em **21/10/2026**, conforme controllers, DTOs e serviços da base integrada. Base local: `http://localhost:8081/api/v1`. JSON com chaves em inglês; textos da interface e mensagens de negócio em português. Autenticação: `Authorization: Bearer <accessToken>`. A API expõe os endpoints abaixo. Recuperação de senha, mensagens/notificações, upload, gestão administrativa, denúncias e financeiro ainda não possuem endpoints completos; suas telas continuam visuais/simuladas. A interface de moderação já chama as transições reais de disputa com sessão ADMIN, mas não há provisionamento público ou seed dessa conta.

| Método | Caminho | Acesso | Resultado |
|---|---|---|---|
| POST | `/auth/register` | Público | 201 + sessão; cliente/freelancer |
| POST | `/auth/login` | Público | 200 + sessão |
| GET | `/users/me` | Autenticado | Perfil privado |
| PUT | `/users/me` | Autenticado | Atualiza nome, telefone, cidade e bio |
| GET | `/categories` | Público | Categorias ativas |
| GET | `/freelancers` | Público | Perfis públicos ativos |
| GET | `/freelancers/{id}` | Público | Perfil público de freelancer |
| GET | `/services` | Público | Página de anúncios ativos de usuários ativos |
| GET | `/services/{id}` | Público | Anúncio ativo; draft/inativo retorna 404 |
| GET | `/freelancer/services` | Freelancer | Todos os anúncios do dono |
| POST | `/services` | Freelancer | 201 + anúncio |
| PUT | `/services/{id}` | Freelancer/dono | Atualização completa |
| PATCH | `/services/{id}/status` | Freelancer/dono | Ativa, desativa ou põe em rascunho |
| GET | `/contracts` | Autenticado | Lista contratações do participante (ou todas para admin) |
| GET | `/contracts/{id}` | Participante/Admin | Detalhe, histórico de eventos e avaliação da contratação |
| POST | `/contracts` | Cliente | 201 + solicitação `PENDENTE` com snapshot do serviço |
| PATCH | `/contracts/{id}/status` | Participante/Admin | Transição de estado e registro em `contract_event` |
| POST | `/contracts/{id}/review` | Cliente (autor) | 201 + avaliação única (1–5, até 500 chars, janela de 7 dias) |
| POST | `/contracts/{id}/review/reply` | Freelancer (dono) | 200 + resposta única do profissional (até 200 chars) |
| GET | `/freelancers/{id}/reviews` | Público | Lista avaliações públicas recebidas pelo profissional |
| GET | `/services/{id}/reviews` | Público | Lista avaliações públicas vinculadas ao serviço |
| GET | `/demands` | Autenticado | Demandas do cliente ou todas as demandas para freelancer/admin |
| GET | `/demands/{id}` | Autorizado | Cliente dono, admin ou freelancer com acesso à demanda aberta/que já recebeu sua proposta |
| POST | `/demands` | Cliente | 201 + nova demanda aberta (`OPEN`) |
| GET | `/proposals` | Autenticado | Propostas recebidas (cliente), enviadas (freelancer) ou todas (admin) |
| GET | `/demands/{id}/proposals` | Autorizado | Propostas da demanda (todas para o dono/admin ou própria para freelancer) |
| POST | `/demands/{id}/proposals` | Freelancer | 201 + proposta única `PENDING` por profissional/demanda |
| POST | `/proposals/{id}/accept` | Cliente (dono da demanda) | 200 + encerra demanda, recusa demais propostas e cria contratação `ACEITO` |
| POST | `/proposals/{id}/reject` | Cliente (dono da demanda) | 200 + marca proposta como `REJECTED` |
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

`expiresAt` é calculado pelo frontend e não pertence à resposta HTTP. Logout apaga a sessão local; não existe refresh/revogação individual. Conta desativada não consegue login e perde acesso ao perfil privado e à gestão de serviços mesmo com token ainda válido.

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

Resposta inclui `id`, campos do anúncio, `category: {id,name,slug}` e `freelancer: {id,name,role,city,bio,averageRating,reviewCount}`. O PATCH recebe `{"status":"INACTIVE"}`. O PUT envia o formulário completo; rascunhos também precisam de conteúdo válido nesta base.

Parâmetros de GET `/services`: `q` (texto, máx 100), `categoryId` (UUID), `city` (cidade exata sem diferenciar maiúsculas, máx 100), `minPrice`, `maxPrice`, `minRating` (1–5), `page` (>=0), `size` (1–50, padrão 12). Ordenação por criação decrescente. Faixa invertida retorna 400. Pesquisa textual escapa caracteres especiais de LIKE.

```json
{ "items": [], "page": 0, "size": 12, "totalElements": 0, "totalPages": 0 }
```

O React atual carrega páginas de 50 para compor o catálogo da entrega e filtra localmente (incluindo nota mínima e ordenação por melhor avaliação); paginação server-side na interface é tarefa futura (`F06`).

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
| `EM_ANDAMENTO` | `AGUARDANDO_CONFIRMACAO` | Freelancer participante |
| `AGUARDANDO_CONFIRMACAO` | `CONCLUIDO` ou `EM_DISPUTA` | Cliente participante |
| `EM_DISPUTA` | `CONCLUIDO` ou `EM_ANDAMENTO` | Admin |

Contestação exige motivo não vazio de até 300 caracteres em `comment`. Participante incorreto recebe 403; transição incompatível com estado/perfil recebe 409. Não há transições manuais a partir de estados finais.

O job cancela `PENDENTE` após 48 horas sem resposta e confirma `AGUARDANDO_CONFIRMACAO` após 5 dias corridos. A checagem periódica usa `CONTRACT_DEADLINE_CHECK_MS`, padrão 60000 ms, e registra eventos idempotentes. Não depende do navegador aberto, mas exige API em execução. Não dispara pagamentos ou e-mails.

`ContractView` inclui IDs dos participantes, nomes, `serviceId` (pode ser nulo em contratação por proposta), título/preço, `date`, descrição/endereço, `status`, `history: [{status,at}]`, `completedAt`, `rating`, `review`, `reviewReply`, `reviewedAt`, `dispute` e `observations`. Campos opcionais podem ser nulos. Ator, estado anterior e nota dos eventos ficam no banco, mas não são expostos em `history`.

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

Use UUID válido em `categoryId`. Título até 80, descrição até 500, orçamento positivo com até 2 casas decimais, prazo de 1–365 dias e cidade obrigatória até 100 caracteres. Apenas clientes publicam. `DemandView` retorna os campos da demanda, `id`, `clientId`, `status`, `createdAt` e `closedAt`.

POST `/demands/{id}/proposals` recebe `{"price":450.00,"days":4,"message":"Posso executar conforme a descrição."}`. Apenas freelancers enviam para demanda aberta; preço positivo com 2 casas decimais, prazo 1–365 e mensagem não vazia até 600 caracteres. Há no máximo uma proposta **pendente** por profissional/demanda; a restrição não impede nova proposta após recusa enquanto a demanda estiver aberta. `ProposalView` inclui `id`, `demandId`, `freelancerId`, `freelancerName`, preço, prazo, mensagem, estado e datas (`createdAt`, `decidedAt`).

As listas são arrays sem paginação nesta base. O cliente lista suas demandas/propostas recebidas; o freelancer lista todas as demandas e suas próprias propostas; o admin lista todas. No detalhe, o freelancer acessa demanda aberta ou uma demanda para a qual já enviou proposta. Na lista de propostas por demanda, o freelancer vê somente as próprias; dono/admin veem todas.

O cliente dono decide uma proposta pendente com POST `/proposals/{id}/accept` ou `/reject`, sem payload obrigatório. O aceite retorna `{demand,proposal,contract}`, fecha a demanda, aceita a proposta escolhida, recusa as demais pendentes e cria contratação `ACEITO`, em transação. A data da contratação é o dia do aceite em São Paulo acrescido do prazo da proposta. O título/valor acordado e os vínculos são preservados no banco; `demandId`/`proposalId` ainda não fazem parte de `ContractView`.

A recusa retorna a proposta `REJECTED` e mantém a demanda aberta. Demanda fechada ou proposta já decidida retorna 409; decisão por quem não é cliente dono retorna 403. A interface atual oferece ações de aceite e recusa no detalhe da demanda para o cliente dono.

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
