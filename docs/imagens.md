# Imagens e identidade visual

**Decisão pendente do líder:** quais imagens realmente serão usadas no produto. Foi solicitada a escolha entre ícones/iniciais, fotografias reais autorizadas e ilustrações de serviço. Enquanto a resposta não chega, a base usa **ícones por categoria e avatares com iniciais**, sem bloquear a entrega.

| Material existente | O que contém | Uso atual |
|---|---|---|
| `originais/BMC.png` | Business Model Canvas | Documentação |
| Imagens dos DOCX | Diagramas de arquitetura, casos de uso e contexto do grupo | Documentação |
| FreeLanceNOW DOCX/PDF | Fotos/carômetro de integrantes e apresentação acadêmica | Apenas original; não representar clientes/freelancers |
| PPTX | Ícones e figuras de apresentação/documentação | Referência, sem selecionar como assets definitivos |
| HTML original | Placeholders e ícones; não contém catálogo fotográfico pronto | Referência visual |
| React atual | Lucide, Public Sans e marca tipográfica provisória “F” | Interface de demonstração |

## Decisões a registrar

| ID | Decisão | Responsável | Prazo sugerido |
|---|---|---|---|
| IMG01 | Manter marca tipográfica ou fornecer logo final | Líder | 01/10 |
| IMG02 | Fotos reais de serviços ou ilustrações? Quais categorias? | Líder + Arthur Almirante | 01/10 |
| IMG03 | Avatares reais ou iniciais na apresentação? | Líder | 01/10 |
| IMG04 | Origem/licença/autorização dos arquivos escolhidos | Quem fornecer + líder | Antes do commit do asset |

A escolha deve identificar arquivo, finalidade, autor/origem e licença/autorização. Fotos de colegas, clientes ou profissionais não entram automaticamente na interface. Não foi gerada nem baixada imagem de terceiros para preencher essa lacuna.

## Convenção quando os ativos forem escolhidos

Assets estáticos: `web/public/images/` com nomes descritivos em minúsculas. Registrar aqui o caminho, origem e uso. Preferir WebP/AVIF para fotos e SVG validado para marca; dimensionar conforme cards e detalhamento, sem ampliar arquivos grandes desnecessariamente. Ícones decorativos usam `aria-hidden`; fotos informativas precisam de texto alternativo adequado.

Upload de usuário será uma feature diferente, com storage e validação server-side: até 5 JPG/PNG de até 5 MB por serviço, conforme UC02. Selecionar imagens estáticas não significa que upload já esteja implementado.
