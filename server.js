require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Configuração de segurança e parsers (OBRIGATÓRIO para ler o req.body em JSON)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
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

// Podes manter aqui o resto das tuas rotas e lógica da aplicação existente...

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});