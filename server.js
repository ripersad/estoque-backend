const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const run = (sql, params = []) => new Promise((resolve, reject) =>
  db.run(sql, params, function (err) {
    if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes });
  })
);

const get = (sql, params = []) => new Promise((resolve, reject) =>
  db.get(sql, params, (err, row) => {
    if (err) reject(err); else resolve(row);
  })
);

const all = (sql, params = []) => new Promise((resolve, reject) =>
  db.all(sql, params, (err, rows) => {
    if (err) reject(err); else resolve(rows);
  })
);

// ── Produtos ──────────────────────────────────────────────
app.get('/api/produtos', async (req, res) => {
  try {
    const { busca, categoria } = req.query;
    let sql = 'SELECT * FROM produtos WHERE 1=1';
    const params = [];

    if (busca) {
      sql += ' AND (nome LIKE ? OR descricao LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`);
    }
    if (categoria) {
      sql += ' AND categoria = ?';
      params.push(categoria);
    }

    sql += ' ORDER BY nome';
    res.json(await all(sql, params));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/produtos/:id', async (req, res) => {
  try {
    const produto = await get('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/produtos', async (req, res) => {
  try {
    const { nome, descricao, categoria, preco_custo, preco_venda, quantidade, quantidade_minima, unidade } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

    const result = await run(
      `INSERT INTO produtos (nome, descricao, categoria, preco_custo, preco_venda, quantidade, quantidade_minima, unidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, descricao, categoria, preco_custo || 0, preco_venda || 0, quantidade || 0, quantidade_minima || 5, unidade || 'un']
    );

    res.status(201).json(await get('SELECT * FROM produtos WHERE id = ?', [result.lastID]));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/produtos/:id', async (req, res) => {
  try {
    const { nome, descricao, categoria, preco_custo, preco_venda, quantidade_minima, unidade } = req.body;
    const produto = await get('SELECT id FROM produtos WHERE id = ?', [req.params.id]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    await run(
      `UPDATE produtos SET nome=?, descricao=?, categoria=?, preco_custo=?, preco_venda=?, quantidade_minima=?, unidade=? WHERE id=?`,
      [nome, descricao, categoria, preco_custo, preco_venda, quantidade_minima, unidade, req.params.id]
    );

    res.json(await get('SELECT * FROM produtos WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/produtos/:id', async (req, res) => {
  try {
    const produto = await get('SELECT id FROM produtos WHERE id = ?', [req.params.id]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    await run('DELETE FROM movimentacoes WHERE produto_id = ?', [req.params.id]);
    await run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Produto excluído' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Movimentações ─────────────────────────────────────────
app.get('/api/movimentacoes', async (req, res) => {
  try {
    const { tipo, produto_id, inicio, fim } = req.query;
    let sql = `
      SELECT m.*, p.nome AS produto_nome, p.unidade
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      WHERE 1=1
    `;
    const params = [];

    if (tipo) { sql += ' AND m.tipo = ?'; params.push(tipo); }
    if (produto_id) { sql += ' AND m.produto_id = ?'; params.push(produto_id); }
    if (inicio) { sql += ' AND DATE(m.criado_em) >= ?'; params.push(inicio); }
    if (fim) { sql += ' AND DATE(m.criado_em) <= ?'; params.push(fim); }

    sql += ' ORDER BY m.criado_em DESC';
    res.json(await all(sql, params));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/movimentacoes/entrada', async (req, res) => {
  try {
    const { produto_id, quantidade, preco_unitario, observacao } = req.body;
    if (!produto_id || !quantidade) return res.status(400).json({ erro: 'produto_id e quantidade são obrigatórios' });

    const produto = await get('SELECT * FROM produtos WHERE id = ?', [produto_id]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    await run('UPDATE produtos SET quantidade = quantidade + ? WHERE id = ?', [quantidade, produto_id]);
    const result = await run(
      `INSERT INTO movimentacoes (produto_id, tipo, quantidade, preco_unitario, observacao) VALUES (?, 'entrada', ?, ?, ?)`,
      [produto_id, quantidade, preco_unitario, observacao]
    );

    res.status(201).json({ id: result.lastID, produto_nome: produto.nome, quantidade });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/movimentacoes/saida', async (req, res) => {
  try {
    const { produto_id, quantidade, preco_unitario, observacao } = req.body;
    if (!produto_id || !quantidade) return res.status(400).json({ erro: 'produto_id e quantidade são obrigatórios' });

    const produto = await get('SELECT * FROM produtos WHERE id = ?', [produto_id]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    if (produto.quantidade < quantidade) return res.status(400).json({ erro: 'Estoque insuficiente' });

    await run('UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?', [quantidade, produto_id]);
    const result = await run(
      `INSERT INTO movimentacoes (produto_id, tipo, quantidade, preco_unitario, observacao) VALUES (?, 'saida', ?, ?, ?)`,
      [produto_id, quantidade, preco_unitario, observacao]
    );

    res.status(201).json({ id: result.lastID, produto_nome: produto.nome, quantidade });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Dashboard ─────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const [
      { total: totalProdutos },
      { total: totalItens },
      { total: valorEstoque },
      { total: estoqueBaixo },
      { total: entradasHoje },
      { total: saidasHoje },
      produtosBaixos,
      ultimasMovimentacoes,
    ] = await Promise.all([
      get('SELECT COUNT(*) AS total FROM produtos'),
      get('SELECT COALESCE(SUM(quantidade), 0) AS total FROM produtos'),
      get('SELECT COALESCE(SUM(quantidade * preco_custo), 0) AS total FROM produtos'),
      get('SELECT COUNT(*) AS total FROM produtos WHERE quantidade <= quantidade_minima'),
      get(`SELECT COALESCE(SUM(quantidade), 0) AS total FROM movimentacoes WHERE tipo = 'entrada' AND DATE(criado_em) = DATE('now')`),
      get(`SELECT COALESCE(SUM(quantidade), 0) AS total FROM movimentacoes WHERE tipo = 'saida' AND DATE(criado_em) = DATE('now')`),
      all('SELECT id, nome, quantidade, quantidade_minima FROM produtos WHERE quantidade <= quantidade_minima ORDER BY quantidade ASC LIMIT 5'),
      all('SELECT m.*, p.nome AS produto_nome FROM movimentacoes m JOIN produtos p ON p.id = m.produto_id ORDER BY m.criado_em DESC LIMIT 10'),
    ]);

    res.json({ totalProdutos, totalItens, valorEstoque, estoqueBaixo, entradasHoje, saidasHoje, produtosBaixos, ultimasMovimentacoes });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await all('SELECT DISTINCT categoria FROM produtos WHERE categoria IS NOT NULL ORDER BY categoria');
    res.json(categorias.map(c => c.categoria));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
