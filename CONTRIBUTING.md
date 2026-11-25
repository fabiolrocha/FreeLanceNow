# Contribuir com o FreeLanceNow

Toda mudança usa uma branch e um pull request revisado por outro integrante. Não há donos fixos de áreas nem revisores predefinidos.

## Branch e revisão

Comece pela `main` atualizada:

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/nome-da-entrega
```

Faça commits pequenos e confira `git status` e `git diff` antes de adicionar arquivos. Não versione `.env`, tokens, `node_modules`, `dist`, `target`, logs, cópias do banco ou dados pessoais. O pull request descreve o problema, o resultado, a validação feita e os limites conhecidos. Integre depois da revisão e das verificações da CI, sem push direto na `main`.

## Verificações por tipo de mudança

| Mudança | Validação |
|---|---|
| Documentação | Conferir links, comandos e `git diff --check` |
| React | `npm run lint`, `npm run format:check`, `npm run build`, `npm test` e o navegador quando o fluxo mudar |
| API e banco | `docker compose --profile test run --rm api-test`; conferir migração, autorização e cenários negativos |
| Contrato HTTP | Atualizar DTO, tipos, cliente HTTP, telas e `docs/api.md`; verificar o fluxo integrado |

O [guia de testes](docs/testes-e-demonstracao.md) traz os comandos completos.

## Arquivos compartilhados

Não altere migrações já aplicadas. Crie a próxima versão livre, hoje depois de `V18`, e atualize o [modelo de dados](docs/DADOS/DADOS.pdf) com o [gerador](docs/modelos/README.md).

`App.tsx`, `Layout.tsx`, store, tipos, cliente HTTP, fixtures e CSS são compartilhados. Combine com o grupo antes de editar trechos em uso por outra pessoa.

Os arquivos em `docs/originais/` e `docs/prototipo/` são fontes históricas. Não os altere: registre mudanças de especificação nos documentos atuais.
