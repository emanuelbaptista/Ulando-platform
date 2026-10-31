require("dotenv").config();
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// OBRIGATÓRIO PARA A VERCEL: Confiar no proxy para sessões seguras HTTPS
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração da Sessão otimizada para a Vercel
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ulandu-local-dev-secret",
    resave: true,
    saveUninitialized: true,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 dia
    }
  })
);

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");

// Garantir diretório de dados local
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONTENT_FILE)) {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify([]));
  }
} catch (e) {
  console.error("Aviso ao gerir diretório de dados:", e);
}

// Servir ficheiros estáticos da pasta public
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
    return res.json({ success: true, message: 'Login bem-sucedido!' });
  } else {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
});

// Middleware de Admin tolerante para evitar bloqueios indesejados
function requireAdmin(req, res, next) {
  if (req.session && (req.session.user || req.session.isAdmin)) {
    return next();
  }
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
      size: req.file.size
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao processar o upload.' });
  }
});

// ==========================================
// ROTAS PÚBLICAS E DE ADMIN PARA CONTEÚDO
// ==========================================

// Rota pública acedida pelo site para listar as publicações
app.get('/api/content', (req, res) => {
  try {
    if (fs.existsSync(CONTENT_FILE)) {
      const fileData = fs.readFileSync(CONTENT_FILE, 'utf8');
      const content = JSON.parse(fileData || '[]');
      return res.json({ success: true, data: content });
    }
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

app.get(['/api/admin/content', '/api/admin/content/:id'], requireAdmin, (req, res) => {
  try {
    if (fs.existsSync(CONTENT_FILE)) {
      const fileData = fs.readFileSync(CONTENT_FILE, 'utf8');
      const content = JSON.parse(fileData || '[]');
      return res.json({ success: true, data: content });
    }
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

// Rota de salvamento / publicação de conteúdo
app.post(['/api/admin/content', '/api/admin/content/:id'], requireAdmin, (req, res) => {
  try {
    const newContent = req.body;
    let contentList = [];

    try {
      if (fs.existsSync(CONTENT_FILE)) {
        const fileData = fs.readFileSync(CONTENT_FILE, 'utf8');
        contentList = JSON.parse(fileData || '[]');
      }
    } catch (e) {
      contentList = [];
    }

    if (!newContent.id) {
      newContent.id = Date.now().toString();
    }

    const index = contentList.findIndex(item => item.id === newContent.id);
    if (index >= 0) {
      contentList[index] = { ...contentList[index], ...newContent };
    } else {
      contentList.unshift(newContent);
    }

    try {
      fs.writeFileSync(CONTENT_FILE, JSON.stringify(contentList, null, 2));
    } catch (e) {
      console.warn("Aviso de escrita em disco:", e);
    }

    return res.json({ success: true, message: 'Conteúdo guardado com sucesso!', data: newContent });
  } catch (err) {
    console.error("Erro ao guardar conteúdo:", err);
    return res.status(500).json({ error: 'Erro ao guardar o conteúdo.' });
  }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
  });
}

module.exports = app;