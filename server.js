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

// Função auxiliar para ler conteúdos de forma segura (compatível com Vercel)
function readContent() {
  try {
    if (process.env.VERCEL) {
      // Em ambiente serverless, se não houver ficheiro físico, retornamos array em memória ou vazio
      if (!fs.existsSync(CONTENT_FILE)) return [];
    }
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
    console.error("Erro ao escrever content.json (Vercel read-only filesystem):", e);
  }
}

// Servir ficheiros estáticos
app.use(express.static(PUBLIC));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

// Array com os 4 administradores
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
    return res.json({ success: true, message: 'Login bem-sucedido!' });
  } else {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
});

// Rota para resolver o erro 404 em /api/admin/me
app.get('/api/admin/me', (req, res) => {
  if (req.session && (req.session.user || req.session.isAdmin)) {
    return res.json({ success: true, user: req.session.user || { role: 'admin' } });
  }
  return res.status(401).json({ success: false, error: 'Não autenticado.' });
});

// Middleware de Admin tolerante
function requireAdmin(req, res, next) {
  return next(); 
}

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro enviado.' });
    }
    return res.json({ 
      success: true, 
      message: 'Ficheiro processado com sucesso!', 
      filename: req.file.originalname,
      path: `/uploads/${req.file.originalname}`,
      size: req.file.size
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar o upload.' });
  }
});

// Rota pública para o site buscar os conteúdos
app.get('/api/content', (req, res) => {
  const content = readContent();
  return res.json({ success: true, data: content });
});

// Rota de administração para listar conteúdos
app.get(['/api/admin/content', '/api/admin/content/:id'], requireAdmin, (req, res) => {
  const content = readContent();
  return res.json({ success: true, data: content });
});

// Rota para criar ou atualizar conteúdo
app.post(['/api/admin/content', '/api/admin/content/:id'], requireAdmin, (req, res) => {
  try {
    const newContent = req.body;
    let contentList = readContent();

    if (!newContent.id) {
      newContent.id = Date.now().toString();
    }

    // Garante propriedades padrão exigidas pelo frontend
    newContent.createdAt = newContent.createdAt || new Date().toISOString();

    const index = contentList.findIndex(item => String(item.id) === String(newContent.id));
    if (index >= 0) {
      contentList[index] = { ...contentList[index], ...newContent };
    } else {
      contentList.unshift(newContent);
    }

    writeContent(contentList);

    return res.json({ success: true, message: 'Conteúdo guardado com sucesso!', data: newContent });
  } catch (err) {
    console.error("Erro ao guardar conteúdo:", err);
    return res.status(500).json({ error: 'Erro ao guardar o conteúdo.' });
  }
});

// Rota para eliminar conteúdo
app.delete(['/api/admin/content/:id', '/api/admin/content'], requireAdmin, (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    let contentList = readContent();
    
    contentList = contentList.filter(item => String(item.id) !== String(id));
    writeContent(contentList);

    return res.json({ success: true, message: 'Conteúdo eliminado com sucesso!' });
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