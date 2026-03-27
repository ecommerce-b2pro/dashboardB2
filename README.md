# 📊 Hub de Vendas — Dashboard B2

Dashboard de vendas com importação de Excel, autenticação JWT e banco de dados SQLite.

---

## 🚀 Deploy em 5 minutos no Render.com (gratuito)

### Passo 1 — Criar conta no Render.com
Acesse [render.com](https://render.com) e crie uma conta gratuita (pode entrar com o GitHub).

### Passo 2 — Novo serviço
1. Clique em **"New +"** → **"Web Service"**
2. Selecione **"Build and deploy from a Git repository"**
3. Conecte sua conta GitHub e selecione o repositório **`dashboardB2`**
4. Clique em **"Connect"**

### Passo 3 — Configurar o serviço
O `render.yaml` já preenche tudo automaticamente. Confirme as configurações:

| Campo | Valor |
|---|---|
| **Name** | `dashboard-vendas` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### Passo 4 — Variáveis de ambiente
Na tela de configuração, adicione as variáveis abaixo em **"Environment Variables"**:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(gere uma senha forte com 40+ caracteres)* |
| `JWT_EXPIRES_IN` | `8h` |
| `ADMIN_EMAIL` | `seu@email.com` |
| `ADMIN_PASSWORD` | *(sua senha de administrador)* |

> 💡 **Dica:** O `render.yaml` já configura `JWT_SECRET` e `ADMIN_PASSWORD` com geração automática de valor seguro. Se usar o arquivo, essas variáveis são preenchidas automaticamente.

### Passo 5 — Deploy
Clique em **"Create Web Service"**. O Render vai:
1. Instalar as dependências (`npm install`)
2. Iniciar o servidor (`npm start`)
3. Gerar uma URL pública no formato `https://dashboard-vendas-xxxx.onrender.com`

---

## 🔑 Primeiro acesso

Após o deploy, acesse a URL gerada pelo Render e faça login com:

- **E-mail:** o valor de `ADMIN_EMAIL` (padrão: `admin@hubvendas.com`)
- **Senha:** o valor de `ADMIN_PASSWORD` (padrão: `TroqueEstaSenhaAgora123!`)

> ⚠️ **Troque a senha padrão imediatamente após o primeiro login!**

---

## 💻 Rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com seus valores

# 3. Iniciar o servidor
npm start

# 4. Acessar no navegador
# http://localhost:3000
```

---

## 📁 Estrutura do projeto

```
dashboardB2/
├── server.js              # Servidor Express (API + serve do frontend)
├── dashboard.html         # Frontend single-page (HTML/CSS/JS)
├── package.json           # Dependências Node.js
├── render.yaml            # Configuração de deploy automático (Render.com)
├── Procfile               # Configuração para Heroku/Railway
├── .env.example           # Modelo de variáveis de ambiente
├── criar_exemplo.js       # Script para gerar Excel de exemplo
├── exemplo_importacao.xlsx # Planilha de exemplo para importação
└── INSTRUÇÕES_IMPORTAÇÃO.md # Como importar dados via Excel
```

---

## 🌐 Outras plataformas de deploy

### Railway.app
1. Acesse [railway.app](https://railway.app) e crie uma conta
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione o repositório e configure as variáveis de ambiente
4. O `Procfile` é reconhecido automaticamente

### Heroku
```bash
# Instalar o CLI do Heroku e fazer login
heroku create meu-dashboard-vendas
heroku config:set NODE_ENV=production JWT_SECRET=<segredo> ADMIN_EMAIL=seu@email.com ADMIN_PASSWORD=<senha>
git push heroku main
```

---

## 🔧 Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não | Porta do servidor (padrão: `3000`) |
| `NODE_ENV` | Sim (prod) | `production` em deploy, `development` localmente |
| `JWT_SECRET` | Sim | Segredo para assinar tokens JWT (mín. 32 chars) |
| `JWT_EXPIRES_IN` | Não | Validade do token (padrão: `8h`) |
| `ADMIN_EMAIL` | Não | E-mail do administrador |
| `ADMIN_PASSWORD` | Não | Senha inicial do administrador |
| `DATA_DIR` | Não | Caminho do banco SQLite (padrão: `./data`; use `/var/data` no Render) |
