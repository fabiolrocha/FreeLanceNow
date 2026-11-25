# Business Model Canvas — FreeLanceNow

> Conectando demandas a talentos de forma simples e segura.

Versão 2.0, revisada em 24/11/2026. Ela atualiza o canvas original da proposta ([originais/BMC.png](../originais/BMC.png)) com o que o sistema entregue faz de verdade. Cada bloco separa o que já funciona do que continua como plano futuro, para que o canvas não prometa recursos que não existem.

Versão para impressão: [BMC.pdf](BMC.pdf). A fonte editável do PDF fica em [modelos/bmc.html](../modelos/bmc.html).

## Canvas

| Parcerias principais | Atividades principais | Proposta de valor | Relacionamento com clientes | Segmentos de clientes |
|---|---|---|---|---|
| Stripe: pagamentos e custódia (escrow), em modo de teste | Desenvolver e manter a plataforma | Contratação rápida, simples e segura | Autoatendimento pela plataforma | Pessoas com demandas domésticas ou técnicas |
| Vercel, Render e Neon: nuvem (web, API e banco) | Atrair clientes e freelancers | Busca por categoria, cidade, preço e nota | Avaliações após serviços concluídos | Pequenas e médias empresas |
| Resend: e-mails transacionais | Intermediar contratações e pagamentos | Demandas: o cliente publica o pedido e recebe propostas | Avisos internos e por e-mail; chat por contratação | Freelancers e profissionais autônomos |
| *Futuro:* lojas de materiais, agências e associações profissionais | Moderar perfis, conteúdo e avaliações | Perfis com portfólio, fotos e avaliações | Moderação, denúncias e mediação de disputas | *Futuro:* agências de emprego |
| *Futuro:* consultoria jurídica e LGPD | Prevenir fraudes e dar suporte | Pagamento protegido por custódia até a conclusão | *Futuro:* programa de indicação | |
| | | Experiência acessível e responsiva | | |

| Recursos principais | Canais |
|---|---|
| Aplicação web responsiva (computador e celular) | Plataforma web responsiva: freelancenow.vercel.app |
| API REST, banco PostgreSQL e infraestrutura em nuvem | Feed público com serviços, demandas e publicações |
| Busca, reputação (notas e avaliações) e feed | E-mails de confirmação e avisos |
| Painel administrativo com métricas e auditoria | *Futuro:* aplicativo móvel nativo |
| Base de usuários | *Futuro:* marketing digital hiperlocal, redes sociais, parcerias e indicações |
| Equipe técnica e administrativa | |

| Estrutura de custos | Fontes de receita |
|---|---|
| Desenvolvimento e manutenção | Taxa de 10% sobre cada serviço concluído, retida no pagamento (configurável por `PLATFORM_FEE_PERCENT`) |
| Infraestrutura: hospedagem, banco e backups (hoje em planos gratuitos) | *Futuro:* planos premium para freelancers |
| Tarifas do processador de pagamentos (Stripe) | *Futuro:* destaque patrocinado de serviços |
| Segurança, LGPD e moderação | |
| Marketing, suporte e administração | |

## Blocos em detalhe

### 1. Segmentos de clientes

- **Clientes (pessoas físicas):** precisam de serviços domésticos ou técnicos, como elétrica, encanamento, limpeza, pintura e informática.
- **Pequenas e médias empresas:** contratam serviços pontuais sem manter equipe própria. Usam o mesmo perfil de cliente.
- **Freelancers e profissionais autônomos:** querem divulgar serviços, encontrar clientes e receber com segurança.
- **Agências de emprego:** não há perfil próprio nesta versão. Continuam como segmento futuro.

### 2. Proposta de valor

- **Para o cliente:** encontrar um profissional pela busca com filtros ou publicar uma demanda e receber propostas. O cliente paga com cartão, Pix ou boleto, e o valor só é liberado quando ele confirma a conclusão. Se a contratação é cancelada, o valor volta ao cliente.
- **Para o freelancer:** anunciar até 20 serviços com fotos, publicar trabalhos no feed, montar reputação com avaliações e receber o valor da contratação, menos a taxa, na conta de recebimento.
- **Para os dois:** histórico de cada contratação, chat, avisos, disputa mediada pelo administrador e dados protegidos conforme a LGPD.

### 3. Canais

- **Em funcionamento:** aplicação web responsiva em https://freelancenow.vercel.app. Ela é a mesma no computador e no celular, e o feed público funciona como vitrine de entrada. Os e-mails de confirmação e de aviso trazem o usuário de volta à plataforma.
- **Futuro:** aplicativo móvel nativo, marketing digital hiperlocal, redes sociais, parcerias e indicações.

### 4. Relacionamento com clientes

- **Autoatendimento:** cadastro, busca, contratação, pagamento e avaliação sem intermediário humano.
- **Confiança:** avaliações de 1 a 5 com resposta do profissional e nota média no perfil.
- **Comunicação:** avisos internos, cópia por e-mail que o usuário pode desligar e chat por contratação.
- **Moderação:** denúncias de serviços, avaliações e publicações, decididas pelo administrador. As disputas de conclusão também são mediadas por ele.
- **Futuro:** programa de indicação.

### 5. Fontes de receita

- **Taxa de intermediação:** 10% do valor de cada serviço concluído. A plataforma retém a taxa no pagamento em custódia e repassa o restante ao freelancer. O percentual é configurável pela variável `PLATFORM_FEE_PERCENT`.
- **Situação atual:** os pagamentos rodam em modo de teste do Stripe. Nenhuma cobrança real acontece até a plataforma ativar o modo de produção.
- **Futuro:** planos premium para freelancers e destaque patrocinado de serviços.

### 6. Recursos principais

- **Tecnológicos:**
  - Aplicação web em React.
  - API em Java com Spring Boot.
  - Banco PostgreSQL.
  - Pipeline de testes e implantação automatizada.
- **Dados:** base de usuários, catálogo de serviços e histórico de reputação.
- **Humanos:** equipe de desenvolvimento e administração da plataforma, incluindo moderação e suporte.

### 7. Atividades principais

- Desenvolver, testar e manter a plataforma.
- Atrair clientes e freelancers para os dois lados do mercado.
- Intermediar contratações e pagamentos em custódia, com repasse e reembolso.
- Moderar perfis, conteúdo e avaliações e decidir disputas.
- Prevenir fraudes, por exemplo bloqueando contas e impedindo pagamentos em dobro, e oferecer suporte.

### 8. Parcerias principais

| Parceiro | Papel | Situação |
|---|---|---|
| Stripe | Cobrança por cartão, Pix e boleto, custódia, contas de recebimento (Connect) e repasse | Integrado, em modo de teste |
| Vercel | Hospedagem da aplicação web | Em uso |
| Render | Execução da API | Em uso |
| Neon | Banco PostgreSQL gerenciado | Em uso |
| Resend | Envio de e-mails transacionais | Em uso |
| Lojas de materiais de construção | Descontos e indicações para profissionais | Futuro |
| Agências e associações profissionais | Captação de profissionais | Futuro |
| Consultoria jurídica | Termos de uso e LGPD | Futuro |

### 9. Estrutura de custos

- **Desenvolvimento e manutenção:** hoje coberto pela equipe acadêmica.
- **Infraestrutura:** hospedagem, banco e backups. Hoje a plataforma usa planos gratuitos. Para produção, o Documento de Visão (seção 4.2) estima o custo dos planos pagos.
- **Tarifas de pagamento:** o processador cobra tarifas por transação e por repasse. A taxa de intermediação cobre essas tarifas.
- **Segurança, LGPD e moderação.**
- **Marketing, suporte e administração.**

## Mudanças em relação ao canvas original

| Bloco | Canvas original | Situação na versão entregue |
|---|---|---|
| Parcerias | "Gateways de pagamento e escrow" | Definido: Stripe, com Checkout e Connect, em modo de teste |
| Parcerias | "Provedores de nuvem e notificações" | Definidos: Vercel, Render, Neon e Resend |
| Recursos | "Plataforma web e mobile" | Web responsiva. O aplicativo nativo continua como plano futuro |
| Proposta de valor | Busca e contratação | Acrescentadas as demandas com propostas, que o canvas original não previa |
| Relacionamento | "Notificações e suporte" | Avisos internos, e-mail e chat por contratação |
| Relacionamento | "Programa de indicação" | Não implementado: plano futuro |
| Canais | "Futuro aplicativo móvel" | Mantido como futuro |
| Receita | Taxa, planos premium e destaque | A taxa de 10% funciona. Planos premium e destaque são planos futuros |
| Segmentos | "Agências de emprego" | Sem perfil próprio nesta versão: plano futuro |
