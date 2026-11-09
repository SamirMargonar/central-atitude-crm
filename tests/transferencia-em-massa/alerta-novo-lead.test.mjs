// CHEGADAS DE LEADS + REGRAS DO ALARME SONORO — lógica pura (sem React, sem Firebase).
import { REPO, criarRelatorio } from "./helpers.mjs";

const { check, fim } = criarRelatorio();
const { criarRastreadorDeChegadas } = await import(`${REPO}/src/utils/chegadasDeLeads.js`);
const { leadPendenteParaAlarme, aplicarChegadas, podarAlarme, cadastradoPelaPropriaUsuaria } = await import(`${REPO}/src/utils/alertaNovoLead.js`);

const L = (id, extra = {}) => ({ id, nome: "Cliente " + id, etapa: 0, assumido: false, responsavelUid: "", ...extra });
const ids = (r) => r.leads.map((l) => l.id).sort().join();
const idsCh = (r) => r.chegadas.map((c) => c.id).join();

console.log("\n=== A. Linha de base: o backlog existente NUNCA gera chegada (abrir / F5 não toca de novo)");
{
  const t = criarRastreadorDeChegadas(["proprios", "fila"]);
  let r = t.atualizar("proprios", [L("a", { assumido: true, responsavelUid: "u1" })]);
  check("só a 1ª consulta entregou: mostra a lista parcial, sem chegadas e sem linha de base", ids(r) === "a" && r.chegadas.length === 0 && !t.linhaDeBaseFeita());
  r = t.atualizar("fila", [L("b"), L("c")]);
  check("a última consulta entregou: lista completa e AINDA nenhuma chegada (backlog antigo)", ids(r) === "a,b,c" && r.chegadas.length === 0 && t.linhaDeBaseFeita());
  r = t.atualizar("fila", [L("b"), L("c")]);
  check("o mesmo snapshot de novo não gera nada", r.chegadas.length === 0);
}

console.log("\n=== B. Lead novo depois da linha de base: uma chegada, uma vez só, sem duplicar");
{
  const t = criarRastreadorDeChegadas(["proprios", "fila"]);
  t.atualizar("proprios", []); t.atualizar("fila", [L("b")]);
  let r = t.atualizar("fila", [L("b"), L("n1")]);
  check("lead novo na fila => 1 chegada com seq 1 e o lead", idsCh(r) === "n1" && r.chegadas[0].seq === 1 && r.chegadas[0].lead.nome === "Cliente n1");
  r = t.atualizar("fila", [L("b"), L("n1")]);
  check("o mesmo lead em snapshot seguinte: nenhuma chegada repetida", r.chegadas.length === 0);
  r = t.atualizar("fila", [L("b"), L("n1", { nome: "Editado" })]);
  check("alteração do lead (modified) não é chegada", r.chegadas.length === 0);
  r = t.atualizar("fila", [L("b"), L("n1"), L("n2"), L("n3")]);
  check("dois leads de uma vez: duas chegadas com seq crescente (2 e 3)", idsCh(r) === "n2,n3" && r.chegadas.map((c) => c.seq).join() === "2,3");
}

console.log("\n=== C. Assumir (fila -> próprios) e corrida entre as duas consultas NÃO viram chegada");
{
  const t = criarRastreadorDeChegadas(["proprios", "fila"]);
  t.atualizar("proprios", []); t.atualizar("fila", [L("x")]);
  // outra recepcionista assume: sai da fila (e nunca entra nos meus próprios)
  let r = t.atualizar("fila", []);
  check("lead assumido por OUTRA some da fila: lista sem ele, sem chegada", ids(r) === "" && r.chegadas.length === 0);
  // eu assumo: a fila entrega primeiro (sem o lead) e depois a consulta "próprios" o inclui
  t.atualizar("fila", [L("y")]);
  r = t.atualizar("fila", []);
  r = t.atualizar("proprios", [L("y", { assumido: true, responsavelUid: "u1" })]);
  check("assumir um lead da fila: ele passa de fila para próprios SEM gerar chegada (já era conhecido)", idsCh(r) === "" && ids(r) === "y");
  check("e continua uma única vez na lista (sem duplicar por id)", r.leads.filter((l) => l.id === "y").length === 1);
  const dup = criarRastreadorDeChegadas(["proprios", "fila"]);
  dup.atualizar("proprios", []); dup.atualizar("fila", []);
  dup.atualizar("fila", [L("z")]);
  r = dup.atualizar("proprios", [L("z", { assumido: true, responsavelUid: "u1" })]);
  check("lead presente nas DUAS consultas ao mesmo tempo aparece uma vez só", r.leads.length === 1);
}

console.log("\n=== D. Reconexão: o que chegou durante a queda aparece; nada se repete");
{
  const t = criarRastreadorDeChegadas(["proprios", "fila"]);
  t.atualizar("proprios", []); t.atualizar("fila", [L("a")]);
  // a escuta da fila caiu; ao reabrir, o primeiro snapshot traz o estado atual do servidor
  let r = t.atualizar("fila", [L("a"), L("perdido1"), L("perdido2")]);
  check("leads criados durante a queda chegam como chegadas ao reconectar (alerta não se perde)", idsCh(r) === "perdido1,perdido2");
  r = t.atualizar("fila", [L("a"), L("perdido1"), L("perdido2")]);
  check("reabrir de novo e receber o mesmo estado NÃO repete", r.chegadas.length === 0);
}

console.log("\n=== E. Perfil de uma consulta só e continuidade do seq");
{
  const t = criarRastreadorDeChegadas(["todos"]);
  let r = t.atualizar("todos", [L("a"), L("b")]);
  check("consulta única: a 1ª entrega já é a linha de base", r.chegadas.length === 0 && t.linhaDeBaseFeita());
  r = t.atualizar("todos", [L("a"), L("b"), L("c")]);
  check("novo lead => chegada", idsCh(r) === "c");
  const t2 = criarRastreadorDeChegadas(["todos"], { seqInicial: 7 });
  t2.atualizar("todos", [L("a")]);
  r = t2.atualizar("todos", [L("a"), L("b")]);
  check("seq continua de onde o consumidor parou (seqInicial)", r.chegadas[0].seq === 8);
}

console.log("\n=== F. Quem pode ser alertado: lead pendente e que NÃO é da própria usuária");
{
  const eu = { uid: "u1", nome: "Ana Souza" };
  check("lead novo, não assumido, etapa Recebidos => pendente", leadPendenteParaAlarme(L("a", { cadastradoPor: "Samir", cadastradoPorUid: "adm" }), eu));
  check("etapa ausente conta como Recebidos (compatível com o comportamento anterior)", leadPendenteParaAlarme({ id: "a", assumido: false }, eu));
  check("já assumido => não é pendente", !leadPendenteParaAlarme(L("a", { assumido: true }), eu));
  check("saiu da etapa Recebidos => não é pendente", !leadPendenteParaAlarme(L("a", { etapa: 1 }), eu));
  check("cadastrado por mim (uid) => não toca para mim", cadastradoPelaPropriaUsuaria(L("a", { cadastradoPorUid: "u1" }), eu) && !leadPendenteParaAlarme(L("a", { cadastradoPorUid: "u1" }), eu));
  check("cadastrado por mim (só o nome, lead antigo, caixa diferente) => não toca para mim", !leadPendenteParaAlarme(L("a", { cadastradoPor: " ana souza " }), eu));
  check("cadastrado por OUTRA pessoa com nome parecido não é confundido", leadPendenteParaAlarme(L("a", { cadastradoPor: "Ana Souza Lima", cadastradoPorUid: "u9" }), eu));
  check("lead inexistente => não é pendente", !leadPendenteParaAlarme(undefined, eu));
}

console.log("\n=== G. aplicarChegadas: cada chegada é processada uma única vez e só por quem pode ouvir");
{
  const eu = { uid: "u1", nome: "Ana" };
  const ch = [{ seq: 1, id: "a", lead: L("a") }, { seq: 2, id: "b", lead: L("b", { cadastradoPorUid: "u1" }) }, { seq: 3, id: "c", lead: L("c", { assumido: true }) }];
  let r = aplicarChegadas({ chegadas: ch, ultimoSeq: 0, idsAtuais: new Set(), perfilUsuario: eu, podeOuvir: true });
  check("entra no alarme só quem é pendente e não é meu (a); b é meu, c já assumido", [...r.ids].join() === "a" && r.ultimoSeq === 3);
  const r2 = aplicarChegadas({ chegadas: ch, ultimoSeq: r.ultimoSeq, idsAtuais: r.ids, perfilUsuario: eu, podeOuvir: true });
  check("reprocessar as mesmas chegadas (re-render) não muda nada: nenhum alerta repetido", [...r2.ids].join() === "a" && r2.ultimoSeq === 3);
  const r3 = aplicarChegadas({ chegadas: ch, ultimoSeq: 0, idsAtuais: new Set(), perfilUsuario: eu, podeOuvir: false });
  check("admin/coordenador (podeOuvir=false): nenhum id entra no alarme", r3.ids.size === 0 && r3.ultimoSeq === 3);
  const r4 = aplicarChegadas({ chegadas: ch, ultimoSeq: 0, idsAtuais: new Set(), perfilUsuario: eu, podeOuvir: true, dispensados: new Set(["a"]) });
  check("lead já aberto/fechado nesta sessão não volta ao alarme", r4.ids.size === 0);
}

console.log("\n=== H. podarAlarme: assumido / movido / removido sai do alarme (sincronizado entre usuárias)");
{
  const eu = { uid: "u1", nome: "Ana" };
  const alarme = new Set(["a", "b", "c", "d"]);
  const vivos = [L("a"), L("b", { assumido: true, responsavelUid: "u2" }), L("c", { etapa: 2 })];
  const p = podarAlarme({ ids: alarme, leads: vivos, perfilUsuario: eu });
  check("a continua; b (assumido por outra), c (mudou de etapa) e d (sumiu da lista) saem", [...p].join() === "a");
  const p2 = podarAlarme({ ids: p, leads: [L("a", { assumido: true })], perfilUsuario: eu });
  check("quando o último lead é assumido o alarme esvazia (som para)", p2.size === 0);
  const p3 = podarAlarme({ ids: new Set(["a"]), leads: [L("a")], perfilUsuario: eu });
  check("lead ainda pendente permanece", [...p3].join() === "a");
}

fim();
