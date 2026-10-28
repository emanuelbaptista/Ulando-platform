# Ulandu — preparação para Vercel + Supabase

O frontend fica no diretório `public/`. As funções HTTP ficam em `api/index.js`. A persistência usa PostgreSQL no Supabase e os uploads usam Supabase Storage. O projeto não depende de SQLite nem de uploads gravados no disco da função serverless.

## Antes de publicar (obrigatório)

Não é possível concluir a ligação real sem criar/configurar os serviços na tua própria conta. Não coloques chaves privadas no código nem no GitHub.

### 1. Criar a base de dados
1. Cria um projeto em https://supabase.com/.
2. Abre **SQL Editor → New query**.
3. Cola todo o conteúdo de `schema.sql` e executa.
4. Em **Project Settings → Database**, copia a connection string URI. Se o Supabase indicar um connection pooler para serverless, usa essa opção.

### 2. Criar o armazenamento de media
1. Em Supabase, abre **Storage → New bucket**.
2. Dá o nome `ulandu-media` e ativa **Public bucket** para que imagens e vídeos publicados possam ser vistos no site.
3. Copia o Project URL e a chave **service_role/secret**. A chave service role só pode ser guardada como variável de ambiente no servidor Vercel; nunca a publiques nem a coloques em código do navegador.

### 3. Publicar na Vercel
1. Coloca a pasta deste projeto num repositório GitHub. Confirma que `.env` não está no repositório (o `.gitignore` já o exclui).
2. Na Vercel, importa esse repositório como um novo projeto.
3. Adiciona as variáveis em **Settings → Environment Variables** para Production e Preview conforme necessário:
   - `DATABASE_URL`: connection string PostgreSQL do Supabase.
   - `SESSION_SECRET`: segredo aleatório com pelo menos 32 caracteres.
   - `ADMIN_EMAIL`: e-mail do primeiro administrador.
   - `ADMIN_PASSWORD`: palavra-passe forte com pelo menos 12 caracteres.
   - `SUPABASE_URL`: Project URL do Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave secreta do servidor.
   - `SUPABASE_STORAGE_BUCKET`: `ulandu-media`.
4. Em **Build and Development Settings**, não definas um build command personalizado. A Vercel publica os ficheiros estáticos de `public/` e a função de `api/`.
5. Faz Deploy. Depois abre `https://TEU-DOMINIO/api/health`. O resultado esperado é `{"ok":true,"configured":true,"database":"connected"}`.
6. Abre `/admin.html`, entra com `ADMIN_EMAIL` e `ADMIN_PASSWORD` configurados na Vercel, cria uma publicação de teste e confirma que aparece no site. Depois apaga o teste.

### 4. Segurança
- Nunca publiques `.env`, `DATABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY`.
- O primeiro administrador é criado na primeira tentativa de login a partir das variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD`, se ainda não existir.
- Para trocar a palavra-passe de um administrador já existente, usa a gestão de administradores no painel; mudar `ADMIN_PASSWORD` não substitui a palavra-passe de uma conta já criada.
- Limita o acesso ao repositório e às configurações da Vercel/Supabase.

## Verificações
- `npm run check` valida sintaxe do servidor e da função API.
- `/api/health` verifica as variáveis necessárias e a ligação à base de dados.
- A validação final de login, upload e publicação só pode ser feita depois de ligar credenciais reais do teu Supabase e publicar na tua conta Vercel.

## Nota sobre o servidor local antigo
O comando `npm start` é o servidor local legado e ainda utiliza SQLite. A implantação Vercel usa `api/index.js` e PostgreSQL/Supabase. Para desenvolvimento local da versão Vercel, configura as mesmas variáveis de ambiente e usa a Vercel CLI (`vercel dev`).
