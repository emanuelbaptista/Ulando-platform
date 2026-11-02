require("dotenv").config();
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "ulandu-local-dev-secret",
    resave: true,
    saveUninitialized: true,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 
    }
  })
);

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");

// Ligação prioritária ao PostgreSQL / Supabase
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log("Ligação ao PostgreSQL/Supabase configurada com sucesso.");
  } catch (e) {
    console.error("Erro ao configurar pool PostgreSQL:", e);
  }
}

// Fallback local seguro (em memória e disco para desenvolvimento local)
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(ROOT, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
let memoryContent = [];

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONTENT_FILE)) {
      fs.writeFileSync(CONTENT_FILE, JSON.stringify([]));
    }
  } catch (e) {
    console.error("Aviso no diretório de dados:", e);
  }
}

ensureDataDir();

function readLocalContent() {
  try {
    ensureDataDir();
    if (fs.existsSync(CONTENT_FILE)) {
      const data = fs.readFileSync(CONTENT_FILE, 'utf8');
      const parsed = JSON.parse(data || '[]');
      if (Array.isArray(parsed)) {
        memoryContent = parsed;
      }
    }
  } catch (e) {
    console.error("Aviso ao ler ficheiro local:", e);
  }
  return memoryContent;
}

function writeLocalContent(contentList) {
  memoryContent = contentList;
  try {
    ensureDataDir();
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(contentList, null, 2));
  } catch (e) {
    console.warn("Aviso ao escrever em disco:", e);
  }
}

// Função para gerar slug único
function generateSlug(title) {
  return String(title || 'conteudo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-' + Date.now();
}

app.use(express.static(PUBLIC));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

const admins = [
  { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  { email: process.env.ADMIN_EMAIL_2, password: process.env.ADMIN_PASSWORD_2 },
  { email: process.env.ADMIN_EMAIL_3, password: process.env.ADMIN_PASSWORD_3 },
  { email: process.env.ADMIN_EMAIL_4, password: process.env.ADMIN_PASSWORD_4 }
];

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e palavra-passe são obrigatórios.' });
  }
  const isValidAdmin = admins.some(
    admin => admin.email && admin.password &&
      admin.email.toLowerCase() === email.toLowerCase().trim() &&
      admin.password === password
  );
  if (isValidAdmin) {
    req.session.user = { email, role: 'admin' };
    req.session.isAdmin = true;
    return res.json({ ok: true, admin: { email } });
  } else {
    return res.status(401).json({ error: 'E-mail ou palavra-passe incorretos.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  return res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  if (req.session && (req.session.user || req.session.isAdmin)) {
    return res.json({ authenticated: true, admin: req.session.user || { email: 'admin@ulando.online' } });
  }
  return res.json({ authenticated: false });
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/admin/upload', (req, res) => {
  try {
    upload.single('file')(req, res, (err) => {
      if (err || !req.file) {
        return res.status(400).json({ error: 'Escolhe primeiro um ficheiro.' });
      }
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const mime = req.file.mimetype;
      const dataUrl = `data:${mime};base64,${b64}`;
      return res.json({ url: dataUrl, path: dataUrl, filename: req.file.originalname });
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar o upload.' });
  }
});

// ==========================================
// ROTAS DE CONTEÚDO (POSTGRESQL + FALLBACK)
// ==========================================

app.get('/api/content', async (req, res) => {
  const type = req.query.type;
  if (pool) {
    try {
      let query = 'SELECT * FROM content WHERE published = true';
      let params = [];
      if (type) {
        query += ' AND type = $1';
        params.push(type);
      }
      query += ' ORDER BY created_at DESC';
      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (e) {
      console.error("Erro na BD /api/content, a usar fallback:", e);
    }
  }
  
  let content = readLocalContent();
  content = content.filter(item => 
    item.published === true || item.published === 1 || item.published === '1' || item.published === 'true'
  );
  if (type) {
    content = content.filter(item => item.type === type);
  }
  return res.json(content);
});

app.get('/api/admin/content', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM content ORDER BY created_at DESC');
      const rows = result.rows.map(row => ({
        ...row,
        published: row.published ? 1 : 0
      }));
      return res.json(rows);
    } catch (e) {
      console.error("Erro na BD /api/admin/content, a usar fallback:", e);
    }
  }
  return res.json(readLocalContent());
});

app.post('/api/admin/content', async (req, res) => {
  try {
    const d = req.body;
    const type = d.type || 'news';
    const title = d.title || 'Sem título';
    const slug = d.slug || generateSlug(title);
    const summary = d.summary || '';
    const body = d.body || '';
    const category = d.category || '';
    const image = d.image || '';
    const media_url = d.media_url || d.mediaUrl || '';
    const published = d.published === true || d.published === 1 || d.published === '1' || d.published === 'true';

    if (pool) {
      try {
        const query = `
          INSERT INTO content (type, title, slug, summary, body, category, image, media_url, published, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING *;
        `;
        const values = [type, title, slug, summary, body, category, image, media_url, published];
        const result = await pool.query(query, values);
        const created = result.rows[0];
        created.published = created.published ? 1 : 0;
        return res.json(created);
      } catch (dbErr) {
        console.error("Erro ao inserir na BD PostgreSQL, a usar fallback local:", dbErr);
      }
    }

    let items = readLocalContent();
    const item = {
      id: Date.now().toString(),
      type,
      title,
      slug,
      summary,
      body,
      category,
      image,
      media_url,
      published: published ? 1 : 0,
      created_at: new Date().toISOString()
    };
    items.unshift(item);
    writeLocalContent(items);
    return res.json(item);
  } catch (err) {
    console.error("Erro no POST /api/admin/content:", err);
    return res.status(500).json({ error: err.message || 'Erro ao guardar o conteúdo.' });
  }
});

app.put('/api/admin/content/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const d = req.body;
    const published = d.published === true || d.published === 1 || d.published === '1' || d.published === 'true';

    if (pool) {
      try {
        const query = `
          UPDATE content 
          SET type = COALESCE($1, type),
              title = COALESCE($2, title),
              summary = COALESCE($3, summary),
              body = COALESCE($4, body),
              category = COALESCE($5, category),
              image = COALESCE($6, image),
              media_url = COALESCE($7, media_url),
              published = COALESCE($8, published),
              updated_at = NOW()
          WHERE id = $9
          RETURNING *;
        `;
        const values = [d.type, d.title, d.summary, d.body, d.category, d.image, d.media_url || d.mediaUrl, published, isNaN(id) ? null : Number(id)];
        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
          const updated = result.rows[0];
          updated.published = updated.published ? 1 : 0;
          return res.json(updated);
        }
      } catch (dbErr) {
        console.error("Erro ao atualizar na BD PostgreSQL, a usar fallback local:", dbErr);
      }
    }

    let items = readLocalContent();
    const i = items.findIndex(x => String(x.id) === String(id));
    if (i < 0) {
      return res.status(404).json({ error: 'Conteúdo não encontrado.' });
    }
    items[i] = { 
      ...items[i], 
      ...d, 
      published: published ? 1 : 0 
    };
    writeLocalContent(items);
    return res.json(items[i]);
  } catch (err) {
    console.error("Erro no PUT /api/admin/content/:id:", err);
    return res.status(500).json({ error: err.message || 'Erro ao atualizar o conteúdo.' });
  }
});

app.delete('/api/admin/content/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (pool) {
      try {
        await pool.query('DELETE FROM content WHERE id = $1', [isNaN(id) ? null : Number(id)]);
        return res.json({ ok: true });
      } catch (dbErr) {
        console.error("Erro ao eliminar na BD PostgreSQL, a usar fallback local:", dbErr);
      }
    }

    let items = readLocalContent();
    items = items.filter(x => String(x.id) !== String(id));
    writeLocalContent(items);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro no DELETE /api/admin/content/:id:", err);
    return res.status(500).json({ error: err.message || 'Erro ao eliminar o conteúdo.' });
  }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
  });
}

module.exports = app;