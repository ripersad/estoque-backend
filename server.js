const express = require('express');
const cors = require('cors');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Produtos ──────────────────────────────────────────────────
app.get('/api/produtos', (req, res) => {
  try {
    res.json(db.getProdutos(req.query.busca));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/produtos/:id', (req, res) => {
  try {
    const produto = db.getProdutoById(req.params.id);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/produtos', (req, res) => {
  try {
    const { nome, descricao, modelo, preco_custo, preco_venda, quantidade, quantidade_minima, unidade } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
    res.status(201).json(db.insertProduto({ nome, descricao, modelo, preco_custo, preco_venda, quantidade, quantidade_minima, unidade }));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/produtos/:id', (req, res) => {
  try {
    const existente = db.getProdutoById(req.params.id);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });
    const produto = db.updateProduto(req.params.id, {
      nome: req.body.nome ?? existente.nome,
      modelo: req.body.modelo ?? existente.modelo,
    });
    res.json(produto);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/produtos/:id', (req, res) => {
  try {
    if (!db.getProdutoById(req.params.id)) return res.status(404).json({ erro: 'Produto não encontrado' });
    db.deleteProduto(req.params.id);
    res.json({ mensagem: 'Produto excluído' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Movimentações ─────────────────────────────────────────────
app.get('/api/movimentacoes', (req, res) => {
  try {
    const { tipo, produto_id, inicio, fim } = req.query;
    res.json(db.getMovimentacoes({ tipo, produto_id, inicio, fim }));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/movimentacoes/entrada', (req, res) => {
  try {
    const { produto_id, quantidade, preco_unitario, cor, modelo, capacidade, fornecedor, nota_fiscal, preco_sugerido_venda, percentual_lucro } = req.body;
    if (!produto_id || !quantidade) return res.status(400).json({ erro: 'produto_id e quantidade são obrigatórios' });

    const produto = db.getProdutoById(produto_id);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    const pctLucro = preco_sugerido_venda && preco_unitario
      ? ((preco_sugerido_venda - preco_unitario) / preco_unitario * 100)
      : (percentual_lucro ?? null);
    const valLucro = preco_sugerido_venda && preco_unitario
      ? ((preco_sugerido_venda - preco_unitario) * quantidade)
      : null;

    const updates = { quantidade: produto.quantidade + quantidade };
    if (preco_unitario) updates.preco_custo = preco_unitario;
    if (preco_sugerido_venda) updates.preco_venda = preco_sugerido_venda;
    db.updateProduto(produto_id, updates);

    const mov = db.insertMovimentacao({
      produto_id: Number(produto_id),
      tipo: 'entrada',
      quantidade,
      preco_unitario: preco_unitario || null,
      cor: cor || null,
      modelo: modelo || null,
      capacidade: capacidade || null,
      fornecedor: fornecedor || null,
      nota_fiscal: nota_fiscal || null,
      preco_sugerido_venda: preco_sugerido_venda || null,
      percentual_lucro: pctLucro,
      valor_lucro: valLucro,
      cliente: null,
      observacao: null,
    });

    res.status(201).json({ id: mov.id, produto_nome: produto.nome, quantidade });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/movimentacoes/saida', (req, res) => {
  try {
    const { produto_id, quantidade, preco_unitario, cor, modelo, capacidade, cliente } = req.body;
    if (!produto_id || !quantidade) return res.status(400).json({ erro: 'produto_id e quantidade são obrigatórios' });

    const produto = db.getProdutoById(produto_id);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    if (produto.quantidade < quantidade) return res.status(400).json({ erro: 'Estoque insuficiente' });

    const pctLucro = preco_unitario && produto.preco_custo
      ? ((preco_unitario - produto.preco_custo) / produto.preco_custo * 100)
      : null;
    const valLucro = preco_unitario && produto.preco_custo
      ? ((preco_unitario - produto.preco_custo) * quantidade)
      : null;

    // Salva cliente automaticamente se informado
    if (cliente) db.insertCliente({ nome: cliente });

    db.updateProduto(produto_id, { quantidade: produto.quantidade - quantidade });

    const mov = db.insertMovimentacao({
      produto_id: Number(produto_id),
      tipo: 'saida',
      quantidade,
      preco_unitario: preco_unitario || null,
      cor: cor || null,
      modelo: modelo || null,
      capacidade: capacidade || null,
      fornecedor: null,
      nota_fiscal: null,
      preco_sugerido_venda: null,
      percentual_lucro: pctLucro,
      valor_lucro: valLucro,
      cliente: cliente || null,
      observacao: null,
    });

    res.status(201).json({ id: mov.id, produto_nome: produto.nome, quantidade });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Clientes ──────────────────────────────────────────────────
app.get('/api/clientes', (req, res) => {
  try {
    res.json(db.getClientes(req.query.busca));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/clientes', (req, res) => {
  try {
    const { nome, telefone } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
    res.status(201).json(db.insertCliente({ nome, telefone }));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/clientes/:id', (req, res) => {
  try {
    const existente = db.getClienteById(req.params.id);
    if (!existente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(db.updateCliente(req.params.id, {
      nome: req.body.nome ?? existente.nome,
      telefone: req.body.telefone ?? existente.telefone,
    }));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/clientes/:id', (req, res) => {
  try {
    if (!db.getClienteById(req.params.id)) return res.status(404).json({ erro: 'Cliente não encontrado' });
    db.deleteCliente(req.params.id);
    res.json({ mensagem: 'Cliente excluído' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Dashboard ─────────────────────────────────────────────────
app.get('/api/dashboard', (req, res) => {
  try {
    res.json(db.getDashboard());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Inicialização ─────────────────────────────────────────────
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