// PLANOS, RENOVAÇÃO E WHATSAPP — lógica pura (sem Firebase, sem rede).
// Roda com qualquer TZ: o vencimento usa o meio-dia local, como as versões anteriores.
import { REPO, criarRelatorio } from "./helpers.mjs";

const { check, fim } = criarRelatorio();
const U = (p) => import(`${REPO}/src/${p}`);
const P = await U("utils/planos.js");
const R = await U("utils/renovacaoAcoes.js");
const W = await U("utils/whatsapp.js");
const { criarServicoPlanos, gerarIdCategoria } = await U("planos/servicoPlanos.js");

console.log(`\n(TZ do processo: ${process.env.TZ || "padrão"})`);

console.log("\n=== A. Vencimento por duração == regra antiga dos 4 códigos (paridade, 3 anos de datas)");
{
  // cópia FIEL da lógica que existia em MatriculaAction/EditarMatriculaAction/renovacaoAcoes
  function legado(data, plano) {
    const inicio = new Date(`${data}T12:00:00`);
    if (Number.isNaN(inicio.getTime())) return "";
    const v = new Date(inicio);
    if (plano === "MENSAL") v.setMonth(v.getMonth() + 1);
    if (plano === "TRIMESTRAL") v.setMonth(v.getMonth() + 3);
    if (plano === "SEMESTRAL") v.setMonth(v.getMonth() + 6);
    if (plano === "ANUAL") v.setFullYear(v.getFullYear() + 1);
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  let dif = 0, total = 0, exemplo = "";
  for (let t = Date.UTC(2023, 0, 1); t < Date.UTC(2026, 0, 1); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    for (const cod of ["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"]) {
      total++;
      const novo = P.calcularVencimentoPorMeses(d, P.MESES_POR_CODIGO_LEGADO[cod]);
      if (novo !== legado(d, cod)) { dif++; exemplo ||= `${d} ${cod}: ${novo} x ${legado(d, cod)}`; }
    }
  }
  check(`${total} combinações data x plano: nenhuma diferença do cálculo antigo`, dif === 0, exemplo);
  check("31/01 + 1 mês mantém o comportamento antigo de transbordo (sem 'corrigir' contratos)", P.calcularVencimentoPorMeses("2026-01-31", 1) === legado("2026-01-31", "MENSAL"));
  check("29/02/2024 + 12 meses == antigo ANUAL", P.calcularVencimentoPorMeses("2024-02-29", 12) === legado("2024-02-29", "ANUAL"));
  check("data inválida / vazio / meses inválidos => ''", P.calcularVencimentoPorMeses("", 1) === "" && P.calcularVencimentoPorMeses("xx", 1) === "" && P.calcularVencimentoPorMeses("2026-01-01", 0) === "" && P.calcularVencimentoPorMeses("2026-01-01", null) === "");
  check("duração livre (ex.: 2 e 18 meses)", P.calcularVencimentoPorMeses("2026-10-14", 2) === "2026-12-14" && P.calcularVencimentoPorMeses("2026-10-14", 18) === "2028-04-14");
}

console.log("\n=== B. Duração/nome de matrículas ANTIGAS (só `plano`) e novas (com instantâneo)");
{
  check("matrícula antiga TRIMESTRAL => 3 meses e 'Plano Trimestral'", P.duracaoEmMeses({ plano: "TRIMESTRAL" }) === 3 && P.nomeDaMatricula({ plano: "TRIMESTRAL" }) === "Plano Trimestral");
  check("os 4 códigos legados mapeiam 1/3/6/12", ["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"].map((c) => P.duracaoEmMeses({ plano: c })).join() === "1,3,6,12");
  check("instantâneo manda sobre o código: duracaoMeses/planoNome da matrícula", P.duracaoEmMeses({ plano: "MENSAL", duracaoMeses: 2 }) === 2 && P.nomeDaMatricula({ plano: "BF25", planoNome: "Black Friday 2025" }) === "Black Friday 2025");
  check("código desconhecido: nome = próprio código; duração = null (não inventa)", P.nomeDaMatricula({ plano: "XPTO" }) === "XPTO" && P.duracaoEmMeses({ plano: "XPTO" }) === null);
  check("sem plano: 'Plano não informado'", P.nomeDaMatricula({}) === "Plano não informado" && P.nomeDaMatricula(undefined) === "Plano não informado");
}

console.log("\n=== C. Valores em reais <-> centavos");
{
  const c = P.reaisParaCentavos;
  check("'129,90' -> 12990", c("129,90") === 12990);
  check("'1.299,90' -> 129990 e 'R$ 99,90' -> 9990", c("1.299,90") === 129990 && c("R$ 99,90") === 9990);
  check("'99.9' -> 9990 e '100' -> 10000 e '0' -> 0", c("99.9") === 9990 && c("100") === 10000 && c("0") === 0);
  check("vazio -> null (preço não definido)", c("") === null && c("   ") === null && c(null) === null);
  check("lixo -> NaN (a tela avisa; nunca grava)", Number.isNaN(c("abc")) && Number.isNaN(c("12,345")) && Number.isNaN(c("-5")) && Number.isNaN(c("1,2,3")));
  check("sem erro de ponto flutuante (19,99 -> 1999; 0,07 -> 7)", c("19,99") === 1999 && c("0,07") === 7);
  check("centavosParaCampo / centavosParaReais", P.centavosParaCampo(12990) === "129,90" && P.centavosParaReais(12990).replace(/\s/g, " ").includes("129,90") && P.centavosParaCampo(null) === "");
}

console.log("\n=== D. Validação do cadastro de plano");
{
  const base = { nome: "Plano X", categoriaId: "promocionais", duracaoMeses: 3, valorCentavos: 9990, taxaAdesaoCentavos: 0, descricao: "", condicoes: "", ofertaInicio: null, ofertaFim: null };
  check("plano válido", P.validarPlano(base).ok);
  check("sem preço é válido (admin preenche depois)", P.validarPlano({ ...base, valorCentavos: null, taxaAdesaoCentavos: null }).ok);
  const ruim = (extra) => !P.validarPlano({ ...base, ...extra }).ok;
  check("nome vazio / só espaços / > 80", ruim({ nome: "" }) && ruim({ nome: "   " }) && ruim({ nome: "x".repeat(81) }));
  check("sem categoria", ruim({ categoriaId: "" }));
  check("duração 0, negativa, decimal, 121, texto", ruim({ duracaoMeses: 0 }) && ruim({ duracaoMeses: -1 }) && ruim({ duracaoMeses: 1.5 }) && ruim({ duracaoMeses: 121 }) && ruim({ duracaoMeses: "abc" }));
  check("valor negativo / decimal / enorme", ruim({ valorCentavos: -1 }) && ruim({ valorCentavos: 10.5 }) && ruim({ valorCentavos: 100_000_001 }));
  check("datas da oferta inválidas / fim antes do início", ruim({ ofertaInicio: "2026-13-01" }) && ruim({ ofertaFim: "31/12/2026" }) && ruim({ ofertaInicio: "2026-11-30", ofertaFim: "2026-11-01" }));
  check("oferta com início = fim é válida", P.validarPlano({ ...base, ofertaInicio: "2026-11-27", ofertaFim: "2026-11-27" }).ok);
  check("descrição > 500 e condições > 1000", ruim({ descricao: "x".repeat(501) }) && ruim({ condicoes: "x".repeat(1001) }));
}

console.log("\n=== E. Vigência da oferta (início/término) e desativação");
{
  const pl = (extra) => ({ id: "p", nome: "P", categoriaId: "c", duracaoMeses: 1, ativo: true, ...extra });
  check("ativo sem janela: vigente", P.planoVigente(pl({}), "2026-10-14"));
  check("desativado: nunca vigente", !P.planoVigente(pl({ ativo: false }), "2026-10-14"));
  check("antes do início: fora", !P.planoVigente(pl({ ofertaInicio: "2026-11-01" }), "2026-10-31"));
  check("no dia do início: vigente", P.planoVigente(pl({ ofertaInicio: "2026-11-01" }), "2026-11-01"));
  check("no último dia: vigente; no dia seguinte: fora", P.planoVigente(pl({ ofertaFim: "2026-11-30" }), "2026-11-30") && !P.planoVigente(pl({ ofertaFim: "2026-11-30" }), "2026-12-01"));
  check("hoje no fuso do negócio: 02:59Z ainda é o dia anterior no Brasil", P.hojeEmISO(new Date("2026-10-14T02:59:00Z")) === "2026-10-13" && P.hojeEmISO(new Date("2026-10-14T03:00:00Z")) === "2026-10-14");
}

console.log("\n=== F. Lista do seletor: ativos, categorias, fallback, plano mantido");
{
  const hoje = "2026-10-14";
  const mk = (id, extra = {}) => ({ id, nome: `Plano ${id}`, categoriaId: "convencionais", duracaoMeses: 1, ativo: true, ordem: 1, ...extra });
  const cats = [{ id: "convencionais", nome: "Convencionais", ativo: true, ordem: 1 }, { id: "promocionais", nome: "Promocionais", ativo: true, ordem: 2 }, { id: "bf", nome: "Black Friday", ativo: false, ordem: 3 }];
  const ids = (r) => r.lista.map((p) => p.id).join();

  let r = P.planosParaSeletor({ planos: [], categorias: [], carregou: true, hoje });
  check("catálogo VAZIO => fallback nos 4 planos legados (matrícula nunca fica sem opção)", r.fallback && ids(r) === "MENSAL,TRIMESTRAL,SEMESTRAL,ANUAL");
  r = P.planosParaSeletor({ planos: [mk("A")], categorias: cats, carregou: false, hoje });
  check("erro de leitura (ex.: Rules ainda não publicadas) => fallback legado", r.fallback && ids(r) === "MENSAL,TRIMESTRAL,SEMESTRAL,ANUAL");
  r = P.planosParaSeletor({ planos: [mk("A"), mk("B", { ativo: false }), mk("C", { ofertaFim: "2026-10-01" }), mk("D", { ofertaInicio: "2026-12-01" }), mk("E", { categoriaId: "bf" })], categorias: cats, carregou: true, hoje });
  check("só ativos, dentro da vigência e de categoria ativa", !r.fallback && ids(r) === "A", ids(r));
  r = P.planosParaSeletor({ planos: [mk("B", { ativo: false })], categorias: cats, carregou: true, hoje });
  check("TODOS desativados (catálogo existe) => lista vazia, SEM fallback", !r.fallback && r.lista.length === 0);
  r = P.planosParaSeletor({ planos: [mk("A"), mk("B", { ativo: false })], categorias: cats, carregou: true, manter: { id: "B", nome: "Plano B (contrato)" }, hoje });
  check("plano do contrato desativado continua na lista (marcado como mantido)", ids(r) === "A,B" && r.lista[1].mantido === true);
  r = P.planosParaSeletor({ planos: [mk("A"), mk("Z", { ordem: 1, nome: "Aaa" }), mk("M", { ordem: 0 })], categorias: cats, carregou: true, hoje });
  check("ordenação por ordem e depois nome", ids(r) === "M,Z,A");
  const g = P.agruparPorCategoria([mk("A"), mk("P", { categoriaId: "promocionais" }), mk("O", { categoriaId: "outra" })], cats);
  check("agrupa por categoria na ordem; categoria desconhecida vai para 'Outras'", g.map((x) => x.categoria.nome).join() === "Convencionais,Promocionais,Outras");
}

console.log("\n=== G. Instantâneo na matrícula: editar/desativar o plano NÃO muda o contrato");
{
  const plano = { id: "BF25", nome: "Black Friday 12m", categoriaId: "black-friday", duracaoMeses: 12, valorCentavos: 99900, taxaAdesaoCentavos: 0, condicoes: "Pagamento à vista" };
  const snap = P.montarSnapshotPlano(plano);
  check("snapshot guarda id, nome, categoria (id e nome), valor, taxa, duração e condições", snap.plano === "BF25" && snap.planoId === "BF25" && snap.planoNome === "Black Friday 12m" && snap.planoCategoriaId === "black-friday" && snap.planoCategoria === "Black Friday" && snap.valorCentavos === 99900 && snap.taxaAdesaoCentavos === 0 && snap.duracaoMeses === 12 && snap.condicoes === "Pagamento à vista", JSON.stringify(snap));
  const matricula = { confirmada: true, consultor: "Ana", status: "ATIVA", dataInicio: "2026-10-14", dataVencimento: "2027-10-14", ...snap };
  const fotografia = JSON.stringify(matricula);
  // o administrador edita o plano e depois o desativa
  plano.valorCentavos = 150000; plano.nome = "OUTRO NOME"; plano.duracaoMeses = 6; plano.ativo = false; plano.condicoes = "mudou";
  check("depois de editar/desativar o plano, a matrícula já contratada fica IDÊNTICA", JSON.stringify(matricula) === fotografia);
  check("e continua sendo lida com o nome/duração da época", P.nomeDaMatricula(matricula) === "Black Friday 12m" && P.duracaoEmMeses(matricula) === 12);
  const semPreco = P.montarSnapshotPlano({ id: "MENSAL", nome: "Plano Mensal", categoriaId: "convencionais", duracaoMeses: 1, valorCentavos: null });
  check("plano sem preço: o snapshot NÃO inclui valor (campo ausente, não zero)", !("valorCentavos" in semPreco) && !("taxaAdesaoCentavos" in semPreco) && semPreco.duracaoMeses === 1);
  const trocada = P.aplicarSnapshotNaMatricula({ ...matricula, observacao: "obs" }, P.montarSnapshotPlano({ id: "MENSAL", nome: "Plano Mensal", categoriaId: "convencionais", duracaoMeses: 1 }));
  check("trocar de plano limpa o instantâneo anterior (sem misturar valor de um plano com nome de outro)", trocada.plano === "MENSAL" && trocada.planoNome === "Plano Mensal" && !("valorCentavos" in trocada) && trocada.observacao === "obs" && trocada.consultor === "Ana");
  check("extrairSnapshot devolve só os campos de plano", Object.keys(P.extrairSnapshot(matricula)).every((k) => P.CAMPOS_SNAPSHOT.includes(k)) && !("consultor" in P.extrairSnapshot(matricula)));
}

console.log("\n=== H. Renovação: compatível com códigos antigos e com planos do catálogo");
{
  check("renovação por CÓDIGO legado (assinatura antiga) == antes", R.calcularVencimentoRenovacao("2026-10-14", "TRIMESTRAL") === "2027-01-14" && R.calcularVencimentoRenovacao("2026-10-14", "ANUAL") === "2027-10-14" && R.calcularVencimentoRenovacao("2026-10-14", "MENSAL") === "2026-11-14");
  check("renovação por OBJETO do plano usa a duração dele", R.calcularVencimentoRenovacao("2026-10-14", { id: "X", duracaoMeses: 2 }) === "2026-12-14");
  check("plano sem duração conhecida => '' (a tela bloqueia; não grava vencimento inventado)", R.calcularVencimentoRenovacao("2026-10-14", { id: "X" }) === "" && R.calcularVencimentoRenovacao("2026-10-14", "DESCONHECIDO") === "");
  const antiga = { confirmada: true, consultor: "Ana", status: "ATIVA", plano: "MENSAL", dataInicio: "2026-09-14", dataVencimento: "2026-10-14", observacao: "o" };
  const legadoR = R.construirMatriculaRenovada(antiga, { plano: "ANUAL", dataInicio: "2026-10-14", dataVencimento: "2027-10-14" });
  check("renovação sem snapshot (legado): só troca plano/datas", legadoR.plano === "ANUAL" && legadoR.consultor === "Ana" && legadoR.observacao === "o" && !("planoNome" in legadoR));
  const snap = P.montarSnapshotPlano({ id: "TP", nome: "TotalPass 6m", categoriaId: "totalpass", duracaoMeses: 6, valorCentavos: 5000 });
  const nova = R.construirMatriculaRenovada({ ...antiga, ...P.montarSnapshotPlano({ id: "MENSAL", nome: "Plano Mensal", categoriaId: "convencionais", duracaoMeses: 1, valorCentavos: 12000 }) }, { plano: "TP", dataInicio: "2026-10-14", dataVencimento: "2027-04-14", snapshot: snap });
  check("renovação com snapshot: novo contrato (plano, nome, valor, duração do NOVO plano) preservando consultor/status/observação", nova.plano === "TP" && nova.planoNome === "TotalPass 6m" && nova.valorCentavos === 5000 && nova.duracaoMeses === 6 && nova.consultor === "Ana" && nova.status === "ATIVA" && nova.observacao === "o");
  check("mensagem de renovação usa o nome do plano da matrícula (legado e novo)", R.construirMensagemContato({ nome: "Maria", matricula: antiga }).includes("Plano Mensal") && R.construirMensagemContato({ nome: "Maria", matricula: nova }).includes("TotalPass 6m"));
}

console.log("\n=== I. Carga inicial preparada (definição) — 7 categorias, 4 planos legados sem preço");
{
  check("7 categorias iniciais na ordem pedida", P.CATEGORIAS_INICIAIS.map((c) => c.nome).join() === "Convencionais,Promocionais,Black Friday,Aniversário,TotalPass,Corporativos,Especiais");
  check("4 planos com os códigos atuais e durações 1/3/6/12", P.PLANOS_INICIAIS.map((p) => `${p.id}:${p.duracaoMeses}`).join() === "MENSAL:1,TRIMESTRAL:3,SEMESTRAL:6,ANUAL:12");
  check("sem preço definido na carga inicial", P.PLANOS_INICIAIS.every((p) => !("valorCentavos" in p) && !("taxaAdesaoCentavos" in p)));
  check("ids das categorias são slugs estáveis", gerarIdCategoria("Black Friday") === "black-friday" && gerarIdCategoria("Aniversário") === "aniversario" && gerarIdCategoria("  Estudantes & Pós ") === "estudantes-pos");
}

console.log("\n=== J. Serviço (fs falso): nunca apaga, valida, carga inicial idempotente");
{
  const banco = new Map(); const chamadas = [];
  const fs = {
    collection: (_d, n) => ({ n }), doc: (a, n, id) => (n === undefined ? { n: a.n, id: `auto${banco.size + chamadas.length}` } : { n, id }),
    serverTimestamp: () => "TS",
    getDocs: async (c) => ({ docs: [...banco].filter(([k]) => k.startsWith(c.n + "/")).map(([k, v]) => ({ id: k.split("/")[1], data: () => v })) }),
    getDoc: async (r) => ({ exists: () => banco.has(`${r.n}/${r.id}`), data: () => banco.get(`${r.n}/${r.id}`) }),
    setDoc: async (r, d) => { chamadas.push(["setDoc", r.n, r.id]); banco.set(`${r.n}/${r.id}`, d); },
    updateDoc: async (r, d) => { chamadas.push(["updateDoc", r.n, r.id]); banco.set(`${r.n}/${r.id}`, { ...banco.get(`${r.n}/${r.id}`), ...d }); },
  };
  const sv = criarServicoPlanos({ db: {}, fs });
  const adm = { uid: "adm", nome: "Samir" };
  let e = null; try { await sv.salvarPlano({ dados: { nome: "", categoriaId: "x", duracaoMeses: 1 } }, adm); } catch (x) { e = x; }
  check("plano inválido é rejeitado ANTES de gravar", e?.codigo === "PLANO_INVALIDO" && chamadas.length === 0);
  e = null; try { await sv.salvarPlano({ dados: { nome: "A", categoriaId: "x", duracaoMeses: 1 } }, null); } catch (x) { e = x; }
  check("sem administrador identificado: não grava", !!e && chamadas.length === 0);
  const id = await sv.salvarPlano({ dados: { nome: "Promo 3m", categoriaId: "promocionais", duracaoMeses: 3, valorCentavos: 9990, taxaAdesaoCentavos: null, descricao: "", condicoes: "", ofertaInicio: null, ofertaFim: null } }, adm);
  const criado = banco.get(`planos/${id}`);
  check("criar: grava ativo, autoria (uid/nome) e carimbos do servidor", criado.ativo === true && criado.criadoPorUid === "adm" && criado.atualizadoPorUid === "adm" && criado.criadoEm === "TS" && criado.valorCentavos === 9990);
  await sv.definirAtivoPlano(id, false, adm);
  check("desativar = updateDoc ativo:false (o documento permanece)", banco.get(`planos/${id}`).ativo === false && banco.has(`planos/${id}`));
  await sv.salvarPlano({ id, dados: { nome: "Promo 3m v2", categoriaId: "promocionais", duracaoMeses: 3, valorCentavos: 8990 } }, adm);
  check("editar não reativa nem apaga e mantém criadoPor", banco.get(`planos/${id}`).ativo === false && banco.get(`planos/${id}`).valorCentavos === 8990 && banco.get(`planos/${id}`).criadoPorUid === "adm");
  const cat = await sv.criarCategoria("Estudantes", adm, 8);
  check("categoria nova criada (id slug) e duplicada recusada", cat === "estudantes" && banco.get("categoriasPlano/estudantes").ativo === true);
  e = null; try { await sv.criarCategoria("estudantes", adm); } catch (x) { e = x; }
  check("categoria duplicada: erro CATEGORIA_DUPLICADA e nada sobrescrito", e?.codigo === "CATEGORIA_DUPLICADA");
  await sv.definirAtivaCategoria("estudantes", false, adm);
  check("categoria desativada, não excluída", banco.get("categoriasPlano/estudantes").ativo === false);
  const r1 = await sv.cargaInicial(adm);
  check("carga inicial cria 7 categorias (1 já existia? não: 'estudantes' é extra) + 4 planos", r1.criadas.length === 11 && r1.jaExistiam.length === 0, JSON.stringify(r1));
  banco.set("planos/MENSAL", { ...banco.get("planos/MENSAL"), valorCentavos: 11111, nome: "Plano Mensal EDITADO" });
  const antes = chamadas.length;
  const r2 = await sv.cargaInicial(adm);
  check("2ª carga inicial: nada criado, nada sobrescrito (preço/nome editados pelo admin permanecem)", r2.criadas.length === 0 && r2.jaExistiam.length === 11 && chamadas.length === antes && banco.get("planos/MENSAL").valorCentavos === 11111 && banco.get("planos/MENSAL").nome === "Plano Mensal EDITADO");
  check("planos iniciais criados sem preço e marcados como legado", banco.get("planos/ANUAL").valorCentavos === null && banco.get("planos/ANUAL").legado === true && banco.get("planos/ANUAL").duracaoMeses === 12);
  check("nenhum método de exclusão existe no serviço nem foi chamado", !Object.keys(sv).some((k) => /excluir|apagar|delete|remover/i.test(k)) && !chamadas.some((c) => /delete/i.test(c[0])));
  const cat2 = await sv.carregarCatalogo();
  check("carregarCatalogo lê planos e categorias", cat2.planos.length >= 5 && cat2.categorias.length === 8);
}

console.log("\n=== K. WhatsApp: normalização do telefone (sem chutar DDD)");
{
  const n = W.normalizarTelefoneWhatsApp;
  const ok = (t, esperado) => { const r = n(t); return r.ok && r.numero === esperado && r.url === `https://wa.me/${esperado}`; };
  check("11 dígitos com DDD => 55 + número", ok("41997067789", "5541997067789"));
  check("com máscara (41) 99706-7789", ok("(41) 99706-7789", "5541997067789"));
  check("com espaço e hífen: 41 99706-7789", ok("41 99706-7789", "5541997067789"));
  check("espaço inseparável e hífen especial (U+00A0 / U+2011) como nos dados reais", ok("41 99706‑7789", "5541997067789"));
  check("já com DDI: +55 41 99706-7789 (não duplica 55)", ok("+55 41 99706-7789", "5541997067789") && ok("5541997067789", "5541997067789"));
  check("DDI com 10 dígitos locais (fixo): 55 41 3333-4444", ok("554133334444", "554133334444"));
  check("zero de tronco: 041 99706-7789 e 0 41 99706 7789", ok("041997067789", "5541997067789") && ok("0 41 99706 7789", "5541997067789"));
  check("10 dígitos com DDD (fixo/antigo): aceito como digitado, sem inventar o 9", ok("4133334444", "554133334444") && ok("41 9970-6778", "55419970678".length ? "554199706778" : ""));
  check("DDD de outras cidades: (11) 91234-5678 e (92) 99999-9999", ok("11912345678", "5511912345678") && ok("92999999999", "5592999999999"));
  const semDdd = n("99706-7789");
  check("SEM DDD (9 dígitos) => indisponível, com orientação, nunca assume o 41", !semDdd.ok && semDdd.motivo === "sem_ddd" && /DDD/.test(semDdd.mensagem) && !semDdd.url);
  check("SEM DDD (8 dígitos) => indisponível", !n("9706-7789").ok && n("9706-7789").motivo === "sem_ddd");
  const amb = n("55 99706-7789");
  check("começa com 55 e tem 11 dígitos (DDI sem DDD x DDD 55) => ambíguo, indisponível", !amb.ok && amb.motivo === "ambiguo" && !amb.url);
  check("DDD inexistente (10/20/30/00...) => indisponível", !n("1099706-7789".replace("-", "")).ok && !n("20997067789").ok && !n("00997067789").ok);
  check("11 dígitos sem o 9 do celular na posição certa (41 39970-6778) => indisponível", !n("41399706778").ok);
  check("muito curto, longo demais ou texto => indisponível", !n("123").ok && !n("4199706778912345").ok && !n("abc").ok);
  check("vazio / nulo => motivo 'vazio' (o botão nem aparece)", n("").motivo === "vazio" && n(null).motivo === "vazio" && n(undefined).motivo === "vazio");
  check("o link NÃO leva mensagem (só abre a conversa)", !n("41997067789").url.includes("?"));
  check("construirLinkWhatsApp (fluxo existente) permanece como era", W.construirLinkWhatsApp("(41) 99706-7789", "oi") === "https://wa.me/5541997067789?text=oi");
}

process.exit(fim() ? 1 : 0);
