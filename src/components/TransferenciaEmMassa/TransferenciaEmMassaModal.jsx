import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as firestore from "firebase/firestore";

import { db } from "../../firebase/firebase";

import { useAuth } from "../../auth/AuthContext";

import { JORNADA } from "../../core/LeadFlow";

import { podeTransferirEmMassa } from "../../config/transferenciaEmMassa";

import {
  criarServicoTransferencia,
  MOTIVO_ANALISE,
  RESULTADO_LEAD,
  STATUS_OPERACAO,
  TIPO_OPERACAO,
} from "../../services/transferenciaEmMassa";

import "./transferenciaEmMassa.css";


// ==========================================================
// TRANSFERÊNCIA EM MASSA DE LEADS
//
// Tela administrativa. Só aparece para as duas identidades
// autorizadas (src/config/transferenciaEmMassa.js), mas QUEM
// PODE de verdade é decidido pelas Firestore Rules — esconder
// o botão não é segurança.
//
// A operação NÃO é atômica: cada lead é uma transação própria.
// Esta tela nunca declara sucesso enquanto houver pendências.
// ==========================================================

const ROTULO_ANALISE = {
  [MOTIVO_ANALISE.ETAPA_0_NAO_ASSUMIDO]:
    "Etapa 0 ainda não assumido (transferir geraria alerta de novo lead)",
  [MOTIVO_ANALISE.NOMES_DIVERGENTES]:
    "Nome do responsável diverge do cadastro",
  [MOTIVO_ANALISE.SEM_UID_COM_NOME]:
    "Sem responsável identificado, mas com o nome da origem",
  [MOTIVO_ANALISE.UID_DE_OUTRO_COM_NOME]:
    "Pertence a outro usuário, mas com o nome da origem",
};

const ROTULO_RESULTADO = {
  [RESULTADO_LEAD.FALHA]: "Falha",
  [RESULTADO_LEAD.PULADO_DONO_MUDOU]: "Responsável mudou depois da prévia",
  [RESULTADO_LEAD.PULADO_ANALISE]: "Fora do conjunto elegível",
  [RESULTADO_LEAD.PULADO_INEXISTENTE]: "Lead não existe mais",
  [RESULTADO_LEAD.PULADO_OUTRA_TRANSFERENCIA]:
    "Movido por outra operação depois desta (não revertido)",
  [RESULTADO_LEAD.PULADO_ETAPA_MUDOU]:
    "Avançou no funil depois da transferência (não revertido)",
  [RESULTADO_LEAD.PULADO_ALTERADO_APOS]:
    "Foi alterado depois da transferência (não revertido)",
  [RESULTADO_LEAD.PULADO_EVENTOS_APOS]:
    "Foi trabalhado depois da transferência — há eventos novos (não revertido)",
  NAO_PROCESSADO: "Não processado",
};

const ROTULO_STATUS = {
  [STATUS_OPERACAO.EM_ANDAMENTO]: "Em andamento / pendente",
  [STATUS_OPERACAO.CONCLUIDA]: "Concluída",
  [STATUS_OPERACAO.CONCLUIDA_COM_PENDENCIAS]: "Encerrada com pendências",
};


function nomeEtapa(etapa) {

  return (
    JORNADA.find((item) => item.id === Number(etapa))?.nome ||
    `Etapa ${etapa}`
  );

}


function formatarData(valor) {

  const data = valor?.toDate?.();

  return data
    ? data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

}


function rotuloUsuario(usuario) {

  return (
    `${usuario.nome}${usuario.ativo ? "" : " (inativa)"}` +
    `${usuario.email ? ` — ${usuario.email}` : ""}`
  );

}


export default function TransferenciaEmMassaModal({
  aberto,
  fechar,
  servico: servicoInjetado,
}) {

  const { usuario, perfilUsuario } = useAuth();

  const autorizado = podeTransferirEmMassa(
    usuario?.uid,
    perfilUsuario?.perfil
  );

  const servico = useMemo(
    () =>
      servicoInjetado ||
      criarServicoTransferencia({ db, fs: firestore }),
    [servicoInjetado]
  );

  const executor = useMemo(
    () => ({
      uid: usuario?.uid || "",
      nome: perfilUsuario?.nome || "",
    }),
    [usuario?.uid, perfilUsuario?.nome]
  );


  const [aba, setAba] = useState("nova");
  const [fase, setFase] = useState("config");
  const [erro, setErro] = useState("");

  const [origens, setOrigens] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [motivo, setMotivo] = useState("");

  const [previa, setPrevia] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [confirmou, setConfirmou] = useState(false);

  const [progresso, setProgresso] = useState({ concluidos: 0, total: 0 });
  const [resultado, setResultado] = useState(null);
  const [confirmandoEncerrar, setConfirmandoEncerrar] = useState(false);

  const [historico, setHistorico] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [confirmandoReversao, setConfirmandoReversao] = useState("");

  const [ocupado, setOcupado] = useState(false);
  const pararRef = useRef(false);


  // --------------------------------------------------------
  // CARREGAR USUÁRIOS AO ABRIR
  // --------------------------------------------------------

  useEffect(() => {

    if (!aberto || !autorizado) return;

    let cancelado = false;

    servico
      .carregarUsuarios()
      .then((lista) => {
        if (cancelado) return;
        setOrigens(lista.origens);
        setDestinos(lista.destinos);
      })
      .catch((e) => {
        if (!cancelado) setErro(`Não foi possível carregar os usuários: ${e.message}`);
      });

    return () => {
      cancelado = true;
    };

  }, [aberto, autorizado, servico]);


  async function carregarHistorico() {

    try {
      setHistorico(await servico.listarOperacoes({ limite: 30 }));
    } catch (e) {
      setErro(`Não foi possível carregar o histórico: ${e.message}`);
    }

  }


  useEffect(() => {

    if (aberto && autorizado && aba === "historico") {
      carregarHistorico();
    }

  }, [aberto, autorizado, aba]); // eslint-disable-line


  if (!aberto || !autorizado) {
    return null;
  }


  const origem = origens.find((u) => u.id === origemId);
  const destino = destinos.find((u) => u.id === destinoId);

  const destinosVisiveis = destinos.filter((u) => u.id !== origemId);


  function reiniciar() {

    setFase("config");
    setPrevia(null);
    setSelecionados(new Set());
    setConfirmou(false);
    setResultado(null);
    setRelatorio(null);
    setConfirmandoEncerrar(false);
    setConfirmandoReversao("");
    setProgresso({ concluidos: 0, total: 0 });
    setErro("");

  }


  function fecharTudo() {

    if (ocupado) return;

    reiniciar();
    setOrigemId("");
    setDestinoId("");
    setMotivo("");
    setAba("nova");
    fechar();

  }


  // --------------------------------------------------------
  // PRÉVIA
  // --------------------------------------------------------

  async function buscarLeads() {

    setErro("");

    if (!origem || !destino) {
      setErro("Escolha a consultora de origem e a de destino.");
      return;
    }

    if (origem.id === destino.id) {
      setErro("A origem e o destino precisam ser pessoas diferentes.");
      return;
    }

    if (!motivo.trim()) {
      setErro("Informe o motivo da transferência.");
      return;
    }

    setOcupado(true);

    try {

      const resultadoPrevia = await servico.montarPrevia({ origem, destino });

      setPrevia(resultadoPrevia);
      setSelecionados(new Set(resultadoPrevia.elegiveis.map((l) => l.id)));
      setConfirmou(false);
      setFase("previa");

    } catch (e) {

      setErro(`Não foi possível montar a prévia: ${e.message}`);

    } finally {

      setOcupado(false);

    }

  }


  function alternar(id) {

    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
    setConfirmou(false);

  }


  function alternarTodos(lista, marcar) {

    setSelecionados((atual) => {
      const novo = new Set(atual);
      lista.forEach((l) => (marcar ? novo.add(l.id) : novo.delete(l.id)));
      return novo;
    });
    setConfirmou(false);

  }


  // --------------------------------------------------------
  // EXECUÇÃO (nova, retomada ou reversão)
  // --------------------------------------------------------

  async function executar(opId) {

    pararRef.current = false;
    setFase("executando");
    setOcupado(true);
    setErro("");

    try {

      const r = await servico.executarOperacao({
        opId,
        executor,
        concorrencia: 5,
        aoProgredir: (p) =>
          setProgresso({ concluidos: p.concluidos, total: p.total }),
        deveParar: () => pararRef.current,
      });

      setResultado(r);
      setFase("relatorio");

    } catch (e) {

      setErro(`A execução foi interrompida: ${e.message}`);
      setFase("relatorio");
      setResultado({
        opId,
        estado: "erro",
        totalPrevisto: progresso.total,
        totalConcluido: progresso.concluidos,
        pendentes: [],
      });

    } finally {

      setOcupado(false);

    }

  }


  async function confirmarETransferir() {

    if (!confirmou || selecionados.size === 0) return;

    setOcupado(true);
    setErro("");

    try {

      const opId = await servico.iniciarOperacao({
        previa,
        leadIds: [...selecionados],
        motivo,
        executor,
      });

      setProgresso({ concluidos: 0, total: selecionados.size });

      await executar(opId);

    } catch (e) {

      setErro(`Não foi possível iniciar a operação: ${e.message}`);
      setOcupado(false);

    }

  }


  async function encerrarComPendencias() {

    setOcupado(true);

    try {

      await servico.encerrarComPendencias({
        opId: resultado.opId,
        executor,
        pendentes: resultado.pendentes,
      });

      setResultado({ ...resultado, estado: "encerrada_com_pendencias" });
      setConfirmandoEncerrar(false);

    } catch (e) {

      setErro(`Não foi possível encerrar: ${e.message}`);

    } finally {

      setOcupado(false);

    }

  }


  async function reverter(opIdOriginal) {

    setOcupado(true);
    setErro("");

    try {

      const opId = await servico.iniciarReversao({
        opIdOriginal,
        executor,
      });

      setConfirmandoReversao("");
      setAba("nova");
      setProgresso({ concluidos: 0, total: 0 });

      await executar(opId);

    } catch (e) {

      setErro(`Não foi possível reverter: ${e.message}`);
      setOcupado(false);

    }

  }


  async function verRelatorio(opId) {

    setOcupado(true);

    try {
      setRelatorio(await servico.carregarRelatorio(opId));
    } catch (e) {
      setErro(`Não foi possível carregar o relatório: ${e.message}`);
    } finally {
      setOcupado(false);
    }

  }


  // --------------------------------------------------------
  // RENDER — PARTES
  // --------------------------------------------------------

  function renderConfig() {

    return (
      <>
        <p className="tmeAjuda">
          Move toda a carteira elegível de uma consultora para outra.
          Cada lead é transferido de forma independente: a operação
          inteira <strong>não é atômica</strong> e pode terminar com
          pendências, que ficam registradas e podem ser retomadas.
        </p>

        <div className="tmeGrade">
          <label>
            Consultora de origem
            <select
              value={origemId}
              onChange={(e) => {
                setOrigemId(e.target.value);
                if (e.target.value === destinoId) setDestinoId("");
              }}
            >
              <option value="">Selecione...</option>
              {origens.map((u) => (
                <option key={u.id} value={u.id}>{rotuloUsuario(u)}</option>
              ))}
            </select>
          </label>

          <label>
            Consultora de destino (somente ativas)
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {destinosVisiveis.map((u) => (
                <option key={u.id} value={u.id}>{rotuloUsuario(u)}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="tmeCampo">
          Motivo da transferência
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: saída da consultora, redistribuição de carteira..."
          />
        </label>

        <div className="tmeBotoes">
          <button type="button" className="tmeSecundario" onClick={fecharTudo}>
            Fechar
          </button>
          <button
            type="button"
            className="tmePrimario"
            onClick={buscarLeads}
            disabled={ocupado}
          >
            {ocupado ? "Buscando..." : "Buscar leads"}
          </button>
        </div>
      </>
    );

  }


  function renderLista(titulo, lista, { marcavel }) {

    if (!lista.length) return null;

    const todosMarcados = lista.every((l) => selecionados.has(l.id));

    return (
      <section className="tmeBloco">
        <h4>
          {titulo} ({lista.length})
          {marcavel && (
            <button
              type="button"
              className="tmeLink"
              onClick={() => alternarTodos(lista, !todosMarcados)}
            >
              {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
            </button>
          )}
        </h4>
        <ul className="tmeLista">
          {lista.map((lead) => (
            <li key={lead.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selecionados.has(lead.id)}
                  onChange={() => alternar(lead.id)}
                />
                <span className="tmeNome">{lead.nome || "Sem nome"}</span>
                <span className="tmeMeta">
                  {nomeEtapa(lead.etapa)}
                  {lead.visitasResumo?.atualizar > 0 &&
                    ` · ${lead.visitasResumo.atualizar} visita(s) a atualizar`}
                  {lead.cadastroGerencial && " · cadastro gerencial"}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    );

  }


  function renderPrevia() {

    const total = selecionados.size;

    return (
      <>
        <div className="tmeResumo">
          <div><strong>{previa.elegiveis.length}</strong><span>elegíveis</span></div>
          <div><strong>{previa.gerenciais.length}</strong><span>gerenciais (opcionais)</span></div>
          <div><strong>{previa.analise.length}</strong><span>para análise</span></div>
          <div><strong>{previa.visitas.atualizar}</strong><span>visitas a atualizar</span></div>
          <div><strong>{previa.visitas.realizadas}</strong><span>visitas realizadas (mantidas)</span></div>
          <div><strong>{previa.visitas.analise}</strong><span>visitas em análise</span></div>
        </div>

        <p className="tmeAjuda">
          De <strong>{previa.origem.nome}</strong>
          {!previa.origem.ativo && " (inativa)"} para{" "}
          <strong>{previa.destino.nome}</strong>. Data de referência
          das visitas: {previa.hoje}.
        </p>

        {Object.keys(previa.resumoPorEtapa).length > 0 && (
          <table className="tmeTabela">
            <thead>
              <tr><th>Etapa do funil</th><th>Leads elegíveis</th></tr>
            </thead>
            <tbody>
              {Object.entries(previa.resumoPorEtapa).map(([etapa, qtd]) => (
                <tr key={etapa}>
                  <td>{nomeEtapa(etapa)}</td>
                  <td>{qtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {renderLista("Leads elegíveis", previa.elegiveis, { marcavel: true })}

        {renderLista(
          "Leads de cadastro gerencial (só entram se você marcar)",
          previa.gerenciais,
          { marcavel: true }
        )}

        {previa.analise.length > 0 && (
          <section className="tmeBloco tmeAnalise">
            <h4>Para análise — NÃO serão transferidos ({previa.analise.length})</h4>
            <ul className="tmeLista">
              {previa.analise.map(({ lead, motivo: m }) => (
                <li key={lead.id}>
                  <span className="tmeNome">{lead.nome || "Sem nome"}</span>
                  <span className="tmeMeta">
                    {nomeEtapa(lead.etapa)} · {ROTULO_ANALISE[m] || m}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {previa.elegiveis.length === 0 && previa.gerenciais.length === 0 && (
          <p className="tmeAviso">
            Nenhum lead elegível para transferir desta consultora.
          </p>
        )}

        <label className="tmeConfirmacao">
          <input
            type="checkbox"
            checked={confirmou}
            onChange={(e) => setConfirmou(e.target.checked)}
            disabled={total === 0}
          />
          Confirmo transferir <strong>{total}</strong> lead(s) de{" "}
          <strong>{previa.origem.nome}</strong> para{" "}
          <strong>{previa.destino.nome}</strong>. Entendo que a operação
          não é atômica e pode terminar com pendências.
        </label>

        <div className="tmeBotoes">
          <button
            type="button"
            className="tmeSecundario"
            onClick={reiniciar}
            disabled={ocupado}
          >
            Voltar
          </button>
          <button
            type="button"
            className="tmePerigo"
            onClick={confirmarETransferir}
            disabled={!confirmou || total === 0 || ocupado}
          >
            {ocupado ? "Iniciando..." : `Confirmar e transferir ${total} lead(s)`}
          </button>
        </div>
      </>
    );

  }


  function renderExecutando() {

    const pct = progresso.total
      ? Math.round((progresso.concluidos / progresso.total) * 100)
      : 0;

    return (
      <>
        <p className="tmeAjuda">
          Transferindo... <strong>{progresso.concluidos}</strong> de{" "}
          <strong>{progresso.total}</strong> lead(s). Não feche esta janela.
        </p>
        <div className="tmeBarra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="tmeBotoes">
          <button
            type="button"
            className="tmeSecundario"
            onClick={() => {
              pararRef.current = true;
            }}
          >
            Parar após os leads em andamento
          </button>
        </div>
      </>
    );

  }


  function renderVisitasParaAnalise(lista) {

    if (!lista?.length) return null;

    return (
      <section className="tmeBloco tmeAnalise">
        <h4>Visitas para análise manual ({lista.length})</h4>
        <p className="tmeAjuda">
          Visitas criadas depois da transferência continuam com a
          consultora que recebeu o lead. Nada foi alterado nelas.
        </p>
        <ul className="tmeLista">
          {lista.map((v) => (
            <li key={`${v.leadId}-${v.id}`}>
              <span className="tmeNome">Lead {v.leadId} · visita {v.id}</span>
              <span className="tmeMeta">
                {v.data || "sem data"} {v.hora || ""} · {v.status || "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );

  }


  function renderRelatorioFinal() {

    const r = resultado;
    const concluida = r.estado === "concluida";
    const encerrada = r.estado === "encerrada_com_pendencias";
    const pendentes = r.pendentes || [];

    return (
      <>
        {concluida && (
          <div className="tmeBanner tmeOk">
            Operação concluída: {r.totalConcluido} de {r.totalPrevisto} lead(s)
            transferidos, sem pendências.
          </div>
        )}

        {!concluida && !encerrada && (
          <div className="tmeBanner tmeAlerta">
            Operação NÃO concluída: {r.totalConcluido} de {r.totalPrevisto}{" "}
            lead(s) transferidos; {pendentes.length} pendente(s).
            {r.estado === "interrompida" && " Você interrompeu a execução."}
            {r.estado === "erro" && " A execução parou por um erro."}
          </div>
        )}

        {encerrada && (
          <div className="tmeBanner tmeAlerta">
            Operação encerrada COM PENDÊNCIAS: {r.totalConcluido} de{" "}
            {r.totalPrevisto} lead(s) transferidos; {pendentes.length} não
            foram transferidos (registrados na auditoria).
          </div>
        )}

        {r.visitasTardias?.length > 0 && (
          <p className="tmeAjuda">
            {r.visitasTardias.length} visita(s) criada(s) durante a operação
            foram atualizadas na varredura final.
          </p>
        )}

        {renderVisitasParaAnalise(r.visitasParaAnalise)}

        {pendentes.length > 0 && (
          <section className="tmeBloco tmeAnalise">
            <h4>Pendências ({pendentes.length})</h4>
            <ul className="tmeLista">
              {pendentes.map((p) => (
                <li key={p.leadId}>
                  <span className="tmeNome">{p.leadId}</span>
                  <span className="tmeMeta">
                    {ROTULO_RESULTADO[p.resultado] || p.resultado}
                    {p.detalhe ? ` · ${p.detalhe}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {confirmandoEncerrar && (
          <div className="tmeBanner tmeAlerta">
            Encerrar deixa {pendentes.length} lead(s) sem transferir e a
            operação não poderá mais ser retomada. Confirmar?
            <div className="tmeBotoes">
              <button type="button" className="tmeSecundario" onClick={() => setConfirmandoEncerrar(false)}>
                Cancelar
              </button>
              <button type="button" className="tmePerigo" onClick={encerrarComPendencias} disabled={ocupado}>
                Encerrar com pendências
              </button>
            </div>
          </div>
        )}

        <div className="tmeBotoes">
          {!concluida && !encerrada && r.estado !== "erro" && (
            <>
              <button
                type="button"
                className="tmePrimario"
                onClick={() => executar(r.opId)}
                disabled={ocupado}
              >
                {r.estado === "interrompida" ? "Retomar" : "Tentar novamente as pendências"}
              </button>
              <button
                type="button"
                className="tmeSecundario"
                onClick={() => setConfirmandoEncerrar(true)}
                disabled={ocupado}
              >
                Encerrar com pendências
              </button>
            </>
          )}
          <button type="button" className="tmeSecundario" onClick={reiniciar}>
            Nova transferência
          </button>
        </div>
      </>
    );

  }


  function renderHistorico() {

    return (
      <>
        {relatorio && (
          <section className="tmeBloco">
            <h4>
              Relatório da operação
              <button type="button" className="tmeLink" onClick={() => setRelatorio(null)}>
                Fechar relatório
              </button>
            </h4>
            <p className="tmeAjuda">
              {relatorio.operacao.origemNome} → {relatorio.operacao.destinoNome}{" "}
              · {ROTULO_STATUS[relatorio.operacao.status]} ·{" "}
              {relatorio.itens.length} de {relatorio.operacao.totalPrevisto}{" "}
              lead(s) transferidos · {relatorio.pendentes.length} pendente(s)
            </p>
            {relatorio.divergencia && (
              <div className="tmeBanner tmeAlerta" role="alert">
                Divergência: a operação declara {relatorio.divergencia.declarado}{" "}
                lead(s) concluído(s) (previsto: {relatorio.divergencia.previsto}),
                mas há {relatorio.divergencia.gravado} item(ns) de auditoria
                gravado(s). Vale a contagem dos itens.
              </div>
            )}
            {renderVisitasParaAnalise(relatorio.visitasParaAnalise)}
            <ul className="tmeLista">
              {relatorio.itens.map((item) => (
                <li key={item.id}>
                  <span className="tmeNome">{item.id}</span>
                  <span className="tmeMeta">
                    {item.visitasAtualizadas?.length || 0} visita(s) atualizada(s)
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {historico.length === 0 && (
          <p className="tmeAjuda">Nenhuma operação registrada.</p>
        )}

        <ul className="tmeLista tmeHistorico">
          {historico.map((op) => {

            const finalizada = op.status !== STATUS_OPERACAO.EM_ANDAMENTO;

            // Só pode existir UMA reversão por operação (as Rules
            // também recusam a segunda). Aqui só deixamos de oferecer.
            const reversao = historico.find(
              (outra) =>
                outra.tipo === TIPO_OPERACAO.REVERSAO &&
                outra.reverteOpId === op.id
            );

            const podeReverter =
              finalizada &&
              op.tipo === TIPO_OPERACAO.TRANSFERENCIA &&
              (op.totalConcluido ?? 0) > 0 &&
              !reversao;

            return (
              <li key={op.id}>
                <div>
                  <span className="tmeNome">
                    {op.tipo === TIPO_OPERACAO.REVERSAO ? "↩ Reversão" : "→ Transferência"}:{" "}
                    {op.origemNome} → {op.destinoNome}
                  </span>
                  <span className="tmeMeta">
                    {formatarData(op.criadoEm)} · por {op.executadoPorNome || op.executadoPorUid}{" "}
                    · {ROTULO_STATUS[op.status]} · {op.totalConcluido ?? "?"}/{op.totalPrevisto}
                  </span>
                </div>

                <div className="tmeAcoesLinha">
                  <button type="button" className="tmeLink" onClick={() => verRelatorio(op.id)}>
                    Relatório
                  </button>

                  {!finalizada && (
                    <button
                      type="button"
                      className="tmeLink"
                      onClick={() => {
                        setAba("nova");
                        setProgresso({ concluidos: 0, total: op.totalPrevisto });
                        executar(op.id);
                      }}
                      disabled={ocupado}
                    >
                      Retomar
                    </button>
                  )}

                  {reversao && (
                    <span className="tmeMeta">
                      {reversao.status === STATUS_OPERACAO.EM_ANDAMENTO
                        ? "Reversão em andamento (retome na linha da reversão)"
                        : reversao.status === STATUS_OPERACAO.CONCLUIDA
                          ? "Revertida"
                          : "Revertida com pendências"}
                    </span>
                  )}

                  {podeReverter && confirmandoReversao !== op.id && (
                    <button type="button" className="tmeLink" onClick={() => setConfirmandoReversao(op.id)}>
                      Reverter
                    </button>
                  )}

                  {confirmandoReversao === op.id && (
                    <span className="tmeConfirmaInline">
                      Devolver os leads para {op.origemNome}?
                      <button type="button" className="tmeLink" onClick={() => reverter(op.id)} disabled={ocupado}>
                        Confirmar reversão
                      </button>
                      <button type="button" className="tmeLink" onClick={() => setConfirmandoReversao("")}>
                        Cancelar
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );

          })}
        </ul>

        <div className="tmeBotoes">
          <button type="button" className="tmeSecundario" onClick={carregarHistorico} disabled={ocupado}>
            Atualizar
          </button>
        </div>
      </>
    );

  }


  return (

    <div className="tmeOverlay">

      <div className="tmeModal" role="dialog" aria-label="Transferência em massa de leads">

        <div className="tmeCabecalho">
          <h2>🔄 Transferência em Massa de Leads</h2>
          <button type="button" className="tmeFechar" onClick={fecharTudo} aria-label="Fechar" disabled={ocupado}>
            ✕
          </button>
        </div>

        <div className="tmeAbas">
          <button
            type="button"
            className={aba === "nova" ? "tmeAbaAtiva" : ""}
            onClick={() => setAba("nova")}
            disabled={ocupado}
          >
            Nova operação
          </button>
          <button
            type="button"
            className={aba === "historico" ? "tmeAbaAtiva" : ""}
            onClick={() => setAba("historico")}
            disabled={ocupado}
          >
            Histórico e reversão
          </button>
        </div>

        {erro && <div className="tmeBanner tmeErro" role="alert">{erro}</div>}

        <div className="tmeCorpo">
          {aba === "historico" && renderHistorico()}
          {aba === "nova" && fase === "config" && renderConfig()}
          {aba === "nova" && fase === "previa" && previa && renderPrevia()}
          {aba === "nova" && fase === "executando" && renderExecutando()}
          {aba === "nova" && fase === "relatorio" && resultado && renderRelatorioFinal()}
        </div>

      </div>

    </div>

  );

}
