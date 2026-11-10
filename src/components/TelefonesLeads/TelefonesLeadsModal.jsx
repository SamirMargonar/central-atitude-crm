import {
  useMemo,
  useState,
} from "react";

import * as firestore from "firebase/firestore";

import {
  db,
} from "../../firebase/firebase";

import {
  useAuth,
} from "../../auth/AuthContext";

import {
  criarServicoTelefones,
} from "../../services/telefonesLeads";

import "../../styles/leadModal.css";


// ==========================================================
// TELEFONES DOS LEADS — INDEXAÇÃO DOS LEADS ANTIGOS
//
// Tela administrativa (admin/coordenador). A regra "não pode existir
// dois leads com o mesmo telefone" é imposta pelas Firestore Rules
// usando o índice telefonesLeads. Leads criados ANTES dela não têm
// índice; aqui o gestor:
//
//   1. ANALISA: lê os leads e o índice (somente leitura);
//   2. INDEXA: cria o índice de cada telefone livre (um titular por
//      número) — nenhum lead é alterado, apagado ou mesclado;
//   3. VÊ os telefones repetidos entre leads antigos (titular = o
//      mais antigo) para resolver manualmente, editando o telefone
//      de um deles pela tela do lead. Número compartilhado (família,
//      casal) também é repetição: um telefone só pode ser de um lead;
//   4. VÊ os "Telefones fora do padrão" (sem DDD, curtos, com dígito
//      a mais, vazios...), cada um com o motivo, para corrigir
//      manualmente. Eles não podem ser indexados e NENHUM é alterado
//      sozinho.
//
// Quem pode de verdade é decidido pelas Rules; esconder o botão não
// é segurança.
// ==========================================================

export default function TelefonesLeadsModal({
  aberto,
  fechar,
}) {

  const {
    usuario,
    perfilUsuario,
  } = useAuth();

  const servico = useMemo(
    () =>
      criarServicoTelefones({
        db,
        fs: firestore,
      }),
    []
  );

  const [analise, setAnalise] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [progresso, setProgresso] = useState(null);

  const perfil = perfilUsuario?.perfil;

  if (!aberto) {
    return null;
  }

  if (perfil !== "admin" && perfil !== "coordenador") {
    return null;
  }

  async function analisar() {

    try {
      setOcupado(true);
      setMensagem("");
      setAnalise(await servico.analisar());
    } catch (erro) {
      console.error("Erro ao analisar telefones:", erro);
      setMensagem("Não foi possível analisar os telefones dos leads.");
    } finally {
      setOcupado(false);
    }

  }

  async function indexar() {

    if (!analise || analise.pendentes.length === 0) {
      return;
    }

    try {

      setOcupado(true);
      setMensagem("");

      const resultado = await servico.indexar(analise, {
        uid: usuario?.uid || "",
        aoProgresso: setProgresso,
      });

      setMensagem(
        resultado.falhas.length === 0
          ? `Pronto: ${resultado.criados} telefone(s) indexado(s).`
          : `${resultado.criados} indexado(s); ${resultado.falhas.length} não puderam ser indexados (outro lead já usa o número ou falta permissão).`
      );

      setAnalise(await servico.analisar());

    } catch (erro) {
      console.error("Erro ao indexar telefones:", erro);
      setMensagem("Não foi possível concluir a indexação.");
    } finally {
      setOcupado(false);
      setProgresso(null);
    }

  }

  return (

    <div className="modalOverlay">

      <div className="leadModal" style={{ maxWidth: "720px" }}>

        <div className="leadModalHeader">

          <div>
            <h2>📞 Telefones dos Leads</h2>
            <p>
              Garante que nenhum telefone seja usado por dois leads.
              Nenhum lead é alterado, apagado ou mesclado aqui.
            </p>
          </div>

          <button type="button" onClick={fechar} disabled={ocupado}>
            ✕
          </button>

        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>

            <button type="button" onClick={analisar} disabled={ocupado}>
              {ocupado && !progresso ? "Analisando..." : "Analisar leads"}
            </button>

            <button
              type="button"
              onClick={indexar}
              disabled={ocupado || !analise || analise.pendentes.length === 0}
            >
              {progresso
                ? `Indexando... ${progresso.criados}`
                : `Indexar telefones (${analise?.pendentes.length ?? 0})`}
            </button>

          </div>

          {mensagem && (
            <div role="status" style={{ fontWeight: 600 }}>{mensagem}</div>
          )}

          {analise && (

            <>

              <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.6 }}>
                <li>Leads: <b>{analise.totalLeads}</b></li>
                <li>Telefones já protegidos: <b>{analise.jaIndexados}</b></li>
                <li>Telefones livres a indexar: <b>{analise.pendentes.length}</b></li>
                <li>Telefones repetidos entre leads antigos: <b>{analise.grupos.length}</b></li>
                <li>Telefones fora do padrão: <b>{analise.foraDoPadrao.length}</b></li>
              </ul>

              {analise.grupos.length > 0 && (

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

                  <strong>
                    Telefones repetidos — mesmo número em mais de um lead (um telefone só pode
                    pertencer a um lead; resolva editando o telefone de um deles):
                  </strong>

                  {analise.grupos.map((grupo) => (

                    <div
                      key={grupo.chave}
                      style={{
                        border: "1px solid #fde68a",
                        background: "#fffbeb",
                        color: "#92400e",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        fontSize: "13px",
                      }}
                    >

                      {grupo.leads.map((lead) => (

                        <div key={lead.id}>
                          {lead.titular ? "★ " : "• "}
                          {lead.nome || "Sem nome"}
                          {" — "}
                          {lead.telefone}
                          {" — "}
                          {lead.responsavel || "Sem responsável"}
                          {lead.titular ? " (titular do número)" : ""}
                        </div>

                      ))}

                    </div>

                  ))}

                </div>

              )}

              {/* ==============================================
                  TELEFONES FORA DO PADRÃO
                  Nenhum é indexado e nenhum é alterado sozinho.
              ============================================== */}

              <div
                style={{ display: "flex", flexDirection: "column", gap: "10px" }}
                data-secao="fora-do-padrao"
              >

                <strong>
                  Telefones fora do padrão ({analise.foraDoPadrao.length})
                </strong>

                {analise.foraDoPadrao.length === 0 ? (

                  <span>Nenhum lead com telefone fora do padrão.</span>

                ) : (

                  <>

                    <span style={{ fontSize: "13px" }}>
                      Esses leads não têm telefone brasileiro válido com DDD (10 ou 11 dígitos),
                      então não podem ser protegidos contra duplicidade. Nada foi alterado:
                      corrija o telefone pela tela do lead (Editar).
                    </span>

                    {analise.foraDoPadrao.map((item) => (

                      <div
                        key={item.id}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#991b1b",
                          borderRadius: "10px",
                          padding: "10px 12px",
                          fontSize: "13px",
                        }}
                      >
                        {item.nome || "Sem nome"}
                        {" — "}
                        {item.telefone || "(vazio)"}
                        {" — "}
                        {item.responsavel || "Sem responsável"}
                        {" — "}
                        <b>{item.motivoTexto}</b>
                        {item.repetidoEmOutroLead
                          ? " — mesmo número digitado em outro lead"
                          : ""}
                      </div>

                    ))}

                  </>

                )}

              </div>

            </>

          )}

        </div>

      </div>

    </div>

  );

}
