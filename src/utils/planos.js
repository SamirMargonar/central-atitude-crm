// ==========================================================
// PLANOS DE MATRÍCULA — funções puras (sem Firebase)
// ==========================================================
//
// O catálogo de planos vive na coleção `planos` (gerenciada só por
// administradores). Estas funções cuidam do que NÃO depende do
// banco: planos legados, categorias iniciais, vigência da oferta,
// vencimento por duração, valores em centavos e o INSTANTÂNEO
// (snapshot) do plano que é copiado para lead.matricula no momento
// da contratação.
//
// COMPATIBILIDADE: as matrículas antigas só têm `plano: "MENSAL"`
// (código). Os quatro códigos continuam válidos e continuam sendo
// lidos aqui (nome e duração), sem migração de dados.
// ==========================================================

export const FUSO_NEGOCIO = "America/Sao_Paulo";

// ----------------------------------------------------------
// PLANOS LEGADOS (os 4 códigos que já existiam no código)
// ----------------------------------------------------------

export const MESES_POR_CODIGO_LEGADO = {
  MENSAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

export const NOMES_LEGADOS = {
  MENSAL: "Plano Mensal",
  TRIMESTRAL: "Plano Trimestral",
  SEMESTRAL: "Plano Semestral",
  ANUAL: "Plano Anual",
};

export const CATEGORIA_PADRAO_ID = "convencionais";

// ----------------------------------------------------------
// CATEGORIAS INICIAIS
// ----------------------------------------------------------

export const CATEGORIAS_INICIAIS = [
  { id: "convencionais", nome: "Convencionais", ordem: 1 },
  { id: "promocionais", nome: "Promocionais", ordem: 2 },
  { id: "black-friday", nome: "Black Friday", ordem: 3 },
  { id: "aniversario", nome: "Aniversário", ordem: 4 },
  { id: "totalpass", nome: "TotalPass", ordem: 5 },
  { id: "corporativos", nome: "Corporativos", ordem: 6 },
  { id: "especiais", nome: "Especiais", ordem: 7 },
];

// Planos iniciais: mesmos códigos de sempre, SEM preço (o admin
// preenche depois pela tela).
export const PLANOS_INICIAIS = Object.keys(MESES_POR_CODIGO_LEGADO).map(
  (codigo, indice) => ({
    id: codigo,
    nome: NOMES_LEGADOS[codigo],
    categoriaId: CATEGORIA_PADRAO_ID,
    duracaoMeses: MESES_POR_CODIGO_LEGADO[codigo],
    descricao: "",
    condicoes: "",
    ofertaInicio: null,
    ofertaFim: null,
    ativo: true,
    ordem: indice + 1,
    legado: true,
  })
);

// Lista usada como FALLBACK quando o catálogo ainda não existe no
// banco (coleção vazia) ou não pôde ser lido: o formulário de
// matrícula continua funcionando exatamente como antes.
export function planosLegados() {
  return PLANOS_INICIAIS.map((p) => ({ ...p }));
}

// ----------------------------------------------------------
// DATAS
// ----------------------------------------------------------

// Data de hoje (AAAA-MM-DD) no fuso do negócio.
export function hojeEmISO(agora = new Date()) {
  const partes = {};
  for (const p of new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora)) {
    partes[p.type] = p.value;
  }
  return `${partes.year}-${partes.month}-${partes.day}`;
}

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dataISOValida(texto) {
  const m = RE_DATA.exec(String(texto || ""));
  if (!m) {
    return false;
  }
  const d = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

// A oferta está valendo hoje? (planos sem janela valem sempre)
export function planoVigente(plano, hoje = hojeEmISO()) {
  if (!plano || plano.ativo === false) {
    return false;
  }
  if (plano.ofertaInicio && hoje < plano.ofertaInicio) {
    return false;
  }
  if (plano.ofertaFim && hoje > plano.ofertaFim) {
    return false;
  }
  return true;
}

// ----------------------------------------------------------
// VENCIMENTO — mesma aritmética de datas das versões anteriores
// (setMonth sobre o meio-dia local), agora por DURAÇÃO EM MESES.
// 12 meses = o antigo "ANUAL" (setFullYear + 1).
// ----------------------------------------------------------

export function calcularVencimentoPorMeses(dataInicio, meses) {
  if (!dataInicio) {
    return "";
  }
  const inicio = new Date(`${dataInicio}T12:00:00`);
  if (Number.isNaN(inicio.getTime())) {
    return "";
  }
  const n = Number(meses);
  if (!Number.isInteger(n) || n <= 0) {
    return "";
  }
  const vencimento = new Date(inicio);
  vencimento.setMonth(vencimento.getMonth() + n);
  const ano = vencimento.getFullYear();
  const mes = String(vencimento.getMonth() + 1).padStart(2, "0");
  const dia = String(vencimento.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Duração (em meses) de uma matrícula OU de um plano:
// instantâneo `duracaoMeses` > código legado > nada.
export function duracaoEmMeses(origem) {
  if (!origem) {
    return null;
  }
  if (Number.isInteger(origem.duracaoMeses) && origem.duracaoMeses > 0) {
    return origem.duracaoMeses;
  }
  const codigo = origem.plano ?? origem.id;
  return MESES_POR_CODIGO_LEGADO[codigo] ?? null;
}

// ----------------------------------------------------------
// NOMES
// ----------------------------------------------------------

// "14/10/2026 a 31/10/2026", "a partir de 14/10/2026",
// "até 31/10/2026" ou "Sem prazo".
export function formatarPeriodoOferta(inicio, fim) {
  const br = (d) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };
  if (inicio && fim) return `${br(inicio)} a ${br(fim)}`;
  if (inicio) return `a partir de ${br(inicio)}`;
  if (fim) return `até ${br(fim)}`;
  return "Sem prazo";
}

// Nome do plano de uma matrícula, preferindo o instantâneo gravado
// na contratação; cai nos nomes legados e depois no próprio código.
export function nomeDaMatricula(matricula) {
  return (
    matricula?.planoNome ||
    NOMES_LEGADOS[matricula?.plano] ||
    matricula?.plano ||
    "Plano não informado"
  );
}

export function nomeCategoria(categoriaId, categorias = CATEGORIAS_INICIAIS) {
  return (
    (categorias || []).find((c) => c.id === categoriaId)?.nome ||
    CATEGORIAS_INICIAIS.find((c) => c.id === categoriaId)?.nome ||
    ""
  );
}

// ----------------------------------------------------------
// VALORES (centavos <-> texto em reais)
// ----------------------------------------------------------

export function centavosParaReais(centavos) {
  if (!Number.isInteger(centavos)) {
    return "";
  }
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// "99,90" | "1.299,90" | "R$ 99,90" | "99.9" -> 9990. Vazio -> null.
// Inválido -> NaN (o formulário avisa; nunca grava lixo).
export function reaisParaCentavos(texto) {
  const bruto = String(texto ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();
  if (bruto === "") {
    return null;
  }
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(bruto)) {
    return NaN;
  }
  let normal = bruto;
  if (bruto.includes(",")) {
    normal = bruto.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) {
    normal = bruto.replace(/\./g, "");
  }
  const valor = Number(normal);
  if (!Number.isFinite(valor) || valor < 0) {
    return NaN;
  }
  return Math.round(valor * 100);
}

export function centavosParaCampo(centavos) {
  if (!Number.isInteger(centavos)) {
    return "";
  }
  return (centavos / 100).toFixed(2).replace(".", ",");
}

// ----------------------------------------------------------
// VALIDAÇÃO DO CADASTRO DE PLANO (usada pela tela e pelo serviço;
// as Rules validam de novo no servidor)
// ----------------------------------------------------------

export const LIMITES = {
  nome: 80,
  descricao: 500,
  condicoes: 1000,
  duracaoMeses: 120,
  centavos: 100_000_000,
};

export function validarPlano(dados) {
  const erros = [];
  const nome = String(dados?.nome ?? "").trim();
  const categoriaId = String(dados?.categoriaId ?? "").trim();
  const descricao = String(dados?.descricao ?? "").trim();
  const condicoes = String(dados?.condicoes ?? "").trim();
  const duracaoMeses = Number(dados?.duracaoMeses);
  const valorCentavos = dados?.valorCentavos ?? null;
  const taxaAdesaoCentavos = dados?.taxaAdesaoCentavos ?? null;
  const ofertaInicio = dados?.ofertaInicio || null;
  const ofertaFim = dados?.ofertaFim || null;

  if (!nome) erros.push("Informe o nome do plano.");
  if (nome.length > LIMITES.nome) erros.push(`O nome pode ter até ${LIMITES.nome} caracteres.`);
  if (!categoriaId) erros.push("Escolha a categoria.");
  if (!Number.isInteger(duracaoMeses) || duracaoMeses < 1 || duracaoMeses > LIMITES.duracaoMeses) {
    erros.push(`A duração deve ser um número inteiro de meses entre 1 e ${LIMITES.duracaoMeses}.`);
  }
  for (const [rotulo, v] of [["O valor", valorCentavos], ["A taxa de adesão", taxaAdesaoCentavos]]) {
    if (v !== null && (!Number.isInteger(v) || v < 0 || v > LIMITES.centavos)) {
      erros.push(`${rotulo} é inválido.`);
    }
  }
  if (descricao.length > LIMITES.descricao) erros.push(`A descrição pode ter até ${LIMITES.descricao} caracteres.`);
  if (condicoes.length > LIMITES.condicoes) erros.push(`As condições podem ter até ${LIMITES.condicoes} caracteres.`);
  if (ofertaInicio && !dataISOValida(ofertaInicio)) erros.push("Data de início da oferta inválida.");
  if (ofertaFim && !dataISOValida(ofertaFim)) erros.push("Data de término da oferta inválida.");
  if (ofertaInicio && ofertaFim && dataISOValida(ofertaInicio) && dataISOValida(ofertaFim) && ofertaFim < ofertaInicio) {
    erros.push("O término da oferta não pode ser anterior ao início.");
  }

  return {
    ok: erros.length === 0,
    erros,
    normalizado: {
      nome,
      categoriaId,
      duracaoMeses,
      valorCentavos,
      taxaAdesaoCentavos,
      descricao,
      condicoes,
      ofertaInicio,
      ofertaFim,
    },
  };
}

// ----------------------------------------------------------
// INSTANTÂNEO DO PLANO NA MATRÍCULA
//
// Copiado para lead.matricula (e para o evento da timeline) no
// momento da contratação. Editar ou desativar o plano depois NÃO
// altera estes valores — é o que preserva o histórico.
// `plano` continua sendo o identificador (== código legado para os
// 4 planos antigos), por compatibilidade com tudo que já lê esse
// campo (relatórios, renovações, filtros).
// ----------------------------------------------------------

export function montarSnapshotPlano(plano, categorias = CATEGORIAS_INICIAIS) {
  const snapshot = {
    plano: plano.id,
    planoId: plano.id,
    planoNome: plano.nome,
    planoCategoriaId: plano.categoriaId || CATEGORIA_PADRAO_ID,
    planoCategoria: nomeCategoria(plano.categoriaId || CATEGORIA_PADRAO_ID, categorias),
    duracaoMeses: duracaoEmMeses(plano),
    condicoes: plano.condicoes || "",
  };
  if (Number.isInteger(plano.valorCentavos)) {
    snapshot.valorCentavos = plano.valorCentavos;
  }
  if (Number.isInteger(plano.taxaAdesaoCentavos)) {
    snapshot.taxaAdesaoCentavos = plano.taxaAdesaoCentavos;
  }
  return snapshot;
}

// Campos do instantâneo (para limpar ao trocar de plano e para o
// evento de histórico).
export const CAMPOS_SNAPSHOT = [
  "plano",
  "planoId",
  "planoNome",
  "planoCategoriaId",
  "planoCategoria",
  "duracaoMeses",
  "condicoes",
  "valorCentavos",
  "taxaAdesaoCentavos",
];

export function extrairSnapshot(matricula) {
  const saida = {};
  for (const campo of CAMPOS_SNAPSHOT) {
    if (matricula && matricula[campo] !== undefined && matricula[campo] !== null) {
      saida[campo] = matricula[campo];
    }
  }
  return saida;
}

// Aplica o instantâneo de um NOVO plano sobre uma matrícula existente,
// removendo antes os campos de instantâneo do plano anterior (para não
// misturar valor de um plano com nome de outro).
export function aplicarSnapshotNaMatricula(matricula, snapshot) {
  const base = { ...(matricula || {}) };
  for (const campo of CAMPOS_SNAPSHOT) {
    delete base[campo];
  }
  return { ...base, ...snapshot };
}

// ----------------------------------------------------------
// LISTA PARA O SELETOR (matrícula / edição / renovação)
// ----------------------------------------------------------

// planos: documentos de `planos`; categorias: documentos de
// `categoriasPlano`. `carregou`: false = erro de leitura.
// Regras:
//  - erro de leitura OU catálogo vazio  => fallback legado (4 planos)
//  - caso contrário => só planos vigentes e de categoria ativa
//  - `manter`: plano que a matrícula já usa; entra na lista mesmo se
//    estiver desativado (edição não pode "perder" o plano atual).
export function planosParaSeletor({ planos, categorias, carregou, manter = null, hoje = hojeEmISO() }) {
  const catalogo = Array.isArray(planos) ? planos : [];
  if (!carregou || catalogo.length === 0) {
    return { lista: planosLegados(), fallback: true };
  }
  const categoriaAtiva = (id) => {
    const c = (categorias || []).find((x) => x.id === id);
    return !c || c.ativo !== false;
  };
  const lista = catalogo.filter((p) => planoVigente(p, hoje) && categoriaAtiva(p.categoriaId));
  if (manter && !lista.some((p) => p.id === manter.id)) {
    lista.push({ ...manter, mantido: true });
  }
  lista.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return { lista, fallback: false };
}

// Agrupa por categoria, na ordem das categorias.
export function agruparPorCategoria(lista, categorias) {
  const cats = (categorias && categorias.length ? categorias : CATEGORIAS_INICIAIS).slice().sort(
    (a, b) => (a.ordem ?? 999) - (b.ordem ?? 999)
  );
  const grupos = [];
  const usados = new Set();
  for (const c of cats) {
    const planos = lista.filter((p) => (p.categoriaId || CATEGORIA_PADRAO_ID) === c.id);
    if (planos.length) {
      grupos.push({ categoria: c, planos });
      planos.forEach((p) => usados.add(p.id));
    }
  }
  const sobra = lista.filter((p) => !usados.has(p.id));
  if (sobra.length) {
    grupos.push({ categoria: { id: "outras", nome: "Outras" }, planos: sobra });
  }
  return grupos;
}
