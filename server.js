const express = require('express');
const cors = require('cors');
const { initDb, sql } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Produtos ──────────────────────────────────────────────
app.get('/api/produtos', async (req, res) => {
  try {
    const { busca, categoria } = req.query;
    const filtros = [sql`1=1`];

    if (busca) {
      const like = `%${busca}%`;
      filtros.push(sql`(nome LIKE ${like} OR descricao LIKE ${like})`);
    }
    if (categoria) {
      filtros.push(sql`categoria = ${categoria}`);
    }

    const rows = await db.query(sql`
      SELECT * FROM produtos WHERE ${sql.join(filtros, sql` AND `)} ORDER BY nome
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/produtos/:id', async (req, res) => {
  try {
    const [produto] = await db.query(sql`SELECT * FROM produtos WHERE id = ${req.params.id}`);
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

    const [{ id }] = await db.query(sql`
      INSERT INTO produtos (nome, descricao, categoria, preco_custo, preco_venda, quantidade, quantidade_minima, unidade)
      VALUES (${nome}, ${descricao}, ${categoria}, ${preco_custo || 0}, ${preco_venda || 0}, ${quantidade || 0}, ${quantidade_minima || 5}, ${unidade || 'un'})
      RETURNING id
    `);

    const [produto] = await db.query(sql`SELECT * FROM produtos WHERE id = ${id}`);
    res.status(201).json(produto);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/produtos/:id', async (req, res) => {
  try {
    const { nome, descricao, categoria, preco_custo, preco_venda, quantidade_minima, unidade } = req.body;
    const [existente] = await db.query(sql`SELECT id FROM produtos WHERE id = ${req.params.id}`);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    await db.query(sql`
      UPDATE produtos
      SET nome=${nome}, descricao=${descricao}, categoria=${categoria},
          preco_custo=${preco_custo}, preco_venda=${preco_venda},
          quantidade_minima=${quantidade_minima}, unidade=${unidade}
      WHERE id=${req.params.id}
    `);

    const [produto] = await db.query(sql`SELECT * FROM produtos WHERE id = ${req.params.id}`);
    res.json(produto);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/produtos/:id', async (req, res) => {
  try {
    const [existente] = await db.query(sql`SELECT id FROM produtos WHERE id = ${req.params.id}`);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    await db.query(sql`DELETE FROM movimentacoes WHERE produto_id = ${req.params.id}`);
    await db.query(sql`DELETE FROM produtos WHERE id = ${req.params.id}`);
    res.json({ mensagem: 'Produto excluído' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Movimentações ─────────────────────────────────────────
app.get('/api/movimentacoes', async (req, res) => {
  try {
    const { tipo, produto_id, inicio, fim } = req.query;
    const filtros = [sql`1=1`];

    if (tipo) filtros.push(sql`m.tipo = ${tipo}`);
    if (produto_id) filtros.push(sql`m.produto_id = ${produto_id}`);
    if (inicio) filtros.push(sql`DATE(m.criado_em) >= ${inicio}`);
    if (fim) filtros.push(sql`DATE(m.criado_em) <= ${fim}`);

    const rows = await db.query(sql`
      SELECT m.*, p.nome AS produto_nome, p.unidade
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      WHERE ${sql.join(filtros, sql` AND `)}
      ORDER BY m.criado_em DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/movimentacoes/entrada', async (req, res) => {
  try {
    const { produto_id, quantidade, preco_unitario, observacao } = req.body;
    if (!produto_id || !quantidade) return res.status(400).json({ erro: 'produto_id e quantidade são obrigatórios' });

    const [produto] = await db.query(sql`SELECT * FROM produtos WHERE id = ${produto_id}`);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    await db.query(sql`UPDATE produtos SET quantidade = quantidade + ${quantidade} WHERE id = ${produto_id}`);
    const [{ id }] = await db.query(sql`
      INSERT INTO movimentacoes (produto_id, tipo, quantidade, preco_unitario, observacao)
      VALUES (${produto_id}, 'entrada', ${quantidade}, ${preco_unitario}, ${observacao})
      RETURNING id
    `);

    res.status(201).json({ id, produto_nome: produto.nome, quantidade });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/movimentacoes/saida', async (req, res) => {
  try {
    const { produto_id, quantidade, preco_unitario, observacao } = req.body;
    if (!produto_id || !quantidade) return res.status(400).json({ erro: 'produto_id e quantidade são obrigatórios' });

    const [produto] = await db.query(sql`SELECT * FROM produtos WHERE id = ${produto_id}`);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    if (produto.quantidade < quantidade) return res.status(400).json({ erro: 'Estoque insuficiente' });

    await db.query(sql`UPDATE produtos SET quantidade = quantidade - ${quantidade} WHERE id = ${produto_id}`);
    const [{ id }] = await db.query(sql`
      INSERT INTO movimentacoes (produto_id, tipo, quantidade, preco_unitario, observacao)
      VALUES (${produto_id}, 'saida', ${quantidade}, ${preco_unitario}, ${observacao})
      RETURNING id
    `);

    res.status(201).json({ id, produto_nome: produto.nome, quantidade });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Dashboard ─────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const [
      [{ total: totalProdutos }],
      [{ total: totalItens }],
      [{ total: valorEstoque }],
      [{ total: estoqueBaixo }],
      [{ total: entradasHoje }],
      [{ total: saidasHoje }],
      produtosBaixos,
      ultimasMovimentacoes,
    ] = await Promise.all([
      db.query(sql`SELECT COUNT(*) AS total FROM produtos`),
      db.query(sql`SELECT COALESCE(SUM(quantidade), 0) AS total FROM produtos`),
      db.query(sql`SELECT COALESCE(SUM(quantidade * preco_custo), 0) AS total FROM produtos`),
      db.query(sql`SELECT COUNT(*) AS total FROM produtos WHERE quantidade <= quantidade_minima`),
      db.query(sql`SELECT COALESCE(SUM(quantidade), 0) AS total FROM movimentacoes WHERE tipo = 'entrada' AND DATE(criado_em) = DATE('now')`),
      db.query(sql`SELECT COALESCE(SUM(quantidade), 0) AS total FROM movimentacoes WHERE tipo = 'saida' AND DATE(criado_em) = DATE('now')`),
      db.query(sql`SELECT id, nome, quantidade, quantidade_minima FROM produtos WHERE quantidade <= quantidade_minima ORDER BY quantidade ASC LIMIT 5`),
      db.query(sql`SELECT m.*, p.nome AS produto_nome FROM movimentacoes m JOIN produtos p ON p.id = m.produto_id ORDER BY m.criado_em DESC LIMIT 10`),
    ]);

    res.json({ totalProdutos, totalItens, valorEstoque, estoqueBaixo, entradasHoje, saidasHoje, produtosBaixos, ultimasMovimentacoes });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/categorias', async (req, res) => {
  try {
    const rows = await db.query(sql`SELECT DISTINCT categoria FROM produtos WHERE categoria IS NOT NULL ORDER BY categoria`);
    res.json(rows.map(c => c.categoria));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Inicialização ─────────────────────────────────────────
let db;
initDb()
  .then(database => {
    db = database;
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  })
  .catch(err => {
    console.error('Erro ao inicializar banco de dados:', err);
    process.exit(1);
  });
