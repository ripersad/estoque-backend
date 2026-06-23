const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PRODUTOS_FILE = path.join(DATA_DIR, 'produtos.json');
const MOV_FILE = path.join(DATA_DIR, 'movimentacoes.json');
const CLIENTES_FILE = path.join(DATA_DIR, 'clientes.json');

function loadFile(file, defaultData) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return defaultData;
  }
}

function saveFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function initDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const prodData = loadFile(PRODUTOS_FILE, { nextId: 1, items: [] });
  const movData = loadFile(MOV_FILE, { nextId: 1, items: [] });
  const cliData = loadFile(CLIENTES_FILE, { nextId: 1, items: [] });

  const db = {
    // ── Produtos ──────────────────────────────────────────────
    getProdutos(busca) {
      let items = [...prodData.items];
      if (busca) {
        const b = busca.toLowerCase();
        items = items.filter(p =>
          (p.nome || '').toLowerCase().includes(b) ||
          (p.descricao || '').toLowerCase().includes(b)
        );
      }
      return items.sort((a, b) => a.nome.localeCompare(b.nome));
    },

    getProdutoById(id) {
      return prodData.items.find(p => p.id === Number(id)) || null;
    },

    insertProduto({ nome, descricao, modelo, preco_custo, preco_venda, quantidade, quantidade_minima, unidade }) {
      const produto = {
        id: prodData.nextId++,
        nome,
        descricao: descricao || null,
        modelo: modelo || null,
        preco_custo: preco_custo || 0,
        preco_venda: preco_venda || 0,
        quantidade: quantidade || 0,
        quantidade_minima: quantidade_minima || 5,
        unidade: unidade || 'un',
        criado_em: new Date().toISOString(),
      };
      prodData.items.push(produto);
      saveFile(PRODUTOS_FILE, prodData);
      return produto;
    },

    updateProduto(id, updates) {
      const idx = prodData.items.findIndex(p => p.id === Number(id));
      if (idx === -1) return null;
      Object.assign(prodData.items[idx], updates);
      saveFile(PRODUTOS_FILE, prodData);
      return prodData.items[idx];
    },

    deleteProduto(id) {
      const numId = Number(id);
      prodData.items = prodData.items.filter(p => p.id !== numId);
      movData.items = movData.items.filter(m => m.produto_id !== numId);
      saveFile(PRODUTOS_FILE, prodData);
      saveFile(MOV_FILE, movData);
    },

    // ── Movimentações ─────────────────────────────────────────
    getMovimentacoes({ tipo, produto_id, inicio, fim } = {}) {
      let items = movData.items.filter(m => {
        if (tipo && m.tipo !== tipo) return false;
        if (produto_id && m.produto_id !== Number(produto_id)) return false;
        if (inicio && m.criado_em.slice(0, 10) < inicio) return false;
        if (fim && m.criado_em.slice(0, 10) > fim) return false;
        return true;
      });
      return items
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
        .map(m => {
          const p = prodData.items.find(p => p.id === m.produto_id);
          return { ...m, produto_nome: p ? p.nome : '', unidade: p ? p.unidade : '' };
        });
    },

    insertMovimentacao(data) {
      const mov = { id: movData.nextId++, criado_em: new Date().toISOString(), ...data };
      movData.items.push(mov);
      saveFile(MOV_FILE, movData);
      return mov;
    },

    // ── Clientes ──────────────────────────────────────────────
    getClientes(busca) {
      let items = [...cliData.items];
      if (busca) {
        const b = busca.toLowerCase();
        items = items.filter(c => (c.nome || '').toLowerCase().includes(b));
      }
      return items.sort((a, b) => a.nome.localeCompare(b.nome));
    },

    getClienteById(id) {
      return cliData.items.find(c => c.id === Number(id)) || null;
    },

    getClienteByNome(nome) {
      return cliData.items.find(c => c.nome.toLowerCase() === nome.toLowerCase()) || null;
    },

    insertCliente({ nome, telefone }) {
      const existing = db.getClienteByNome(nome);
      if (existing) return existing;
      const cliente = {
        id: cliData.nextId++,
        nome,
        telefone: telefone || null,
        criado_em: new Date().toISOString(),
      };
      cliData.items.push(cliente);
      saveFile(CLIENTES_FILE, cliData);
      return cliente;
    },

    updateCliente(id, updates) {
      const idx = cliData.items.findIndex(c => c.id === Number(id));
      if (idx === -1) return null;
      Object.assign(cliData.items[idx], updates);
      saveFile(CLIENTES_FILE, cliData);
      return cliData.items[idx];
    },

    deleteCliente(id) {
      cliData.items = cliData.items.filter(c => c.id !== Number(id));
      saveFile(CLIENTES_FILE, cliData);
    },

    // ── Dashboard ─────────────────────────────────────────────
    getDashboard() {
      const today = new Date().toISOString().slice(0, 10);
      const totalProdutos = prodData.items.length;
      const totalItens = prodData.items.reduce((s, p) => s + p.quantidade, 0);
      const valorEstoque = prodData.items.reduce((s, p) => s + p.quantidade * p.preco_custo, 0);
      const estoqueBaixo = prodData.items.filter(p => p.quantidade <= p.quantidade_minima).length;
      const entradasHoje = movData.items
        .filter(m => m.tipo === 'entrada' && m.criado_em.slice(0, 10) === today)
        .reduce((s, m) => s + m.quantidade, 0);
      const saidasHoje = movData.items
        .filter(m => m.tipo === 'saida' && m.criado_em.slice(0, 10) === today)
        .reduce((s, m) => s + m.quantidade, 0);
      const produtosBaixos = prodData.items
        .filter(p => p.quantidade <= p.quantidade_minima)
        .sort((a, b) => a.quantidade - b.quantidade)
        .slice(0, 5)
        .map(({ id, nome, quantidade, quantidade_minima }) => ({ id, nome, quantidade, quantidade_minima }));
      const ultimasMovimentacoes = movData.items
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
        .slice(0, 10)
        .map(m => {
          const p = prodData.items.find(p => p.id === m.produto_id);
          return { ...m, produto_nome: p ? p.nome : '' };
        });
      return { totalProdutos, totalItens, valorEstoque, estoqueBaixo, entradasHoje, saidasHoje, produtosBaixos, ultimasMovimentacoes };
    },
  };

  return Promise.resolve(db);
}

module.exports = { initDb };