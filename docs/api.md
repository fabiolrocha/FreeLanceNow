# Contrato da API inicial

Base local: `http://localhost:8081/api/v1`. JSON com chaves em inglês; textos da interface e mensagens de negócio em português. Autenticação: `Authorization: Bearer <accessToken>`. A API expõe os endpoints abaixo; as demais telas são simulação.

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
| GET | `/services/{id}` | Público | Anúncio ativo; draft/inativo retorna404 |
| GET | `/freelancer/services` | Freelancer | Todos os anúncios do dono |
| POST | `/services` | Freelancer | 201 + anúncio |
| PUT | `/services/{id}` | Freelancer/dono | Atualização completa |
| PATCH | `/services/{id}/status` | Freelancer/dono | Ativa, desativa ou põe em rascunho |
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

Cadastro público rejeita `ADMIN`; termos ausentes/falsos e senha fraca retornam400. E-mail duplicado retorna409. Login recebe apenas `email` e `password`; falha usa mensagem genérica e401.

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

`expiresAt` é calculado pelo frontend e não pertence à resposta HTTP. Logout apaga a sessão local; não existe refresh/revogação individual. Conta desativada não consegue login e perde acesso protegido mesmo com token ainda válido.

Perfil privado recebe PUT com `name`, `phone`, `city`, `bio`. E-mail e role não são alteráveis por esse endpoint. Perfil público retorna `id`, `name`, `role`, `city`, `bio`, sem dados de contato.

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

Resposta inclui `id`, campos do anúncio, `category: {id,name,slug}` e `freelancer: {id,name,role,city,bio}`. O PATCH recebe `{"status":"INACTIVE"}`. O PUT envia o formulário completo; rascunhos também precisam de conteúdo válido nesta base.

Parâmetros de GET `/services`: `q` (texto, máx100), `categoryId` (UUID), `city` (cidade exata sem diferenciar maiúsculas, máx100), `minPrice`, `maxPrice`, `page` (>=0), `size` (1–50, padrão12). Ordenação por criação decrescente. Faixa invertida retorna400. Pesquisa textual escapa caracteres especiais de LIKE.

```json
{ "items": [], "page": 0, "size": 12, "totalItems": 0, "totalPages": 0 }
```

O React atual carrega páginas de 50 para compor o catálogo da entrega e filtra localmente; paginação server-side na interface é tarefa futura. Não há filtro por nota até avaliações persistentes serem implementadas.

## Erros e verificação manual

Erros usam Problem Details (`status`, `title`, `detail`, `instance` quando aplicável). Validações de DTO acrescentam mapa `errors` com campos. Sem token ou token inválido:401; perfil/dono incorreto:403; recurso invisível/ausente:404; duplicidade ou limite20:409; payload/parâmetro inválido:400.

```sh
curl http://localhost:8081/actuator/health
curl http://localhost:8081/api/v1/categories
curl 'http://localhost:8081/api/v1/services?size=12'
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"marcos@demo.freelancenow.test","password":"Demo12345"}'
```

Use a suíte de integração para os cenários de autorização; não compartilhe tokens reais em issues. OpenAPI/Swagger ainda não foi incluído; este contrato Markdown e os testes são a referência inicial.
