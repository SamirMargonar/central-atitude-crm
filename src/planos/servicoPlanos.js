// ==========================================================
// SERVIÇO DE PLANOS (catálogo de planos e categorias)
// ==========================================================
//
// Coleções: `planos/{id}` e `categoriasPlano/{id}`. Escrita só por
// administradores (as Firestore Rules são a autoridade; a tela só
// esconde o que seria negado). NUNCA apaga documentos: plano e
// categoria só são ATIVADOS/DESATIVADOS, para o histórico ficar
// intacto. `db`/`fs` são injetados (testes usam o Emulator).
// ==========================================================

import {
  CATEGORIAS_INICIAIS,
  PLANOS_INICIAIS,
  validarPlano,
} from "../utils/planos.js";

export const COL_PLANOS = "planos";
export const COL_CATEGORIAS = "categoriasPlano";

export function gerarIdCategoria(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function exigirAutor(autor) {
  if (!autor?.uid) {
    throw new Error("Não foi possível identificar o administrador logado.");
  }
}

export function criarServicoPlanos({ db, fs }) {
  const carimboCriacao = (autor) => ({
    criadoEm: fs.serverTimestamp(),
    criadoPorUid: autor.uid,
    criadoPorNome: autor.nome || "",
    atualizadoEm: fs.serverTimestamp(),
    atualizadoPorUid: autor.uid,
    atualizadoPorNome: autor.nome || "",
  });
  const carimboEdicao = (autor) => ({
    atualizadoEm: fs.serverTimestamp(),
    atualizadoPorUid: autor.uid,
    atualizadoPorNome: autor.nome || "",
  });

  async function listar(colecao) {
    const snap = await fs.getDocs(fs.collection(db, colecao));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  }

  async function carregarCatalogo() {
    const [planos, categorias] = await Promise.all([
      listar(COL_PLANOS),
      listar(COL_CATEGORIAS),
    ]);
    return { planos, categorias };
  }

  // Cria (sem id) ou edita (com id). Editar NÃO altera matrículas já
  // contratadas: elas guardam o próprio instantâneo do plano.
  async function salvarPlano({ id = null, dados, ativo, ordem = null }, autor) {
    exigirAutor(autor);
    const v = validarPlano(dados);
    if (!v.ok) {
      const erro = new Error(v.erros.join(" "));
      erro.codigo = "PLANO_INVALIDO";
      erro.erros = v.erros;
      throw erro;
    }
    const base = { ...v.normalizado };
    if (id) {
      await fs.updateDoc(fs.doc(db, COL_PLANOS, id), {
        ...base,
        ...(typeof ativo === "boolean" ? { ativo } : {}),
        ...(ordem !== null ? { ordem } : {}),
        ...carimboEdicao(autor),
      });
      return id;
    }
    const ref = fs.doc(fs.collection(db, COL_PLANOS));
    await fs.setDoc(ref, {
      ...base,
      ativo: ativo !== false,
      ordem: Number.isInteger(ordem) ? ordem : 999,
      ...carimboCriacao(autor),
    });
    return ref.id;
  }

  async function definirAtivoPlano(id, ativo, autor) {
    exigirAutor(autor);
    await fs.updateDoc(fs.doc(db, COL_PLANOS, id), {
      ativo: !!ativo,
      ...carimboEdicao(autor),
    });
  }

  async function criarCategoria(nome, autor, ordem = 999) {
    exigirAutor(autor);
    const limpo = String(nome || "").trim();
    if (!limpo || limpo.length > 60) {
      throw new Error("Informe um nome de categoria de até 60 caracteres.");
    }
    const id = gerarIdCategoria(limpo);
    if (!id) {
      throw new Error("Nome de categoria inválido.");
    }
    const ref = fs.doc(db, COL_CATEGORIAS, id);
    const existente = await fs.getDoc(ref);
    if (existente.exists()) {
      const erro = new Error("Já existe uma categoria com esse nome.");
      erro.codigo = "CATEGORIA_DUPLICADA";
      throw erro;
    }
    await fs.setDoc(ref, {
      nome: limpo,
      ativo: true,
      ordem: Number.isInteger(ordem) ? ordem : 999,
      ...carimboCriacao(autor),
    });
    return id;
  }

  async function definirAtivaCategoria(id, ativo, autor) {
    exigirAutor(autor);
    await fs.updateDoc(fs.doc(db, COL_CATEGORIAS, id), {
      ativo: !!ativo,
      ...carimboEdicao(autor),
    });
  }

  // CARGA INICIAL — idempotente: cria só o que ainda NÃO existe
  // (7 categorias e os 4 planos legados, sem preço) e nunca
  // sobrescreve nada. É disparada pelo administrador na tela.
  async function cargaInicial(autor) {
    exigirAutor(autor);
    const criadas = [];
    const jaExistiam = [];
    for (const c of CATEGORIAS_INICIAIS) {
      const ref = fs.doc(db, COL_CATEGORIAS, c.id);
      if ((await fs.getDoc(ref)).exists()) {
        jaExistiam.push(`categoria:${c.id}`);
        continue;
      }
      await fs.setDoc(ref, {
        nome: c.nome,
        ativo: true,
        ordem: c.ordem,
        ...carimboCriacao(autor),
      });
      criadas.push(`categoria:${c.id}`);
    }
    for (const p of PLANOS_INICIAIS) {
      const ref = fs.doc(db, COL_PLANOS, p.id);
      if ((await fs.getDoc(ref)).exists()) {
        jaExistiam.push(`plano:${p.id}`);
        continue;
      }
      await fs.setDoc(ref, {
        nome: p.nome,
        categoriaId: p.categoriaId,
        duracaoMeses: p.duracaoMeses,
        valorCentavos: null,
        taxaAdesaoCentavos: null,
        descricao: p.descricao,
        condicoes: p.condicoes,
        ofertaInicio: null,
        ofertaFim: null,
        ativo: true,
        ordem: p.ordem,
        legado: true,
        ...carimboCriacao(autor),
      });
      criadas.push(`plano:${p.id}`);
    }
    return { criadas, jaExistiam };
  }

  return {
    carregarCatalogo,
    salvarPlano,
    definirAtivoPlano,
    criarCategoria,
    definirAtivaCategoria,
    cargaInicial,
  };
}
