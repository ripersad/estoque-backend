const createDatabase = require('@databases/sqlite');
const { sql } = require('@databases/sqlite');
const path = require('path');

async function initDb() {
  const db = await createDatabase(path.join(__dirname, 'estoque.db'));

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      categoria TEXT,
      preco_custo REAL DEFAULT 0,
      preco_venda REAL DEFAULT 0,
      quantidade INTEGER DEFAULT 0,
      quantidade_minima INTEGER DEFAULT 5,
      unidade TEXT DEFAULT 'un',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'saida')),
      quantidade INTEGER NOT NULL,
      preco_unitario REAL,
      observacao TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);

  return db;
}

module.exports = { initDb, sql };
