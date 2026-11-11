# Contas para desenvolvimento local

Acessos fictícios para entrar no aplicativo enquanto trabalha no projeto. Logins da API local conferidos em **09/11/2026**. As senhas abaixo são públicas e exclusivas deste ambiente de desenvolvimento.

## Aplicação atual — modo API

Abra [o login local](http://127.0.0.1:5175/login). Depois de entrar, cliente/freelancer acessam o feed; administrador acessa a gestão.

| Perfil | Conta | E-mail | Senha | O que explorar |
|---|---|---|---|---|
| Cliente | Ana Lopes | `ana@demo.freelancenow.test` | `Demo12345` | Feed, publicação de demandas, solicitação de serviços e contratações |
| Freelancer | Marcos Vieira | `marcos@demo.freelancenow.test` | `Demo12345` | Feed, publicação de serviços, propostas, solicitações e painel |
| Administrador | Admin local de teste | `admin-e2e@example.test` | `Strong12345` | Usuários, categorias, moderação, relatórios e auditoria |

As três contas existem no PostgreSQL local atual. Ana e Marcos são criados pelo seed quando a API usa o perfil `dev` com `SEED_DEMO=true` (configuração do Compose local). O administrador foi provisionado explicitamente neste ambiente; **não é criado automaticamente em um banco novo**. O cadastro público não permite escolher ADMIN.

O endereço `5175` corresponde ao Vite desta sessão. Para iniciar o frontend nesse mesmo endereço, com banco/API ligados, execute a partir da raiz:

```sh
docker compose up -d db api
cd web
VITE_DATA_MODE=api npm run dev -- --port 5175 --strictPort
```

Se o servidor já estiver rodando, basta abrir o link. A API fica na porta `8081`. O frontend do Docker normalmente usa `http://127.0.0.1:5173`; nesse caso, confirme `VITE_DATA_MODE=api` antes de reconstruí-lo, conforme o [guia de desenvolvimento](desenvolvimento.md).

## Administrador em um banco local novo

Para recriar a conta administrativa de desenvolvimento acima, use o bootstrap explícito, na raiz do projeto:

```sh
ADMIN_BOOTSTRAP_ENABLED=true \
ADMIN_BOOTSTRAP_EMAIL=admin-e2e@example.test \
ADMIN_BOOTSTRAP_PASSWORD=Strong12345 \
ADMIN_BOOTSTRAP_NAME='Administrador local de teste' \
docker compose up -d --force-recreate api
```

Após a API iniciar e a conta existir, desabilite o bootstrap e retire a senha da configuração do container:

```sh
ADMIN_BOOTSTRAP_ENABLED=false \
ADMIN_BOOTSTRAP_EMAIL= \
ADMIN_BOOTSTRAP_PASSWORD= \
docker compose up -d --force-recreate api
```

O bootstrap não redefine senha, não reativa conta e não promove um cliente/freelancer existente. Se essa conta já existir com outra senha ou estiver suspensa, os comandos acima não alteram esse estado. Consulte [provisionamento do ADMIN](desenvolvimento.md#provisionar-o-primeiro-admin).

## Modo mock — demonstração sem API

Se a aplicação estiver com `VITE_DATA_MODE=mock`, use os botões Cliente/Freelancer/Admin da tela de login ou estas credenciais:

| Perfil | E-mail | Senha |
|---|---|---|
| Cliente | `ana@demo.freelancenow.test` | `Demo12345` |
| Freelancer | `marcos@demo.freelancenow.test` | `Demo12345` |
| Administrador | `admin@demo.freelancenow.test` | `Demo12345` |

O administrador do mock é diferente do administrador da API. As contas mock ficam na sessão do navegador; as contas da API ficam no PostgreSQL.

## Trocar de perfil e preservar os acessos

- Use **Sair da conta** e entre com o outro e-mail. No celular, a saída fica no menu da conta.
- A sessão da API dura 15 minutos. Se expirar, entre novamente.
- Reiniciar os containers preserva o banco local; remover o volume do PostgreSQL apaga as contas e os demais dados persistidos.
- Se um login falhar, confira primeiro se está usando API ou mock. No modo API, confirme que banco/API estão ligados e que a conta não foi suspensa.
