# Contribuir com o FreeLanceNow

Consulte [equipe](docs/equipe.md) e [backlog](docs/backlog.md) antes de escolher arquivos. O líder coordena a integração. Toda tarefa usa uma branch e um PR revisado; não fazer push direto de funcionalidades na principal.

```sh
git switch main
git pull --ff-only
git switch -c codex/w01-catalogo
```

Antes da integração do bootstrap, crie sua branch a partir de `codex/bootstrap-freelancenow`. Após a integração, use `main`. O prefixo `codex/` é a convenção inicial deste workspace; nomes dos cards ajudam a identificar as tarefas.

Faça commits pequenos com descrição clara em português ou inglês. Comandos úteis: `git status`, `git diff`, `git add <arquivos>`, `git commit`. Confira o diff antes do commit; não commitar `.env`, tokens, `node_modules`, `dist`, `target`, logs ou dados pessoais novos.

Para React, rode lint, build e testes relevantes. Use `npm run format` para formatação e `npm run format:check` para conferir. Para API, rode testes com PostgreSQL isolado. Alteração de regra requer verificação do comportamento, sem criar testes que apenas repetem a implementação.

Não modificar migração já aplicada. Crie uma nova `V3__descricao.sql` (ou próximo número livre) e coordene a numeração com Felipe. Mudanças em DTO exigem atualizar tipos/adapter/frontend e `docs/api.md` no mesmo conjunto de PRs.

Arquivos compartilhados (`App`, `Layout`, store, tipos, client, fixtures e CSS) exigem combinação com os responsáveis. Resolva conflitos entendendo ambos os fluxos; não descarte alterações do colega para fazer build passar.

Use o modelo de PR com problema/resultado, card, teste e limitações. Peça revisão ao par da tabela. O líder integra quando o aceite é cumprido e a CI está verde. Branch protection e convites de colaboradores dependem da administração do repositório e não foram configurados automaticamente.
