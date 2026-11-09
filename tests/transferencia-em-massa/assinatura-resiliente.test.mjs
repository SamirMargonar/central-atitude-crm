// ASSINATURA RESILIENTE (onSnapshot que reabre sozinho + vigia de escuta parada) — lógica pura.
// Relógio e Firestore FALSOS: nenhuma rede, nenhum Firebase, sem esperas reais.
import { REPO, criarRelatorio } from "./helpers.mjs";

const { check, fim } = criarRelatorio();
const { criarAssinaturaResiliente, atrasoDeReconexao, ESTADO } = await import(`${REPO}/src/hooks/assinaturaResiliente.js`);

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function criarRelogio() {
  let t = 0, id = 0; const fila = new Map();
  return {
    setTimeout: (fn, ms) => { const i = ++id; fila.set(i, { em: t + ms, fn }); return i; },
    clearTimeout: (i) => { fila.delete(i); },
    agora: () => t,
    pendentes: () => fila.size,
    async avancar(ms) {
      const alvo = t + ms;
      for (;;) {
        const prox = [...fila.entries()].filter(([, v]) => v.em <= alvo).sort((a, b) => a[1].em - b[1].em)[0];
        if (!prox) break;
        fila.delete(prox[0]); t = prox[1].em;
        prox[1].fn();           // sem await: o callback do vigia espera outro temporizador
        await flush();
      }
      t = alvo; await flush();
    },
  };
}

function criarCenario({ contagem = () => 0, onSnapshotLanca = false, ...opcoes } = {}) {
  const relogio = criarRelogio();
  const escutas = [];
  let contagens = 0, falhaContagem = false;
  const amb = { v: true, o: true, h: {} };
  const ambiente = {
    visivel: () => amb.v, online: () => amb.o,
    aoVoltarOnline: (fn) => { amb.h.online = fn; return () => { amb.h.online = null; }; },
    aoFicarVisivel: (fn) => { amb.h.visivel = fn; return () => { amb.h.visivel = null; }; },
  };
  const fs = {
    onSnapshot: (_c, ok, erro) => {
      if (onSnapshotLanca) throw new Error("consulta inválida");
      const e = { ok, erro, aberta: true }; escutas.push(e); return () => { e.aberta = false; };
    },
    getCountFromServer: async () => { contagens += 1; if (falhaContagem) throw new Error("offline"); return { data: () => ({ count: contagem() }) }; },
  };
  const recebidos = [], status = [];
  const a = criarAssinaturaResiliente({
    nome: "t", consulta: { q: 1 }, fs, ambiente, timers: relogio, agora: relogio.agora,
    log: { warn() {}, error() {} },
    aoSnapshot: (s) => recebidos.push(s), aoStatus: (s) => status.push(s.estado),
    ...opcoes,
  });
  const snap = (n, extra = {}) => ({ size: n, docs: Array.from({ length: n }, (_, i) => ({ id: "d" + i })), metadata: { fromCache: false }, ...extra });
  return {
    a, relogio, escutas, recebidos, status, amb, snap,
    abertas: () => escutas.filter((e) => e.aberta).length,
    ultima: () => escutas[escutas.length - 1],
    contagens: () => contagens, falharContagem: (v) => { falhaContagem = v; },
  };
}

console.log("\n=== A. Escuta encerrada por erro: reabre sozinha, com atraso crescente, sem apagar o que já está na tela");
{
  check("atrasos: 2 s, 4 s, 8 s ... limitado a 60 s", [1, 2, 3, 4, 5, 6, 7, 20].map((n) => atrasoDeReconexao(n)).join() === "2000,4000,8000,16000,32000,60000,60000,60000");
  const c = criarCenario();
  check("abre UMA escuta ao iniciar, estado conectando", c.escutas.length === 1 && c.a.estado() === ESTADO.CONECTANDO);
  c.ultima().ok(c.snap(3));
  check("primeiro snapshot: estado ok e dados entregues", c.a.estado() === ESTADO.OK && c.recebidos.length === 1 && c.recebidos[0].size === 3);
  c.ultima().erro({ code: "unavailable" });
  check("erro: a escuta morta é fechada, estado reconectando, NENHUM dado vazio é entregue (a lista não é apagada)", c.abertas() === 0 && c.a.estado() === ESTADO.RECONECTANDO && c.recebidos.length === 1);
  await c.relogio.avancar(1999);
  check("antes de 2 s ainda não reabriu", c.escutas.length === 1);
  await c.relogio.avancar(1);
  check("aos 2 s reabre (nova escuta; só uma aberta)", c.escutas.length === 2 && c.abertas() === 1);
  c.ultima().erro({ code: "unavailable" });
  await c.relogio.avancar(3999); const antes = c.escutas.length; await c.relogio.avancar(1);
  check("segunda falha seguida: atraso de 4 s", antes === 2 && c.escutas.length === 3);
  c.ultima().ok(c.snap(5));
  check("snapshot após reabrir: dados novos entregues e estado volta a ok", c.recebidos.length === 2 && c.recebidos[1].size === 5 && c.a.estado() === ESTADO.OK && c.a.tentativas() === 0);
  c.ultima().erro({ code: "unavailable" });
  await c.relogio.avancar(2000);
  check("depois de recuperar, o atraso recomeça em 2 s (não continua crescendo)", c.escutas.length === 4);
  check("transições de estado informadas (sem repetições consecutivas): ok -> reconectando -> ok -> reconectando", c.status.filter((x, i, v) => x !== v[i - 1]).join() === "ok,reconectando,ok,reconectando");
  c.a.parar();
}

console.log("\n=== B. Callbacks de escuta antiga são ignorados (um snapshot atrasado nunca sobrescreve dados novos)");
{
  const c = criarCenario();
  const velha = c.ultima();
  velha.ok(c.snap(2));
  velha.erro({ code: "unavailable" });
  await c.relogio.avancar(2000);
  const nova = c.ultima(); nova.ok(c.snap(4));
  const total = c.recebidos.length;
  velha.ok(c.snap(1)); velha.erro({ code: "x" });
  check("snapshot/erro vindos da escuta antiga não entregam nada nem agendam reconexão", c.recebidos.length === total && c.relogio.pendentes() === 1 /* só o vigia */ && c.abertas() === 1);
  c.a.parar();
}

console.log("\n=== C. Internet voltou / aba visível: antecipa a reconexão pendente; escuta saudável NÃO é reaberta às cegas");
{
  const c = criarCenario({ contagem: () => 3 });
  c.ultima().ok(c.snap(3));
  c.ultima().erro({ code: "unavailable" });
  check("reconexão pendente", c.escutas.length === 1);
  c.amb.h.online();
  check("evento online: reabre na hora, sem esperar o atraso", c.escutas.length === 2 && c.abertas() === 1);
  c.ultima().ok(c.snap(3));
  c.amb.h.online(); await flush();
  check("evento online com a escuta saudável: NÃO reabre (só confere a contagem, 1 leitura)", c.escutas.length === 2 && c.contagens() === 1);
  c.amb.h.visivel(); await flush();
  check("aba visível com a escuta saudável e contagem igual: continua a mesma escuta", c.escutas.length === 2 && c.abertas() === 1);
  c.a.parar();
  const c2 = criarCenario();
  c2.ultima().erro({ code: "unavailable" });
  c2.amb.h.visivel();
  check("aba visível com reconexão pendente: reabre na hora", c2.escutas.length === 2);
  c2.a.parar();
}

console.log("\n=== D. Vigia: detecta escuta parada em silêncio comparando com a contagem do servidor");
{
  let servidor = 3;
  const c = criarCenario({ contagem: () => servidor });
  c.ultima().ok(c.snap(3));
  await c.relogio.avancar(60000);
  check("a cada 60 s: 1 leitura de contagem; iguais => nada acontece", c.contagens() === 1 && c.escutas.length === 1);
  await c.relogio.avancar(60000 * 4);
  check("custo: exatamente 1 contagem por minuto (5 min = 5 leituras de agregação)", c.contagens() === 5);

  servidor = 4; // chegou um lead que a escuta (parada) não entregou
  await c.relogio.avancar(60000);
  check("divergência detectada: confirma após 5 s antes de agir", c.contagens() === 6 && c.escutas.length === 1);
  await c.relogio.avancar(5000);
  check("segunda contagem ainda diverge: reabre a escuta (a antiga é fechada)", c.contagens() === 7 && c.escutas.length === 2 && c.abertas() === 1);
  c.ultima().ok(c.snap(4));
  check("o snapshot da escuta nova traz o lead que faltava", c.recebidos.at(-1).size === 4);
  c.a.parar();
}

console.log("\n=== E. Vigia: sem falso alarme e com trava contra laço de leituras");
{
  let servidor = 3;
  const c = criarCenario({ contagem: () => servidor });
  c.ultima().ok(c.snap(3));
  servidor = 4;
  await c.relogio.avancar(60000);        // 1ª contagem diverge
  servidor = 3;                           // era só uma mudança em trânsito / desfeita
  await c.relogio.avancar(5000);
  check("divergência que some na confirmação NÃO reabre a escuta", c.escutas.length === 1);
  c.a.parar();

  servidor = 10;
  const t = criarCenario({ contagem: () => servidor });
  t.ultima().ok(t.snap(3));
  await t.relogio.avancar(60000 + 5000);
  check("1º reinício por divergência", t.escutas.length === 2);
  t.ultima().ok(t.snap(3)); // continua divergente (cenário patológico)
  await t.relogio.avancar(60000 + 5000);
  check("trava: divergência persistente NÃO reabre de novo dentro de 2 min (sem laço de leituras)", t.escutas.length === 2);
  await t.relogio.avancar(60000 + 5000);
  check("passada a trava, pode tentar de novo", t.escutas.length === 3);
  t.a.parar();

  const o = criarCenario({ contagem: () => 99 });
  o.ultima().ok(o.snap(3));
  o.amb.v = false; await o.relogio.avancar(180000);
  check("aba oculta: o vigia não consulta (zero leituras)", o.contagens() === 0 && o.escutas.length === 1);
  o.amb.v = true; o.amb.o = false; await o.relogio.avancar(180000);
  check("sem internet: o vigia não consulta", o.contagens() === 0);
  o.a.parar();

  const f = criarCenario({ contagem: () => 99 });
  f.ultima().ok(f.snap(3)); f.falharContagem(true);
  await f.relogio.avancar(180000);
  check("contagem falhando (offline/permissão): a escuta NÃO é tocada e o vigia segue tentando", f.escutas.length === 1 && f.contagens() === 3);
  f.a.parar();

  const k = criarCenario({ contagem: () => 99 });
  k.ultima().ok(k.snap(3, { metadata: { fromCache: true } }));
  await k.relogio.avancar(180000);
  check("snapshot vindo do cache (offline): não compara com o servidor", k.contagens() === 0);
  k.a.parar();

  const s = criarCenario({ contagem: () => 0 });
  await s.relogio.avancar(180000);
  check("antes do 1º snapshot não há o que comparar (zero leituras)", s.contagens() === 0);
  s.a.parar();
}

console.log("\n=== F. Falha ao criar a escuta e encerramento limpo");
{
  const c = criarCenario({ onSnapshotLanca: true });
  check("onSnapshot que lança na criação vira reconexão agendada (não derruba o app)", c.a.estado() === ESTADO.RECONECTANDO && c.relogio.pendentes() === 2);
  c.a.parar();

  const d = criarCenario({ contagem: () => 3 });
  d.ultima().ok(d.snap(3));
  d.ultima().erro({ code: "unavailable" });
  d.a.parar();
  check("parar(): escuta fechada, ZERO temporizadores pendentes, ouvintes de janela removidos", d.abertas() === 0 && d.relogio.pendentes() === 0 && !d.amb.h.online && !d.amb.h.visivel && d.a.estado() === ESTADO.PARADA);
  const n = d.recebidos.length;
  d.ultima().ok(d.snap(9)); await d.relogio.avancar(600000);
  check("depois de parar nada volta a acontecer (sem snapshots, sem reabrir, sem contagem)", d.recebidos.length === n && d.escutas.length === 1 && d.contagens() === 0);
  d.a.parar();
  check("parar() duas vezes é inofensivo", true);

  const e = criarCenario({ contagem: () => 7 });
  e.ultima().ok(e.snap(3));
  const emVoo = (async () => { await e.relogio.avancar(60000); })();
  await emVoo; e.a.parar(); await e.relogio.avancar(60000);
  check("parar() no meio da confirmação (divergência em andamento) não reabre nada depois", e.escutas.length === 1 && e.abertas() === 0);
}

fim();
