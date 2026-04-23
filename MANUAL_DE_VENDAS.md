# 🚀 Guia de Implantação e Vendas — Heroic Leap

Este manual descreve o processo passo a passo para entregar o sistema para um novo cliente usando a estratégia de **Infraestrutura Isolada e Código Centralizado**.

---

## 🏗️ Parte 1: Configurando o Banco de Dados do Cliente (Supabase)

Cada cliente novo deve ter o seu próprio projeto no Supabase (plano gratuito ou pago).

1. **Crie o Projeto:** No Supabase, clique em `New Project` e escolha a região **São Paulo (sa-east-1)**.
2. **Execute o SQL:** 
   - No menu lateral, vá em **SQL Editor**.
   - Clique em **+ New query**.
   - Abra o arquivo [setup_banco_novo_cliente.sql](./setup_banco_novo_cliente.sql), copie todo o conteúdo e cole no editor do Supabase.
   - Clique em **RUN**.
3. **Pegue as Chaves:**
   - Vá em **Project Settings** > **API**.
   - Copie a `Project URL` e a `anon public key`. Você precisará delas no próximo passo.

---

## 🌐 Parte 2: Publicando o Site do Cliente (Vercel)

Você usará o seu repositório atual do GitHub para todos os clientes.

1. **Novo Projeto:** No painel da Vercel, clique em **Add New > Project**.
2. **Selecione o Repositório:** Escolha o mesmo repositório que você já usa (`sistemacompleto`).
3. **Configure as Variáveis:** Antes de clicar em Deploy, abra a seção **Environment Variables** e adicione:
   - `VITE_SUPABASE_URL` = (Cole a URL do Supabase do cliente)
   - `VITE_SUPABASE_ANON_KEY` = (Cole a Key Anon do cliente)
4. **Deploy:** Clique em **Deploy**.
5. **Domínio:** Se o cliente tiver um domínio próprio (ex: `crm.advocacia.com.br`), você adiciona em **Settings > Domains**.

---

## 🤖 Parte 3: Automação (n8n)

Se o cliente for usar os robôs do WhatsApp/Lembretes:

1. **Importação:** Importe os arquivos JSON da pasta `/automacoes` para o n8n do cliente.
2. **Conexão:** Nos nós do **Supabase**, você precisará atualizar a conexão para apontar para a URL/Key do novo cliente.
3. **Chatwoot:** Configure a URL e o Token do Chatwoot no fluxo de mensagens.

---

## ✅ Lista de Verificação Final (Checklist)

- [ ] O cliente consegue fazer login?
- [ ] O CRM carrega as colunas (Iniciou, Conversando, etc.)?
- [ ] O botão "Novo Lead" insere dados no banco dele?
- [ ] O SQL foi rodado com sucesso sem erros?

---

### 🛡️ Segurança e Propriedade
- **Você** é o dono do código no GitHub.
- **O Cliente** é o dono dos dados no Supabase.
- Se você atualizar o **GitHub**, o site de **todos** os clientes atualiza sozinho!

---

**Dúvidas ou suporte?** Use o comando `git push` para garantir que este manual esteja sempre atualizado na nuvem!
