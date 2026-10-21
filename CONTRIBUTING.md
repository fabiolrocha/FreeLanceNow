# Contribuir com o FreeLanceNow

Revisado em **21/10/2026**. Consulte o [backlog](docs/backlog.md) para escolher uma entrega e o [guia de colaboração](docs/equipe.md) para combinar mudanças com o grupo. Não há donos de áreas ou revisores predefinidos. Toda contribuição usa branch e PR revisado por outro integrante disponível.

## Branch e revisão

Comece pela `main` atualizada, que contém o marco inicial e as fases já integradas:

```sh
git switch main
git pull --ff-only origin main
git switch -c codex/f04-administracao
```

O prefixo `codex/` é a convenção deste workspace. Use um nome que descreva a entrega, mesmo quando ela não tiver card. Não é necessário partir de branches antigas como `codex/bootstrap-freelancenow` ou de fases já integradas.

Faça commits pequenos e confira `git status` e `git diff` antes de adicionar arquivos. Não versionar `.env`, tokens, `node_modules`, `dist`, `target`, logs ou dados pessoais novos. O PR deve descrever problema/resultado, card quando houver, validação e limites. Solicite revisão conforme disponibilidade; integre após aceite, revisão e checks relevantes, sem push direto de funcionalidades na principal.

## Verificações por tipo de mudança

| Mudança | Validação |
|---|---|
| Documentação | Conferir links, comandos, estado mock/API e `git diff --check`; executar `node scripts/verify-documents.mjs` na raiz |
| React | Lint, build e testes relevantes; `npm run format:check` e navegador quando o fluxo mudar |
| API/banco | Testes com PostgreSQL exclusivo; conferir migração, autorização e cenários negativos |
| Contrato HTTP | Atualizar DTO, tipos, adapter/store, interface e `docs/api.md`; verificar o fluxo integrado |

O [guia de testes](docs/testes-e-demonstracao.md) traz os comandos completos. Documente os comandos realmente executados no PR; registros antigos não comprovam a versão atual.

## Arquivos e contratos compartilhados

Não modificar migrações já aplicadas. Crie a próxima versão livre — atualmente após `V5` — e confira a numeração com o trabalho em andamento. Mudanças em banco e contrato devem incluir os documentos afetados.

`App.tsx`, `Layout.tsx`, store, tipos, client, fixtures e CSS são compartilhados. Combine trechos em edição com o grupo. Resolva conflitos preservando os fluxos envolvidos e execute a verificação correspondente.

Fontes em `docs/originais/`, `docs/prototipo/`, `docs/legado/` e `docs/referencias/` são históricas; corrija a especificação nos Markdown atuais. Branch protection e acesso ao repositório são configurações administrativas, não garantias deste fluxo documentado.
