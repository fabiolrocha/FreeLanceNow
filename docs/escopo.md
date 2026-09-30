# Escopo e primeira entrega

O FreeLanceNow conecta clientes que precisam de serviços gerais a profissionais que os oferecem. O cliente encontra anúncios e acompanha sua contratação. O freelancer gerencia anúncios e responde às solicitações. O administrador acompanha usuários, categorias e moderação.

**Marco: 07/10/2026, quarta-feira, horário de Brasília.** Objetivo: demonstrar o frontend completo em modo mock e a primeira integração real com banco e autenticação, com código compartilhável entre os seis integrantes.

| Área | Base disponível | Critério da primeira entrega |
|---|---|---|
| Navegação pública | Início, busca, profissionais, detalhe, cadastro, login e ajuda | Rotas sem tela quebrada, acesso por URL e layout em celular |
| Cliente | Perfil, demandas/propostas, solicitações, acompanhamento, confirmação, contestação e avaliação simulados | Um fluxo completo demonstrável em uma sessão |
| Freelancer | Perfil, anúncios e solicitações; propostas e acompanhamento simulados | Criar rascunho, publicar, desativar e percorrer execução |
| Administração | Usuários, categorias, moderação, relatórios e financeiro simulados | Acesso mock por perfil, fila de denúncia/disputa e CSV |
| API e banco | Cadastro, login JWT, perfil privado/público, categorias e catálogo persistente | Migrações, validações, autorização e testes com PostgreSQL |
| Organização | Documentação, CI e fluxo Git | Cada integrante encontra sua tarefa, dependências e aceite |

**Persistência real:** usuário, categoria e anúncio. **Simulação:** contratação, avaliação, demanda, proposta, mensagem, notificação, denúncia, administração e financeiro. Mudar para `VITE_DATA_MODE=api` integra apenas o primeiro grupo; o segundo continua com aviso explícito.

Prioridade P0 é estabilidade dos dois caminhos de demonstração (mock e API). P1 é melhorar estados vazios, validações e experiência visual já existente. Nenhuma integração de pagamento ou chat real é condição para a entrega de outubro.

Após esse marco: contratação persistente, reputação e mediação; administração/auditoria; mensageria e e-mail; upload; pagamento e conciliação; qualidade de operação. Aplicativo móvel só será planejado depois de confirmação de demanda e novo escopo.
