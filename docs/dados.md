# Modelo de dados

Revisado em **21/10/2026**. Esquema implementado nas migrações `V1__initial_schema.sql`, `V2__categories.sql`, `V3__contracts.sql`, `V4__reviews.sql`, `V5__demands_and_proposals.sql`, `V6__administration_and_moderation.sql`, `V7__content_reports.sql` e `V8__feed.sql`.

```mermaid
erDiagram
  APP_USER ||--o{ SERVICE_LISTING : publica
  CATEGORY ||--o{ SERVICE_LISTING : classifica
  APP_USER ||--o{ CONTRACT : solicita_ou_executa
  SERVICE_LISTING |o--o{ CONTRACT : origina
  DEMAND |o--o{ CONTRACT : origina
  PROPOSAL |o--o| CONTRACT : origina
  CONTRACT ||--o{ CONTRACT_EVENT : registra
  CONTRACT ||--o| REVIEW : recebe
  APP_USER ||--o{ DEMAND : publica
  CATEGORY ||--o{ DEMAND : classifica
  DEMAND ||--o{ PROPOSAL : recebe
  APP_USER ||--o{ PROPOSAL : envia
  APP_USER {
    uuid id PK
    varchar email UK
    varchar password_hash
    varchar role
    boolean active
    varchar terms_version
    timestamptz terms_accepted_at
  }
  CATEGORY {
    uuid id PK
    varchar name
    varchar slug UK
    boolean active
  }
  SERVICE_LISTING {
    uuid id PK
    uuid freelancer_id FK
    uuid category_id FK
    numeric price
    int delivery_days
    varchar status
  }
  CONTRACT {
    uuid id PK
    uuid service_id FK
    uuid demand_id FK
    uuid proposal_id UK
    uuid client_id FK
    uuid freelancer_id FK
    varchar title
    numeric price
    date scheduled_date
    varchar status
  }
  CONTRACT_EVENT {
    uuid id PK
    uuid contract_id FK
    uuid actor_id FK
    varchar previous_status
    varchar status
    timestamptz created_at
  }
  REVIEW {
    uuid id PK
    uuid contract_id UK
    uuid service_id FK
    uuid client_id FK
    uuid freelancer_id FK
    int rating
    varchar comment
    varchar reply
    timestamptz created_at
  }
  DEMAND {
    uuid id PK
    uuid client_id FK
    uuid category_id FK
    varchar title
    numeric budget
    int days
    varchar city
    varchar status
  }
  PROPOSAL {
    uuid id PK
    uuid demand_id FK
    uuid freelancer_id FK
    numeric price
    int days
    varchar message
    varchar status
  }
```

| Tabela | Campos e limites principais | Regras |
|---|---|---|
| `app_user` | UUID; nome 100; e-mail 254 único; hash; telefone 20; role; ativo; cidade 100; bio 600; termos/aceite; criação | E-mail em minúsculas; `CLIENT`, `FREELANCER`, `ADMIN`; hash bcrypt |
| `category` | UUID; nome; slug único; ativo | Migração cria Elétrica, Encanamento, Limpeza, TI e Pintura |
| `service_listing` | UUID; dono/categoria FK; título 80; descrição 500; preço `numeric(12,2)`; dias; status; criação | Preço >0; dias 1–365; `DRAFT`, `ACTIVE`, `INACTIVE`; dono validado pelo serviço |
| `contract` | UUID; serviço opcional/demanda opcional/proposta única opcional/cliente/freelancer FK; snapshot de título 80 e preço `numeric(12,2)`; data futura; descrição 300; endereço 200; status; observações 500; disputa 300; timestamps | Índice parcial único `(client_id, service_id) WHERE status = 'PENDENTE'`; jobs automáticos de 48h e 5 dias |
| `contract_event` | UUID; contratação FK; ator opcional FK; estado anterior/novo; nota 500; criação | Histórico imutável de transições manuais e automáticas |
| `review` | UUID; contratação única FK; serviço opcional/cliente/freelancer FK; nota 1–5; comentário 500; resposta 200; datas | Janela de 7 dias após conclusão; avaliação imutável; média de reputação com 1 casa decimal |
| `demand` | UUID; cliente/categoria FK; título 80; descrição 500; orçamento `numeric(12,2)`; dias 1–365; cidade 100; status (`OPEN`, `CLOSED`); datas | Somente clientes publicam; encerra automaticamente ao aceitar uma proposta |
| `proposal` | UUID; demanda/freelancer FK; valor `numeric(12,2)`; dias 1–365; mensagem 600; status (`PENDING`, `ACCEPTED`, `REJECTED`); datas | Índice parcial único `(demand_id, freelancer_id) WHERE status = 'PENDING'`; aceite gera contratação em `ACEITO` e recusa as demais pendentes |

Índices apoiam consulta por proprietário/status, categoria/preço em anúncios ativos, verificação de prazos em contratações, agregação de notas por profissional e propostas por demanda/freelancer. Integridade referencial mantém vínculos; desativação não elimina histórico. O limite de 20 ativos é regra transacional, não um simples `CHECK` de linha.

Valores monetários trafegam como número JSON e são `BigDecimal` no Java; o banco não usa ponto flutuante para preço. No mock, o JavaScript representa valores ilustrativos; isso não é base de contabilização financeira.

## Próximas migrações propostas

Validar o contrato da respectiva funcionalidade antes de criar novas tabelas. A equipe combina a próxima numeração livre após V8, sem pessoa fixa para migrações ou revisão. Não alterar arquivos já aplicados. A disputa atual fica em `contract` e suas transições em `contract_event`; os eventos administrativos também são registrados em `audit_event`. Uma entidade separada de disputa permanece como possível evolução.

| Entidade futura | Vínculos e invariantes |
|---|---|
| `dispute` / anexos de evidência | Evoluir o motivo atualmente em `contract`; vincular storage de F06 sem apagar histórico |
| `message` / `notification` | Participantes autorizados e eventos; status de leitura/entrega |
| `service_image` | Dono, storage key, tipo/tamanho, ordem e metadados; máximo 5 |
| `payment` / `ledger_entry` | Referência gateway única, contratação, eventos idempotentes, valores e conciliação |

Contratações originadas por proposta podem ter `service_id` nulo, inclusive na avaliação. O aceite guarda os vínculos de demanda/proposta e o preço acordado; a API pública da contratação ainda não expõe `demandId`/`proposalId`.

O seed `DemoData` cria dados fictícios no perfil `dev` quando habilitado; não há seed financeiro nem credenciais ADMIN padrão. O bootstrap administrativo é separado, opt-in e idempotente. Testes de API geram identificadores/e-mails novos, sem assumir IDs dos usuários do seed.

## Administração e moderação (V6/V7)

| Tabela/campo | Persistência e invariantes |
|---|---|
| `audit_event` | Ator, ação, tipo/ID do alvo, valores anterior/novo, justificativa e data; sem API de alteração/exclusão. Gravado na mesma transação da ação administrativa |
| `content_report` | Autor, tipo `SERVICE`/`REVIEW`/`POST`, ID do alvo, cópia de título/conteúdo, motivo/relato, `PENDING`/`KEPT`/`REMOVED`, administrador, justificativa e datas |
| `service_listing.moderated` | Remoção lógica acompanhada de `INACTIVE`; o proprietário não pode editar/republicar anúncio moderado |
| `review.hidden` | Oculta avaliação das listas públicas, médias e filtro por nota; preserva vínculo único e histórico privado da contratação |

Índice parcial impede duas denúncias pendentes do mesmo autor/alvo. Decisões usam locks e não podem ser repetidas. Os alvos polimórficos são validados no serviço; as FKs preservam autores e administradores. V6 acrescenta unicidade de nome de categoria sem distinguir maiúsculas. Renomear preserva o slug e os vínculos dos anúncios existentes.


## Publicações e feed (V8)

`feed_post` guarda UUID, `author_id` com FK, texto de até 500 caracteres não vazio, `category_id` e `service_id` opcionais, `created_at` e `hidden`. Serviço vinculado deve pertencer ao autor e estar visível; retirada própria e remoção administrativa usam o mesmo sinal lógico, preservando a linha para histórico. O tipo `POST` amplia a restrição de alvos de `content_report` sem alterar V7 já aplicada.

O feed não duplica serviços ou demandas: uma consulta `UNION ALL` combina as três fontes e filtra autores ativos, conteúdo visível, tipo/categoria e acesso às demandas antes de contar/paginar. Índices de criação/ID apoiam a listagem de oportunidades. Ordenação é cronológica e determinística; não existe algoritmo de relevância. A consulta retorna DTO seguro e não serializa entidades/contatos privados.
