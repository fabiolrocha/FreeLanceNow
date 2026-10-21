# Colaboração da equipe

Revisado em **21/10/2026**. O trabalho é organizado por entregas, dependências e critérios de aceite. **Não há designação fixa de pessoas para casos de uso, funcionalidades, arquivos ou revisões.** A antiga tabela de delegação foi retirada; seu histórico permanece no Git.

Qualquer integrante pode contribuir em uma tarefa do [backlog](backlog.md). Combine o trabalho em andamento com o grupo para evitar edições concorrentes e registre no PR o resultado, as dependências e a validação. A revisão pode ser feita por outro integrante disponível, sem par predefinido.

## Fluxo de colaboração

1. Atualize a `main` e crie uma branch para a entrega, conforme [CONTRIBUTING](../CONTRIBUTING.md).
2. Escolha uma tarefa pelo resultado esperado e confira suas dependências. A escolha não torna a área exclusiva de uma pessoa.
3. Faça mudanças pequenas que incluam os contratos, tipos, testes e documentos afetados.
4. Abra um PR com evidência do critério de aceite e solicite revisão de outro integrante disponível.
5. Integre após revisão e verificações relevantes; atualize o estado do backlog e as limitações conhecidas.

## Pontos que exigem coordenação

| Mudança | O que conferir em conjunto |
|---|---|
| DTO ou endpoint | Backend, `web/src/domain/types.ts`, `web/src/data/client.ts`, store e contrato da API |
| Banco | Próximo número de migração disponível e compatibilidade; não editar migrações já aplicadas |
| Fluxo de negócio | Permissões, transições, modo mock, modo API e critérios de aceite |
| Navegação ou layout | `App.tsx`, `Layout.tsx`, componentes e CSS compartilhados; combinar trechos em edição |
| Documentação | Estado implementado versus planejado; links, comandos e roteiro coerentes |

O aceite depende do comportamento demonstrado, não de quem implementou. A entrega final permanece em **18/11/2026**; o [roadmap](roadmap.md) organiza as janelas de trabalho sem distribuir nomes.
