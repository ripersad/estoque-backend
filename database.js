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
      modelo TEXT,
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
      cor TEXT,
      modelo TEXT,
      capacidade TEXT,
      fornecedor TEXT,
      nota_fiscal TEXT,
      preco_sugerido_venda REAL,
      percentual_lucro REAL,
      valor_lucro REAL,
      cliente TEXT,
      observacao TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);

  // Migrations for existing databases
  try { await db.query(sql`ALTER TABLE produtos ADD COLUMN modelo TEXT`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN cor TEXT`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN modelo TEXT`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN capacidade TEXT`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN fornecedor TEXT`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN nota_fiscal TEXT`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN preco_sugerido_venda REAL`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN percentual_lucro REAL`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN valor_lucro REAL`); } catch (_) {}
  try { await db.query(sql`ALTER TABLE movimentacoes ADD COLUMN cliente TEXT`); } catch (_) {}

  return db;
}

module.exports = { initDb, sql };
