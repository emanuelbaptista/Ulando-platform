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

// Configuração da Sessão
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
const DATA_DIR = path.join(ROOT, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");

// Garantir diretório de dados local
if (!process.env.VERCEL) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONTENT_FILE)) {
      fs.writeFileSync(CONTENT_FILE, JSON.stringify([]));
    }
  } catch (e) {
    console.error("Erro ao gerir diretório de dados:", e);
  }
}

// Função auxiliar para ler conteúdos
function readContent() {
  try {
    if (fs.existsSync(CONTENT_FILE)) {
      const data = fs.readFileSync(CONTENT_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    console.error("Erro ao ler content.json:", e);
  }
  return [];
}

// Função auxiliar para escrever conteúdos
function writeContent(contentList) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(contentList, null, 2));
  } catch (e) {
    console.error("Erro ao escrever content.json:", e);
  }
}

app.use(express.static(PUBLIC));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

// Array com os 4 administradores configurados no .env
const admins = [
  { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  { email: process.env.ADMIN_EMAIL_2, password: process.env.ADMIN_PASSWORD_2 },
  { email: process.env.ADMIN_EMAIL_3, password: process.env.ADMIN_PASSWORD_3 },
  { email: process.env.ADMIN_EMAIL_4, password: process.env.ADMIN_PASSWORD_4 }
];

// Rota de login
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

// Rota para validar sessão (/api/admin/me) esperada pelo admin.js
app.get('/api/admin/me', (req, res) => {
  if (req.session && (req.session.user || req.session.isAdmin)) {
    return res.json({ authenticated: true, admin: req.session.user || { email: 'admin@ulando.online' } });
  }
  return res.json({ authenticated: false });
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/admin/upload', (req, res) => {
  try {
    // Tratamento adaptado para receber o ficheiro via multer ou body parser
    upload.single('file')(req, res, (err) => {
      if (err || !req.file) {
        return res.status(400).json({ error: 'Escolhe primeiro um ficheiro.' });
      }
      // Converte o buffer para base64 para garantir compatibilidade total na exibição imediata
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
// ROTAS DE CONTEÚDO (Compatíveis com admin.js)
// ==========================================

// Rota pública para o site buscar as notícias/conteúdos
app.get('/api/content', (req, res) => {
  const content = readContent();
  // Retorna diretamente um array ou objeto compatível com o app.js público
  return res.json(content);
});

// Listar conteúdos no painel admin (retorna o array direto que o admin.js espera)
app.get('/api/admin/content', (req, res) => {
  const content = readContent();
  return res.json(content);
});

// Criar novo conteúdo (POST)
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
    return res.status(500).json({ error: 'Erro ao guardar o conteúdo.' });
  }
});

// Atualizar conteúdo existente (PUT)
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
    return res.status(500).json({ error: 'Erro ao atualizar o conteúdo.' });
  }
});

// Eliminar conteúdo (DELETE)
app.delete('/api/admin/content/:id', (req, res) => {
  try {
    const id = req.params.id;
    let items = readContent();
    
    items = items.filter(x => String(x.id) !== String(id));
    writeContent(items);
    
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao eliminar o conteúdo.' });
  }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
  });
}

module.exports = app;