# Modelos editáveis

Fontes editáveis dos diagramas e dos documentos da entrega. Edite os arquivos desta pasta e gere de novo as imagens e os documentos com os comandos abaixo. Não edite os PNG nem os PDF à mão.

## Pré-requisitos

| Ferramenta | Versão | Uso |
|---|---|---|
| Node.js | 22.12 ou mais nova | Executa os geradores |
| Google Chrome ou Chromium | Qualquer versão recente | Renderiza os diagramas e os PDF |

## Conteúdo

| Arquivo | O que é |
|---|---|
| `*.mmd` | Diagramas em Mermaid: camadas, pacotes, implantação, estados, classes, sequências e modelo ER |
| `casos-de-uso.svg` | Diagrama UML de casos de uso (UC01 a UC11) |
| `bmc.html` | Business Model Canvas usado para gerar `docs/BMC/BMC.pdf` |
| `png/` | Imagens geradas a partir das fontes acima e usadas nos documentos |
| `gerador/` | Scripts que montam os DOCX e PDF da entrega |

## Gerar os diagramas

Execute os comandos a partir desta pasta (`docs/modelos`).

1. Gere um diagrama Mermaid. Troque `camadas` pelo nome do arquivo:

   ```bash
   npx -y @mermaid-js/mermaid-cli -i camadas.mmd -o png/camadas.png -s 2 -b white
   ```

2. Gere o diagrama de casos de uso a partir do SVG com o Chrome:

   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot="$PWD/png/casos-de-uso.png" --window-size=1180,900 --force-device-scale-factor=2 "file://$PWD/casos-de-uso.svg"
   ```

   No Windows ou no Linux, troque o caminho pelo executável do Chrome da máquina.

## Gerar os documentos

Execute os comandos a partir de `docs/modelos/gerador`.

1. Instale as dependências. Isso cria `node_modules`, que não vai no `.zip` da entrega:

   ```bash
   npm install
   ```

2. Gere todos os documentos:

   ```bash
   npm run todos
   ```

   Para gerar um documento só, use `npm run visao`, `npm run arquitetura`, `npm run dados` ou `npm run bmc`.

3. Se o puppeteer não encontrar um navegador, informe o caminho do Chrome:

   ```bash
   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run todos
   ```

| Script | Fonte | Saída em `docs/` |
|---|---|---|
| `visao` | `visao.js` | `Documento de Visao/Documento-de-Visao.docx` e `.pdf` |
| `arquitetura` | `arq.js` | `Documento de Arquitetura/Documento-de-Arquitetura.docx` e `.pdf` |
| `dados` | `dados.js` | `DADOS/DADOS.docx` e `.pdf` |
| `bmc` | `../bmc.html` | `BMC/BMC.pdf` |

`render.js` guarda o layout comum: capa, sumário, cabeçalho, rodapé, tabelas e figuras. Os documentos são escritos como listas de blocos (`h1`, `h2`, `h3`, `p`, `ul`, `table`, `fig`).

No Word, o sumário do DOCX mostra os números de página depois de um clique com o botão direito em **Atualizar campo**. O PDF já sai com o sumário completo.
