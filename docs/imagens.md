# Imagens e identidade visual

Revisado em **21/10/2026**. **Decisão registrada (Passo 0):** o produto utiliza a **logo oficial em SVG** (`web/public/images/logo.svg` e `web/public/favicon.svg`), **ícones vetoriais Lucide por categoria** nos cards do catálogo e **avatares com iniciais** para os perfis até a etapa de upload de imagens (`F06`).

| Material existente | O que contém | Uso atual |
|---|---|---|
| `originais/BMC.png` | Business Model Canvas | Documentação |
| Imagens dos DOCX | Diagramas de arquitetura, casos de uso e contexto do grupo | Documentação |
| FreeLanceNOW DOCX/PDF | Fotos/carômetro de integrantes e apresentação acadêmica | Apenas original; não representar clientes/freelancers |
| PPTX | Ícones e figuras de apresentação/documentação | Referência, sem selecionar como assets definitivos |
| HTML original | Placeholders e ícones; não contém catálogo fotográfico pronto | Referência visual |
| `web/public/images/logo.svg` e `web/public/favicon.svg` | Símbolo vetorial autoral "F + centelha" nas cores `#16854c` / `#174b35` / `#70b793` | Marca oficial no cabeçalho, rodapé e aba do navegador |

## Decisões registradas

| ID | Decisão | Status |
|---|---|---|
| IMG01 | Logo oficial criada em SVG (`web/public/images/logo.svg` e `web/public/favicon.svg`) | Concluído |
| IMG02 | Ícones Lucide por categoria no catálogo; fotos reais dependem de `F06` | Ícones disponíveis; upload pendente |
| IMG03 | Avatares com iniciais por padrão na demonstração | Concluído |
| IMG04 | Manter registro de origem e autorização/licença dos assets utilizados | Conferir antes de distribuição pública; não há arquivo LICENSE na raiz |

A escolha deve identificar arquivo, finalidade, autor/origem e licença/autorização. Fotos de colegas, clientes ou profissionais não entram automaticamente na interface. Não foi gerada nem baixada imagem de terceiros para preencher essa lacuna.

## Convenção para novos ativos

Assets estáticos: `web/public/images/` com nomes descritivos em minúsculas. Registrar aqui o caminho, origem e uso. A identidade atual já está definida; novos ativos não dependem de uma pessoa designada para a área. Preferir WebP/AVIF para fotos e SVG validado para marca; dimensionar conforme cards e detalhamento, sem ampliar arquivos grandes desnecessariamente. Ícones decorativos usam `aria-hidden`; fotos informativas precisam de texto alternativo adequado.

Upload de usuário será uma feature diferente, com storage e validação server-side: até 5 JPG/PNG de até 5 MB por serviço, conforme UC02. Selecionar imagens estáticas não significa que upload já esteja implementado.
