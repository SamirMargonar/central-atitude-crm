// ==========================================================
// ASSINATURA RESILIENTE DO FIRESTORE (onSnapshot que não morre)
// ==========================================================
//
// PROBLEMA QUE RESOLVE
//
// Um `onSnapshot` termina para sempre quando recebe um erro (token
// vencido, falha de rede prolongada, "unavailable", etc.): o SDK
// NÃO reabre a escuta sozinho depois de chamar o callback de erro.
// Quem deixa o CRM aberto por horas ficava com a lista congelada
// (e sem o alerta sonoro) até apertar F5.
//
// O QUE FAZ
//
//  1. ERRO NA ESCUTA -> fecha a escuta morta e reabre depois de um
//     atraso crescente (2 s, 4 s, 8 s ... no máximo 60 s). O último
//     conjunto de dados recebido PERMANECE na tela durante a
//     reconexão (a lista não é apagada); `aoStatus` informa
//     "reconectando". Ao reabrir, o primeiro snapshot traz o estado
//     atual do servidor e tudo que chegou no intervalo aparece.
//
//  2. VOLTOU A INTERNET (`online`) ou A ABA FICOU VISÍVEL de novo
//     -> se existe uma reconexão agendada, ela é antecipada para
//     agora; se a escuta está "viva", roda uma verificação barata
//     (item 3). Nunca reabre às cegas uma escuta saudável (isso
//     releria a consulta inteira = custo de leitura).
//
//  3. VIGIA DE ESCUTA PARADA (stall silencioso): a cada
//     `intervaloVerificacaoMs` (padrão 60 s, só com a aba visível e
//     online) compara o total do servidor (`getCountFromServer`, uma
//     leitura de agregação ~ 1 leitura por 1000 documentos da
//     consulta) com o tamanho do último snapshot recebido. Se
//     divergirem, espera `confirmacaoMs` (uma mudança pode estar
//     simplesmente a caminho), conta de novo e SÓ ENTÃO reabre a
//     escuta. Depois de um reinício por divergência, só reinicia
//     de novo depois de `minimoEntreReiniciosMs` (trava contra
//     laço de leituras).
//
//  4. `parar()` encerra tudo (escuta, temporizadores, ouvintes de
//     janela). Nada continua rodando depois (sem vazamento). Os
//     callbacks de uma escuta antiga (de uma "geração" anterior)
//     são ignorados — um snapshot atrasado nunca sobrescreve dados
//     mais novos.
//
// NÃO escreve nada no Firestore e não altera regras de acesso: usa
// a MESMA consulta que o chamador já usaria.
//
// `fs`, `timers` e `ambiente` são injetáveis (testes usam falsos).
// ==========================================================

export const ATRASO_INICIAL_MS = 2000;
export const ATRASO_MAXIMO_MS = 60000;
export const INTERVALO_VERIFICACAO_MS = 60000;
export const CONFIRMACAO_MS = 5000;
export const MINIMO_ENTRE_REINICIOS_MS = 120000;

export const ESTADO = Object.freeze({
  CONECTANDO: "conectando",
  OK: "ok",
  RECONECTANDO: "reconectando",
  PARADA: "parada",
});

// Atraso de reconexão para a N-ésima falha seguida (N começa em 1).
export function atrasoDeReconexao(
  tentativa,
  {
    inicialMs = ATRASO_INICIAL_MS,
    maximoMs = ATRASO_MAXIMO_MS,
  } = {}
) {
  const n = Math.max(1, Number(tentativa) || 1);
  return Math.min(maximoMs, inicialMs * 2 ** (n - 1));
}

function ambientePadrao() {
  const temJanela = typeof window !== "undefined";
  const temDocumento = typeof document !== "undefined";
  return {
    visivel: () =>
      !temDocumento || document.visibilityState !== "hidden",
    online: () =>
      typeof navigator === "undefined" ||
      navigator.onLine !== false,
    aoVoltarOnline: (fn) => {
      if (!temJanela) return () => {};
      window.addEventListener("online", fn);
      return () => window.removeEventListener("online", fn);
    },
    aoFicarVisivel: (fn) => {
      if (!temDocumento) return () => {};
      const ouvinte = () => {
        if (document.visibilityState !== "hidden") fn();
      };
      document.addEventListener("visibilitychange", ouvinte);
      return () =>
        document.removeEventListener("visibilitychange", ouvinte);
    },
  };
}

export function criarAssinaturaResiliente({
  nome = "consulta",
  consulta,
  fs,
  aoSnapshot,
  aoStatus = () => {},
  intervaloVerificacaoMs = INTERVALO_VERIFICACAO_MS,
  confirmacaoMs = CONFIRMACAO_MS,
  minimoEntreReiniciosMs = MINIMO_ENTRE_REINICIOS_MS,
  atrasoInicialMs = ATRASO_INICIAL_MS,
  atrasoMaximoMs = ATRASO_MAXIMO_MS,
  agora = () => Date.now(),
  timers = {
    setTimeout: (...a) => globalThis.setTimeout(...a),
    clearTimeout: (...a) => globalThis.clearTimeout(...a),
  },
  ambiente = ambientePadrao(),
  log = console,
}) {
  let parado = false;
  let geracao = 0;
  let cancelarEscuta = null;
  let tentativas = 0;
  let estado = ESTADO.CONECTANDO;
  let temporizadorReconexao = null;
  let temporizadorVigia = null;
  let ultimo = null; // { tamanho, doCache } do último snapshot da geração atual
  let verificando = false;
  let ultimoReinicioPorDivergenciaEm = -Infinity;

  const desfazer = [];

  function mudarEstado(novo, extra = {}) {
    if (estado === novo && !extra.erro) return;
    estado = novo;
    try {
      aoStatus({ estado: novo, tentativas, ...extra });
    } catch (erro) {
      log.error?.(`[${nome}] aoStatus falhou:`, erro);
    }
  }

  function fecharEscuta() {
    const cancelar = cancelarEscuta;
    cancelarEscuta = null;
    ultimo = null;
    if (cancelar) {
      try {
        cancelar();
      } catch (erro) {
        log.warn?.(`[${nome}] erro ao encerrar escuta:`, erro);
      }
    }
  }

  function limparReconexao() {
    if (temporizadorReconexao !== null) {
      timers.clearTimeout(temporizadorReconexao);
      temporizadorReconexao = null;
    }
  }

  function assinar() {
    if (parado) return;
    limparReconexao();
    fecharEscuta();

    const minha = ++geracao;

    try {
      cancelarEscuta = fs.onSnapshot(
        consulta,
        (snapshot) => {
          if (parado || minha !== geracao) return;
          tentativas = 0;
          ultimo = {
            tamanho: snapshot.size ?? snapshot.docs?.length ?? 0,
            doCache: snapshot.metadata?.fromCache === true,
          };
          mudarEstado(ESTADO.OK);
          aoSnapshot(snapshot);
        },
        (erro) => {
          if (parado || minha !== geracao) return;
          fecharEscuta();
          agendarReconexao(erro);
        }
      );
    } catch (erro) {
      // onSnapshot lançou na criação (consulta inválida, SDK encerrado)
      cancelarEscuta = null;
      agendarReconexao(erro);
    }
  }

  function agendarReconexao(erro) {
    if (parado) return;
    tentativas += 1;
    const espera = atrasoDeReconexao(tentativas, {
      inicialMs: atrasoInicialMs,
      maximoMs: atrasoMaximoMs,
    });
    log.warn?.(
      `[${nome}] escuta encerrada (${erro?.code || erro?.message || erro}); nova tentativa em ${espera} ms (#${tentativas}).`
    );
    mudarEstado(ESTADO.RECONECTANDO, { erro });
    limparReconexao();
    temporizadorReconexao = timers.setTimeout(() => {
      temporizadorReconexao = null;
      assinar();
    }, espera);
  }

  function esperar(ms) {
    return new Promise((resolver) => {
      timers.setTimeout(resolver, ms);
    });
  }

  async function contarNoServidor() {
    const resultado = await fs.getCountFromServer(consulta);
    return resultado.data().count;
  }

  // Verificação barata: o total do servidor bate com o último snapshot?
  async function verificar() {
    if (
      parado ||
      verificando ||
      !cancelarEscuta ||
      !ultimo ||
      ultimo.doCache ||
      !ambiente.online()
    ) {
      return;
    }

    verificando = true;
    const minha = geracao;

    try {
      const primeiro = await contarNoServidor();
      if (parado || minha !== geracao || !ultimo) return;
      if (primeiro === ultimo.tamanho) return;

      // Pode ser só uma mudança a caminho: espera e confere de novo.
      await esperar(confirmacaoMs);
      if (parado || minha !== geracao || !ultimo) return;

      const segundo = await contarNoServidor();
      if (parado || minha !== geracao || !ultimo) return;
      if (segundo === ultimo.tamanho) return;

      if (agora() - ultimoReinicioPorDivergenciaEm < minimoEntreReiniciosMs) {
        return;
      }
      ultimoReinicioPorDivergenciaEm = agora();
      log.warn?.(
        `[${nome}] escuta divergente do servidor (local ${ultimo.tamanho} x servidor ${segundo}); reabrindo.`
      );
      assinar();
    } catch {
      // offline, permissão ou falha momentânea da contagem: a escuta
      // em si não é tocada; tenta de novo no próximo ciclo.
    } finally {
      verificando = false;
    }
  }

  function agendarVigia() {
    if (parado || !(intervaloVerificacaoMs > 0)) return;
    temporizadorVigia = timers.setTimeout(async () => {
      temporizadorVigia = null;
      if (ambiente.visivel() && ambiente.online()) {
        await verificar();
      }
      agendarVigia();
    }, intervaloVerificacaoMs);
  }

  function reagirAoRetorno() {
    if (parado) return;
    if (temporizadorReconexao !== null) {
      // há reconexão pendente: não espera o atraso restante
      assinar();
      return;
    }
    verificar();
  }

  desfazer.push(ambiente.aoVoltarOnline(reagirAoRetorno));
  desfazer.push(ambiente.aoFicarVisivel(reagirAoRetorno));

  assinar();
  agendarVigia();

  return {
    parar() {
      if (parado) return;
      parado = true;
      geracao += 1;
      limparReconexao();
      if (temporizadorVigia !== null) {
        timers.clearTimeout(temporizadorVigia);
        temporizadorVigia = null;
      }
      fecharEscuta();
      desfazer.splice(0).forEach((fn) => {
        try {
          fn();
        } catch {
          /* ouvinte já removido */
        }
      });
      estado = ESTADO.PARADA;
    },
    // Reabre agora (usado em testes e por chamadores que precisem).
    reiniciar: assinar,
    verificarAgora: verificar,
    estado: () => estado,
    tentativas: () => tentativas,
  };
}
