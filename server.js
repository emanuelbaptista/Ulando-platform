require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Configuração de segurança e parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração da Sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ulandu-local-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 dia
    }
  })
);

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const UPLOADS = path.join(ROOT, "uploads");
const DATA = path.join(ROOT, "data");

if (!process.env.VERCEL) {
  try {
    fs.mkdirSync(UPLOADS, { recursive: true });
    fs.mkdirSync(DATA, { recursive: true });
  } catch (e) {
    console.error("Erro ao criar pastas locais:", e);
  }
}

// Ficheiros estáticos
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

// Rota oficial de login
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
    return res.json({ success: true, message: 'Login bem-sucedido!' });
  } else {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
});

// Middleware para proteger rotas de admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Acesso negado. Faça login como administrador.' });
}

// Configuração do multer em memória para o Vercel
const upload = multer({ storage: multer.memoryStorage() });

// Rota de Upload
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
    console.error("Erro no upload:", err);
    return res.status(500).json({ error: 'Erro ao processar o upload.' });
  }
});

// ==========================================
// NOVAS ROTAS PARA RESOLVER OS ERROS 404 E 403
// ==========================================

// Rota GET para buscar conteúdos (/api/admin/content ou /api/admin/content/:id)
app.get(['/api/admin/content', '/api/admin/content/:id'], requireAdmin, (req, res) => {
  try {
    // Podes adaptar para ler de base de dados ou ficheiro JSON
    return res.json({ success: true, data: [] });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar conteúdos.' });
  }
});

// Rota POST/PUT para guardar/atualizar conteúdos
app.post(['/api/admin/content', '/api/admin/content/:id'], requireAdmin, (req, res) => {
  try {
    const contentData = req.body;
    // Aqui processas e guardas os dados enviados pelo admin.js
    return res.json({ success: true, message: 'Conteúdo guardado com sucesso!' });
  } catch (err) {
    console.error("Erro ao guardar conteúdo:", err);
    return res.status(500).json({ error: 'Erro ao guardar o conteúdo.' });
  }
});

// Iniciar servidor localmente
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
  });
}

module.exports = app;