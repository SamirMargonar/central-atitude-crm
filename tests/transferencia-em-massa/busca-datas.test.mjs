// BUSCA DE LEADS + DATAS BRASILEIRAS — lógica pura (sem Firebase, sem rede).
// Roda com qualquer TZ do processo: o formatador fixa America/Sao_Paulo.
import { REPO, criarRelatorio } from "./helpers.mjs";

const { check, fim } = criarRelatorio();
const U = (p) => import(`${REPO}/src/${p}`);
const { formatarData, formatarDataHora, formatarDataEHoraDaAgenda } = await U("utils/formatarData.js");
const { normalizarTexto, somenteDigitos, leadCombinaComBusca } = await U("utils/buscaLeads.js");
const { criarCacheBuscaLeads } = await U("services/cacheBuscaLeads.js");

console.log(`\n(TZ do processo: ${process.env.TZ || "padrão"})`);

console.log("\n=== A. Datas — string AAAA-MM-DD (nunca pode virar o dia anterior)");
check("2026-10-14 -> 14/10/2026", formatarData("2026-10-14") === "14/10/2026");
check("2026-01-01 -> 01/01/2026 (virada de ano)", formatarData("2026-01-01") === "01/01/2026");
check("2026-03-01 -> 01/03/2026", formatarData("2026-03-01") === "01/03/2026");
check("data sem hora em formatarDataHora continua só a data", formatarDataHora("2026-10-14") === "14/10/2026");

console.log("\n=== B. Datas — Timestamp, Date e segundos (fuso do negócio, 24 h, sem vírgula)");
const ts = (iso) => ({ toDate: () => new Date(iso) });
check("Timestamp 18:00Z -> 14/10/2026 15:00 (BRT = UTC-3)", formatarDataHora(ts("2026-10-14T18:00:00Z")) === "14/10/2026 15:00", formatarDataHora(ts("2026-10-14T18:00:00Z")));
check("Date 18:00Z -> 14/10/2026 15:00", formatarDataHora(new Date("2026-10-14T18:00:00Z")) === "14/10/2026 15:00");
check("{seconds} -> mesmo instante", formatarDataHora({ seconds: Date.parse("2026-10-14T18:00:00Z") / 1000 }) === "14/10/2026 15:00");
check("sem vírgula entre data e hora", !formatarDataHora(ts("2026-10-14T18:00:00Z")).includes(","));
check("MEIA-NOITE UTC (00:00Z) = 21:00 do dia ANTERIOR no Brasil", formatarDataHora(ts("2026-10-14T00:00:00Z")) === "13/10/2026 21:00", formatarDataHora(ts("2026-10-14T00:00:00Z")));
check("02:59Z ainda é o dia anterior no Brasil (23:59)", formatarDataHora(ts("2026-10-14T02:59:00Z")) === "13/10/2026 23:59");
check("03:00Z já é meia-noite do dia no Brasil (00:00, 24 h — não '24:00')", formatarDataHora(ts("2026-10-14T03:00:00Z")) === "14/10/2026 00:00", formatarDataHora(ts("2026-10-14T03:00:00Z")));
check("formatarData(Timestamp) devolve só a data local", formatarData(ts("2026-10-14T02:59:00Z")) === "13/10/2026");
check("hora 24 h (15:05 e não 3:05 PM)", formatarDataHora(ts("2026-10-14T18:05:00Z")) === "14/10/2026 15:05");

console.log("\n=== C. Datas — strings ISO com horário e já formatadas");
check("ISO com Z é instante -> fuso do negócio", formatarDataHora("2026-10-14T18:00:00Z") === "14/10/2026 15:00");
check("ISO com offset -03:00 -> mesma hora local", formatarDataHora("2026-10-14T15:00:00-03:00") === "14/10/2026 15:00");
check("ISO sem offset é horário de parede (não desloca)", formatarDataHora("2026-10-14T15:00:00") === "14/10/2026 15:00");
check("string já formatada permanece igual", formatarData("14/10/2026") === "14/10/2026" && formatarDataHora("14/10/2026 15:00:00") === "14/10/2026 15:00:00");

console.log("\n=== D. Datas — nulos e desconhecidos (nada inventado, nada quebra)");
check("null/undefined/'' -> valor de 'vazio'", formatarData(null) === "" && formatarData(undefined, "—") === "—" && formatarDataHora("", "—") === "—");
check("texto desconhecido volta como está", formatarData("em breve") === "em breve" && formatarDataHora("sem data") === "sem data");
check("objeto desconhecido -> vazio", formatarDataHora({ foo: 1 }, "—") === "—");
check("Date inválida -> vazio, sem lançar", formatarDataHora(new Date("x"), "—") === "—");

console.log("\n=== E. Datas — agenda local (data e hora separadas)");
check("visita: '14/10/2026 15:00'", formatarDataEHoraDaAgenda("2026-10-14", "15:00") === "14/10/2026 15:00");
check("timeline: preserva ' às '", formatarDataEHoraDaAgenda("2026-10-14", "15:00", " às ") === "14/10/2026 às 15:00");
check("sem data -> usa o texto de 'vazio' quando também não há hora", formatarDataEHoraDaAgenda("", "", " ", "sem data") === "sem data");
check("a hora da agenda NÃO é convertida de fuso", formatarDataEHoraDaAgenda("2026-10-14", "23:30") === "14/10/2026 23:30");

console.log("\n=== F. Ordenação/cálculo não dependem da formatação (valor armazenado intacto)");
{
  const visitas = [{ data: "2026-10-14" }, { data: "2026-01-02" }, { data: "2026-10-02" }];
  const antes = JSON.stringify(visitas);
  visitas.map((v) => formatarData(v.data));
  const ordenadas = [...visitas].sort((a, b) => a.data.localeCompare(b.data)).map((v) => v.data);
  check("formatar não altera os objetos", JSON.stringify(visitas) === antes);
  check("ordem cronológica pelo valor ISO preservada", ordenadas.join() === "2026-01-02,2026-10-02,2026-10-14");
}

console.log("\n=== G. Busca — normalização");
check("acento e caixa", normalizarTexto("  JOÃO   da  Conceição ") === "joao da conceicao");
check("dígitos", somenteDigitos("(11) 99999-0000") === "11999990000");

console.log("\n=== H. Busca — nome");
const L = (nome, telefone = "") => ({ nome, telefone });
const maria = L("Maria Souza Silva", "(11) 98888-7766");
check("nome completo", leadCombinaComBusca(maria, "Maria Souza Silva"));
check("parte do nome (início)", leadCombinaComBusca(maria, "mar"));
check("parte do nome (meio/fim): 'silva'", leadCombinaComBusca(maria, "silva"));
check("palavras fora de ordem: 'silva maria'", leadCombinaComBusca(maria, "silva maria"));
check("sem acento: 'joao' acha 'João'", leadCombinaComBusca(L("João Pereira"), "joao"));
check("com acento digitado e nome sem: 'conceição' acha 'Conceicao'", leadCombinaComBusca(L("Ana Conceicao"), "conceição"));
check("maiúsculas/minúsculas", leadCombinaComBusca(maria, "MARIA SOUZA"));
check("não casa nome diferente", !leadCombinaComBusca(maria, "pedro"));
check("todas as palavras precisam existir ('maria pedro' não casa)", !leadCombinaComBusca(maria, "maria pedro"));

console.log("\n=== I. Busca — telefone");
check("só dígitos", leadCombinaComBusca(maria, "11988887766"));
check("com máscara", leadCombinaComBusca(maria, "(11) 98888-7766"));
check("trecho com hífen", leadCombinaComBusca(maria, "8888-77"));
check("telefone do lead sem máscara, busca com máscara", leadCombinaComBusca(L("X", "11988887766"), "(11) 98888"));
check("com +55 na busca e sem no lead", leadCombinaComBusca(L("X", "11988887766"), "+55 11 98888-7766"));
check("sem +55 na busca e com no lead", leadCombinaComBusca(L("X", "+55 11 98888-7766"), "11988887766"));
check("dígitos que não existem não casam", !leadCombinaComBusca(maria, "11977776666"));
check("busca global exige 3+ dígitos ('12' não casa por telefone)", !leadCombinaComBusca(L("Zé", "11912345678"), "12", { minDigitos: 3 }));
check("lista local mantém o comportamento antigo (1+ dígitos)", leadCombinaComBusca(L("Zé", "11912345678"), "12"));

console.log("\n=== J. Cache de busca — uma leitura, sem leitura por digitação");
{
  let relogio = 1_000, getDocs = 0, getDoc = 0;
  const docs = [
    { id: "A", nome: "Maria Souza", telefone: "11988887766", etapa: 3, responsavelUid: "laís", responsavel: "Laís", visita: { data: "2026-10-14", hora: "15:00" }, historicoSecreto: "NAO_DEVE_FICAR_NO_CACHE", email: "x@y" },
    { id: "B", nome: "João Pereira", telefone: "11977776666", etapa: 1, responsavelUid: "isa", responsavel: "Isabelle" },
    { id: "C", nome: "Pedro Alves", telefone: "", etapa: 0 },
  ];
  const fs = {
    collection: (_db, n) => ({ n }),
    doc: (_db, n, id) => ({ n, id }),
    getDocs: async () => { getDocs++; return { docs: docs.map((d) => ({ id: d.id, data: () => ({ ...d, id: undefined }) })) }; },
    getDoc: async (ref) => { getDoc++; const d = docs.find((x) => x.id === ref.id); return { exists: () => !!d, data: () => d }; },
  };
  const cache = criarCacheBuscaLeads({ db: {}, fs, agora: () => relogio, ttlMs: 5 * 60_000, intervaloMinimoRecargaMs: 30_000 });

  check("antes de carregar: sem resultados e nenhuma leitura", cache.buscar("maria").length === 0 && getDocs === 0);
  await Promise.all([cache.carregar("isa"), cache.carregar("isa"), cache.carregar("isa")]);
  check("3 carregamentos simultâneos = UMA leitura", getDocs === 1, `getDocs=${getDocs}`);
  for (const termo of ["m", "ma", "mar", "mari", "maria", "maria s", "maria so"]) { await cache.carregar("isa"); cache.buscar(termo); }
  check("7 'digitações' seguintes: continua UMA leitura", getDocs === 1, `getDocs=${getDocs}`);
  check("termo de 1 caractere não busca", cache.buscar("m").length === 0);
  check("acha lead de outra titular pelo nome parcial", cache.buscar("souza").map((l) => l.id).join() === "A");
  check("acha por telefone com máscara", cache.buscar("(11) 97777-6666").map((l) => l.id).join() === "B");
  check("acha sem acento", cache.buscar("joao").map((l) => l.id).join() === "B");
  const guardado = JSON.stringify([...cache.buscar("maria")]);
  check("o cache NÃO guarda campos desnecessários (histórico, e-mail)", !guardado.includes("NAO_DEVE_FICAR") && !guardado.includes("x@y"));
  check("o cache preserva a titular e a visita para exibir", /"responsavel":"Laís"/.test(guardado) && /"data":"2026-10-14"/.test(guardado));

  relogio += 4 * 60_000; await cache.carregar("isa");
  check("antes do TTL (4 min): sem nova leitura", getDocs === 1);
  relogio += 2 * 60_000; await cache.carregar("isa");
  check("após o TTL (6 min): UMA nova leitura", getDocs === 2, `getDocs=${getDocs}`);

  await cache.recarregar("isa");
  check("recarregar logo após carregar (<30 s) é ignorado", getDocs === 2);
  relogio += 31_000; await cache.recarregar("isa");
  check("recarregar após 30 s refaz a leitura", getDocs === 3, `getDocs=${getDocs}`);

  docs.push({ id: "D", nome: "Carla Nova", telefone: "11955554444", etapa: 0 });
  check("lead criado depois não aparece sem atualização", cache.buscar("carla").length === 0);
  await cache.atualizarLead("D");
  check("atualizarLead(id) = 1 leitura de documento (não da coleção) e passa a achar", getDoc === 1 && getDocs === 3 && cache.buscar("carla").length === 1);
  cache.aplicarLead("D", null);
  check("lead removido sai do cache", cache.buscar("carla").length === 0);
  cache.aplicarLead("A", { ...docs[0], nome: "Maria Souza Lima", responsavelUid: "ana", responsavel: "Ana" });
  check("alteração ao vivo (nova titular) reflete na busca", cache.buscar("lima")[0]?.responsavel === "Ana");

  await cache.carregar("outra-usuaria");
  check("trocar de usuária descarta o cache e relê uma vez", getDocs === 4, `getDocs=${getDocs}`);

  let falhas = 0, relogioErro = 5_000;
  const cacheErro = criarCacheBuscaLeads({ db: {}, agora: () => relogioErro, fs: { ...fs, getDocs: async () => { falhas++; throw Object.assign(new Error("negado"), { code: "permission-denied" }); } } });
  let erro = null; try { await cacheErro.carregar("isa"); } catch (e) { erro = e; }
  check("falha de leitura propaga o erro e não deixa cache pela metade", !!erro && !cacheErro.estaCarregado());
  try { await cacheErro.carregar("isa"); } catch { /* esperado: espera após falha */ }
  check("logo após a falha NÃO há nova leitura (espera de 30 s)", falhas === 1, `falhas=${falhas}`);
  relogioErro += 31_000;
  try { await cacheErro.carregar("isa"); } catch { /* esperado */ }
  check("passados 30 s a nova tentativa é permitida (não fica preso)", falhas === 2, `falhas=${falhas}`);
}

console.log("\n=== K. Falhas: cache antigo preservado, espera de 30 s, sem bloqueio permanente");
{
  let relogio = 1_000, getDocs = 0, modo = "ok", dados = [{ id: "A", nome: "Maria Souza" }];
  const fs = {
    collection: () => ({}), doc: () => ({}), getDoc: async () => ({ exists: () => false }),
    getDocs: async () => { getDocs++; await Promise.resolve(); if (modo === "erro") throw Object.assign(new Error("rede"), { code: "unavailable" }); return { docs: dados.map((d) => ({ id: d.id, data: () => d })) }; },
  };
  const novo = () => criarCacheBuscaLeads({ db: {}, fs, agora: () => relogio, ttlMs: 5 * 60_000, intervaloMinimoRecargaMs: 30_000, esperaAposFalhaMs: 30_000 });
  const tenta = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

  // --- 1. cache existente + falha na atualização: o antigo continua disponível
  let cache = novo(); await cache.carregar("isa");
  check("1. base: cache carregado (1 leitura)", getDocs === 1 && cache.buscar("maria").length === 1);
  relogio += 6 * 60_000; modo = "erro"; dados = [{ id: "B", nome: "Outro Nome" }];
  let e1 = await tenta(() => cache.carregar("isa"));
  check("1. atualização falha -> o erro é informado (não é engolido)", e1?.code === "unavailable" && cache.ultimaFalha() === e1);
  check("1. ...e o cache ANTIGO continua disponível para busca", cache.estaCarregado() && cache.buscar("maria").map((l) => l.id).join() === "A" && cache.buscar("outro").length === 0);

  // --- 3. várias digitações após a falha: nenhuma leitura nova dentro dos 30 s
  const antes = getDocs;
  const erros = []; for (let i = 0; i < 6; i++) { relogio += 2_000; erros.push(await tenta(() => cache.carregar("isa"))); }
  check("3. 6 'digitações' em 12 s após a falha: ZERO novas leituras", getDocs === antes, `lidos=${getDocs - antes}`);
  check("3. ...e cada uma recebe o erro (a interface continua informando a falha)", erros.every((e) => e === e1));
  check("3. recarga manual dentro da espera também NÃO lê", (await tenta(() => cache.recarregar("isa"))) === e1 && getDocs === antes);
  check("3. cache antigo segue disponível durante a espera", cache.buscar("maria").length === 1);

  // --- 4. após ~30 s: uma nova tentativa é permitida
  relogio += 20_000; // 32 s desde a falha
  modo = "erro"; const e2 = await tenta(() => cache.carregar("isa"));
  check("4. após 30 s: UMA nova tentativa é feita (e falha de novo)", getDocs === antes + 1 && e2 !== null && e2 !== e1);
  check("7. falhou outra vez: nova espera de 30 s (sem leitura imediata)", (await tenta(() => cache.carregar("isa"))) === e2 && getDocs === antes + 1);

  // --- 2 e 7. sucesso depois: substitui o cache e destrava
  relogio += 31_000; modo = "ok";
  check("7. depois da nova espera a tentativa é permitida e dá certo", (await tenta(() => cache.carregar("isa"))) === null && getDocs === antes + 2);
  check("2. atualização bem-sucedida SUBSTITUI o cache (agora só o lead novo)", cache.buscar("maria").length === 0 && cache.buscar("outro").map((l) => l.id).join() === "B");
  check("2. ...e a falha anterior é esquecida", cache.ultimaFalha() === null);
  await cache.carregar("isa"); check("2. cache atualizado e fresco: sem nova leitura", getDocs === antes + 2);

  // --- falha na RECARGA MANUAL não apaga o cache (defeito 1)
  relogio += 31_000; modo = "erro"; dados = [{ id: "C", nome: "Terceiro" }];
  const e3 = await tenta(() => cache.recarregar("isa"));
  check("1. recarga manual que falha: erro informado e cache anterior intacto", e3 !== null && cache.buscar("outro").length === 1 && cache.estaCarregado());
  relogio += 31_000; modo = "ok";
  check("1. nova recarga após a espera funciona e troca o cache", (await tenta(() => cache.recarregar("isa"))) === null && cache.buscar("terceiro").length === 1 && cache.buscar("outro").length === 0);

  // --- 5. leituras simultâneas unificadas (inclusive quando falham)
  cache = novo(); getDocs = 0; modo = "erro";
  const rs = await Promise.all([1, 2, 3, 4].map(() => tenta(() => cache.carregar("isa"))));
  check("5. 4 carregamentos simultâneos que falham = UMA leitura, todos recebem o erro", getDocs === 1 && rs.every((e) => e && e.code === "unavailable"), `lidos=${getDocs}`);
  cache = novo(); getDocs = 0; modo = "ok";
  await Promise.all([1, 2, 3, 4].map(() => cache.carregar("isa")));
  check("5. 4 simultâneos com sucesso = UMA leitura", getDocs === 1);

  // --- falha na PRIMEIRA carga: sem cache; nova tentativa só após 30 s
  cache = novo(); getDocs = 0; modo = "erro";
  await tenta(() => cache.carregar("isa"));
  check("falha na primeira carga: sem cache (resultado vazio) e erro registrado", !cache.estaCarregado() && cache.buscar("maria").length === 0 && cache.ultimaFalha() !== null);
  for (let i = 0; i < 5; i++) { relogio += 1_000; await tenta(() => cache.carregar("isa")); }
  check("...5 tentativas em 5 s: continua UMA leitura", getDocs === 1);
  relogio += 30_000; modo = "ok"; dados = [{ id: "A", nome: "Maria Souza" }];
  check("7. após 30 s a carga volta a funcionar (sem bloqueio permanente)", (await tenta(() => cache.carregar("isa"))) === null && cache.buscar("maria").length === 1);

  // --- 6. resultado vazio legítimo é SUCESSO, não falha
  cache = novo(); getDocs = 0; modo = "ok"; dados = [];
  const eVazio = await tenta(() => cache.carregar("isa"));
  check("6. coleção vazia: sucesso (sem erro, cache 'carregado', sem falha registrada)", eVazio === null && cache.estaCarregado() && cache.ultimaFalha() === null && cache.buscar("maria").length === 0);
  for (let i = 0; i < 4; i++) await cache.carregar("isa");
  check("6. ...e não dispara espera nem releitura (continua fresco)", getDocs === 1);
}

console.log("\n=== L. Troca de usuária durante uma leitura: o cache NUNCA mistura usuárias");
{
  const adiado = () => { let ok, no; const p = new Promise((a, b) => { ok = a; no = b; }); return { p, ok, no }; };
  const fila = [];                                   // leituras pendentes, na ordem em que foram iniciadas
  let getDocs = 0, getDoc = 0, docUnico = { id: "X", nome: "Xavier Atualizado" };
  const fs = {
    collection: () => ({}), doc: (_d, _c, id) => ({ id }),
    getDocs: () => { getDocs++; const d = adiado(); fila.push(d); return d.p; },
    getDoc: () => { getDoc++; const d = adiado(); fila.push(d); return d.p; },
  };
  const cole = (nomes) => ({ docs: nomes.map((n, i) => ({ id: n, data: () => ({ nome: n }) })) });
  const novo = () => criarCacheBuscaLeads({ db: {}, fs, agora: () => 1_000 });
  const tenta = async (p) => { try { await p; return null; } catch (e) { return e; } };

  // 1. a leitura da usuária A termina DEPOIS de B já estar ativa
  let cache = novo(); fila.length = 0; getDocs = 0;
  const pA = cache.carregar("A"); const pB = cache.carregar("B");
  check("1. A e B têm leituras próprias (A não é reaproveitada para B)", getDocs === 2, `getDocs=${getDocs}`);
  fila[1].ok(cole(["DadosDaB"])); await pB;
  fila[0].ok(cole(["DadosDaA"])); await pA;
  check("1. leitura ATRASADA de A é descartada: o cache de B só tem os dados de B", cache.buscar("dadosdab").length === 1 && cache.buscar("dadosdaa").length === 0);

  // 2. a leitura de A termina ANTES de B terminar: B não enxerga dados de A
  cache = novo(); fila.length = 0;
  const pA2 = cache.carregar("A"); const pB2 = cache.carregar("B");
  fila[0].ok(cole(["DadosDaA"])); await pA2;
  check("2. A termina primeiro: para B o cache continua VAZIO (não carregado)", !cache.estaCarregado() && cache.buscar("dadosda").length === 0);
  fila[1].ok(cole(["DadosDaB"])); await pB2;
  check("2. quando B termina, só os dados de B", cache.buscar("dadosdab").length === 1 && cache.buscar("dadosdaa").length === 0);

  // 3. a leitura de A FALHA depois da troca: não coloca B em espera nem registra erro em B
  cache = novo(); fila.length = 0; getDocs = 0;
  const pA3 = cache.carregar("A"); const pB3 = cache.carregar("B");
  fila[1].ok(cole(["DadosDaB"])); await pB3;
  fila[0].no(Object.assign(new Error("sessão encerrada"), { code: "permission-denied" }));
  const eA = await tenta(pA3);
  check("3. a falha tardia de A não é registrada no cache de B", cache.ultimaFalha() === null && cache.estaCarregado());
  check("3. ...e a busca de B continua funcionando", cache.buscar("dadosdab").length === 1);
  await cache.recarregar("B").catch(() => {});
  check("3. ...e nenhuma leitura extra foi disparada por causa da falha de A", getDocs === 2, `getDocs=${getDocs}`);

  // 4. A falha e B ainda não terminou: B não herda a espera
  cache = novo(); fila.length = 0; getDocs = 0;
  const pA4 = cache.carregar("A"); const pB4 = cache.carregar("B");
  fila[0].no(new Error("falhou")); await tenta(pA4);
  fila[1].ok(cole(["DadosDaB"])); const eB = await tenta(pB4);
  check("4. B conclui normalmente mesmo que a leitura de A tenha falhado antes", eB === null && cache.buscar("dadosdab").length === 1 && cache.ultimaFalha() === null);

  // 5. atualizarLead de A que termina depois da troca não altera o cache de B
  cache = novo(); fila.length = 0;
  const cA = cache.carregar("A"); fila[0].ok(cole(["X"])); await cA;
  const pUpd = cache.atualizarLead("X");                          // relê 1 doc como A
  const cB = cache.carregar("B"); fila[2].ok(cole(["DadosDaB"])); await cB;
  fila[1].ok({ exists: () => true, data: () => docUnico }); await pUpd;
  check("5. atualização de 1 lead iniciada por A e concluída após a troca é ignorada", cache.buscar("xavier").length === 0 && cache.buscar("dadosdab").length === 1);

  // 6. sem troca de usuária nada muda (controle)
  cache = novo(); fila.length = 0;
  const c1 = cache.carregar("A"); const c2 = cache.carregar("A");
  check("6. controle: mesma usuária compartilha a leitura", getDocs >= 1 && fila.length === 1);
  fila[0].ok(cole(["Normal"])); await Promise.all([c1, c2]);
  check("6. controle: cache da mesma usuária preenchido normalmente", cache.buscar("normal").length === 1);
}

process.exit(fim() ? 1 : 0);
