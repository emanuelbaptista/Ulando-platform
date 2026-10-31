require("dotenv").config();
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Caminho seguro para dados (usa /tmp na Vercel)
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(ROOT, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");

// Memória em cache para garantir 100% de fiabilidade sem falhas de disco
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

function readContent() {
  try {
    ensureDataDir();
    if (fs.existsSync(CONTENT_FILE)) {
      const data = fs.readFileSync(CONTENT_FILE, 'utf8');
      const parsed = JSON.parse(data || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryContent = parsed;
      }
    }
  } catch (e) {
    console.error("Aviso ao ler ficheiro:", e);
  }
  return memoryContent;
}

function writeContent(contentList) {
  memoryContent = contentList;
  try {
    ensureDataDir();
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(contentList, null, 2));
  } catch (e) {
    console.warn("Aviso ao escrever em disco (a utilizar cache em memória):", e);
  }
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
// ROTAS DE CONTEÚDO BLINDADAS
// ==========================================

app.get('/api/content', (req, res) => {
  let content = readContent();
  const type = req.query.type;

  content = content.filter(item => 
    item.published === true || item.published === 1 || item.published === '1' || item.published === 'true'
  );

  if (type) {
    content = content.filter(item => item.type === type);
  }

  return res.json(content);
});

app.get('/api/admin/content', (req, res) => {
  const content = readContent();
  return res.json(content);
});

app.post('/api/admin/content', (req, res) => {
  try {
    const d = req.body;
    let items = readContent();
    const item = { 
      ...d, 
      id: Date.now().toString(), 
      created_at: new Date().toISOString() 
    };
    items.unshift(item);
    writeContent(items);
    return res.json(item);
  } catch (err) {
    console.error("Erro no POST /api/admin/content:", err);
    return res.status(500).json({ error: err.message || 'Erro ao guardar o conteúdo.' });
  }
});

app.put('/api/admin/content/:id', (req, res) => {
  try {
    const id = req.params.id;
    const d = req.body;
    let items = readContent();
    const i = items.findIndex(x => String(x.id) === String(id));
    if (i < 0) {
      return res.status(404).json({ error: 'Conteúdo não encontrado.' });
    }
    items[i] = { ...items[i], ...d };
    writeContent(items);
    return res.json(items[i]);
  } catch (err) {
    console.error("Erro no PUT /api/admin/content/:id:", err);
    return res.status(500).json({ error: err.message || 'Erro ao atualizar o conteúdo.' });
  }
});

app.delete('/api/admin/content/:id', (req, res) => {
  try {
    const id = req.params.id;
    let items = readContent();
    items = items.filter(x => String(x.id) !== String(id));
    writeContent(items);
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