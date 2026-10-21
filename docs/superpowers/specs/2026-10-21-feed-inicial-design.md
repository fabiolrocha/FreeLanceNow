# Feed inicial e alinhamento ao HTML de referência

Status: escopo aprovado em 21/10/2026 pelo usuário ("Pode seguir"): feed misto após login. Implementado nesta branch; validação/revisão registradas no plano. Branch: `codex/feed-inicial`, baseada em F04/F05 (`7054060`).

## Intenção confirmada

A página inicial do aplicativo deve ser um feed, com referências de interação de Instagram e LinkedIn. Publicações sobre trabalhos, textos e oportunidades devem ser o principal ponto de descoberta e conexão entre pessoas e necessidades. A organização visual deve retomar o HTML fornecido como base.

A mudança não invalida as contratações, propostas e moderação existentes. A entrada para esses fluxos passa a ser o conteúdo do feed. O painel de métricas deixa de ocupar o lugar da página inicial.

F04/F05 estão implementados no PR #40, aberto contra `main`, com CI aprovada. O desenvolvimento do feed fica em uma branch separada para manter esse PR focado.

## Evidência no HTML original

Referência: `docs/prototipo/FreeLanceNow Prototipo.dc.html`.

- Linhas 329–453: feed do cliente em três colunas, perfil/categorias à esquerda, campo de publicação e conteúdo ao centro, acompanhamento e profissionais à direita.
- Linhas 455–558: feed do freelancer com publicação, demandas abertas e atalhos de solicitações/execução.
- Linhas 560 em diante: formulário de publicação com descrição, categoria, valor, prazo, localização e fotos.
- Linhas 2750–2765: exemplos de novo serviço, trabalho concluído, reputação e procura por profissionais.
- Linhas 3220–3225: publicar como freelancer gera serviço; publicar como cliente gera demanda.

Os contadores, avaliações, fotos e promessas comerciais do protótipo são ilustrativos. A implementação deve usar dados reais ou estados vazios, respeitando as funcionalidades entregues.

## Estrutura visual proposta

Manter Public Sans, a marca verde e as superfícies claras do projeto. O feed recupera a hierarquia e a composição do HTML, adaptadas para celular.

```text
Cabeçalho: marca | Feed | Serviços | Profissionais | Demandas | avisos e conta

Perfil e atalhos        Publicar no feed                   Acompanhamento
Categorias             Filtros de conteúdo                 Contratações pendentes
Minhas demandas        Publicação: autor, data e texto     Oportunidades relacionadas
ou meus serviços       Serviço ou demanda com ação        Orientações úteis
                       Próximas publicações
```

- Desktop: três colunas, com a coluna central mais larga e leitura contínua. Evitar uma quarta coluna causada pela sidebar atual.
- Celular: coluna única, publicação no início, filtros acessíveis e navegação compacta; detalhes auxiliares saem do caminho principal.
- Cada item informa autor, papel profissional quando disponível, data real, tipo do conteúdo e texto. Serviço/demanda acrescenta categoria, valor e prazo quando aplicáveis.
- A ação principal leva a um fluxo existente: ver serviço, solicitar, enviar proposta ou visitar perfil profissional.
- Indicadores de contratação ficam em apoio lateral ou no painel de gestão, sem abrir a página com cards de métricas.

## Conteúdo e publicação — primeira entrega aprovada

| Conteúdo | Quem publica | Resultado |
|---|---|---|
| Atualização sobre trabalho | Cliente/freelancer autenticado e ativo | Texto de 1–500 caracteres, autor/data e vínculo opcional a serviço próprio |
| Serviço ofertado | Freelancer | Reutiliza cadastro/validação do anúncio; aparece como oportunidade no feed |
| Necessidade/demanda | Cliente | Reutiliza publicação de demanda; profissionais podem abrir e enviar proposta |

O campo “Publicar” deve permitir escolher a intenção e aproveitar os formulários existentes de serviço/demanda. Uma atualização profissional não exige preço ou prazo. Vincular um serviço exige que pertença ao autor e esteja visível.

Cliente tem destaque para serviços/profissionais; freelancer tem destaque para demandas abertas. Atualizações profissionais compõem o feed. Filtros por tipo e categoria ajudam a encontrar conteúdo; a primeira ordenação é cronológica, sem prometer ranking de relevância.

“Proposta” comercial continua sendo a resposta privada a uma demanda. O feed apresenta a oportunidade e a ação para propor; valores/mensagens de negociação e dados privados não são expostos a terceiros.

Fotos de trabalho entram com F06. Curtidas, comentários, salvamentos, seguir pessoas e recomendações personalizadas não entram implicitamente nesta primeira entrega. Não desenhar ações inoperantes ou inventar contadores. Se forem desejados agora, devem entrar expressamente no escopo e no aceite.

## Navegação e páginas a reorganizar

| Local atual | Mudança proposta |
|---|---|
| `/inicio` | Feed de descoberta e publicação após login |
| `/painel` | Continua como gestão/métricas do freelancer; deixa de duplicar a página inicial |
| Navegação da aplicação | Feed como destino principal; atalhos de gestão em apoio, retomando o HTML |
| Criar serviço/demanda | Acesso pelo campo de publicação, sem duplicar regras e formulários |
| Catálogo, detalhe e perfil profissional | Segunda revisão visual, para manter continuidade entre publicação e contratação |
| Demandas e propostas | Preservar autorização e geração de contratação; integrar a entrada pelo feed |
| Área administrativa | Preservar F04/F05 e incorporar moderação das novas publicações |

Decisão aprovada: começar pelo feed misto autenticado, como no HTML. A página pública `/` permanece como apresentação; o feed não expõe conteúdo a visitantes.

## Dados e autorização

- Novas publicações precisam de persistência na API e banco, com autor, texto, categoria/vínculo opcional, criação e estado de visibilidade.
- Listagem paginada, inicialmente 20 itens por página, com ordenação determinística por data e ID; estados de carregamento, vazio, erro e nova tentativa.
- Contas suspensas, conteúdo removido e serviços inativos não podem aparecer como oportunidades públicas.
- O feed reutiliza anúncios/demandas existentes sem duplicar entidades de negociação. O backend decide quais demandas cada perfil pode ver; não ampliar permissões apenas para preencher a interface.
- As demandas atuais são autenticadas: cliente consulta as próprias; freelancer consulta demandas abertas ou das quais participou. A listagem existente não é prova suficiente de visibilidade: o feed precisa aplicar também as restrições do detalhe. Uma versão pública exigiria decidir expressamente quais conteúdos podem aparecer.
- O DTO atual de demanda informa `clientId`, sem nome público do cliente. Apresentar autores exige um DTO específico com campos seguros; não reutilizar o perfil privado (`Me`). Somente freelancers possuem perfil público hoje, portanto não criar links de perfil de cliente sem esse recurso.
- Não expor e-mail, telefone, endereço de contratação, tokens ou mensagens de proposta no payload do feed.
- Novas publicações devem admitir denúncia e remoção administrativa com auditoria, estendendo F05 sem perder os alvos serviço/avaliação.
- Autor pode retirar sua própria atualização; a remoção preserva registros necessários à moderação. Não permitir editar/remover publicação de outro usuário.
- O modo mock mantém a mesma estrutura de interação. Falhas da API não acionam fallback silencioso.

## Aceite da primeira entrega

1. Entrar como cliente/freelancer abre um feed, com conteúdo e campo de publicação ocupando o centro da experiência.
2. Publicar texto válido, recarregar e entrar em outra conta comprova persistência e visibilidade conforme autorização.
3. Publicar um serviço/demanda pelos acessos do feed conduz aos formulários existentes e permite continuar até solicitação/proposta.
4. Abrir um item leva ao recurso correto; contratos e propostas existentes mantêm regras e participantes.
5. Denunciar/moderar uma atualização retira sua exposição e gera auditoria; suspensão também remove a exposição do autor.
6. Categorias e filtros funcionam; estados vazios/erro orientam ações reais.
7. Desktop e 390 px preservam leitura, foco e navegação, sem rolagem horizontal.
8. `/painel` conserva a gestão; `/inicio` deixa de renderizar o mesmo Dashboard.
9. Testes de regressão dos fluxos existentes e novos cenários mock/API passam; docs distinguem o que foi implementado do que ficou para F06/F07.

## Efeito no planejamento

Adicionar F11 — Feed e publicações — como prioridade imediata após F04/F05. Replanejar as janelas de F06/F07 antes de prometer datas novas; o feed acrescenta persistência, autorização, moderação, testes e adaptação visual. O prazo final permanece 18/11/2026 até decisão contrária do grupo.

A revisão das demais páginas começa pelas que participam de descoberta/publicação/contratação. Não substituir todas as telas de uma vez nem alterar pagamentos para preencher a aparência do HTML.

## Aprovação

Em 21/10/2026, o usuário aprovou seguir com a proposta de publicações, serviços e demandas juntos, após login. Implementação inline nesta sessão, na branch solicitada; sem worktree adicional.
