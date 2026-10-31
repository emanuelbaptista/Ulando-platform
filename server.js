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

// Configuração de segurança e parsers (OBRIGATÓRIO para ler o req.body em JSON)
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

// Rota oficial de login correspondente ao pedido do admin.js (/api/admin/login)
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e palavra-passe são obrigatórios.' });
  }

  // Valida se as credenciais coincidem com qualquer um dos admins do .env
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

// Avisos de ambiente
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes("MUDA-ESTE")) {
  console.warn("AVISO: define um SESSION_SECRET forte no ficheiro .env antes de publicar.");
}

// Configuração do multer a usar memória (essencial para o Vercel não dar erro de leitura/escrita)
const upload = multer({ storage: multer.memoryStorage() });

// Rota para processar o upload no painel de administração
app.post('/api/admin/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum ficheiro enviado.' });
    }
    
    // Como estamos no Vercel (memoryStorage), o ficheiro está disponível em req.file.buffer.
    // Podes processá-lo ou devolver a confirmação de sucesso:
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

// Iniciar o servidor localmente ou exportar para o Vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor Ulanda a correr na porta ${PORT}`);
  });
}

// OBRIGATÓRIO: Esta tem de ser SEMPRE a última linha absoluta do ficheiro
module.exports = app;