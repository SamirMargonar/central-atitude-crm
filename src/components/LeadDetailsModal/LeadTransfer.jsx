import {
  useEffect,
  useState,
} from "react";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  atualizarLead,
  registrarEvento,
} from "../../core/EventEngine";

import {
  db,
} from "../../firebase/firebase";

import {
  useAuth,
} from "../../auth/AuthContext";

import "./LeadDetailsModal.css";


export default function LeadTransfer({
  lead,
}) {

  const { usuario, perfilUsuario, permissoes } =
    useAuth();


  // ==========================================================
  // RESPONSÁVEL — usuário autenticado que está executando a
  // transferência (não é mais um nome fixo/default).
  // ==========================================================

  const nomeResponsavel =
    perfilUsuario?.nome ||
    usuario?.displayName ||
    usuario?.email ||
    "Usuário";


  const [
    responsavelUid,
    setResponsavelUid,
  ] = useState("");


  const [
    motivo,
    setMotivo,
  ] = useState("");


  const [
    usuarios,
    setUsuarios,
  ] = useState([]);


  const [
    carregandoUsuarios,
    setCarregandoUsuarios,
  ] = useState(true);


  // ==========================================================
  // CARREGAR USUÁRIOS
  // ==========================================================

  useEffect(() => {

    async function carregarUsuarios() {

      try {

        setCarregandoUsuarios(true);


        const snapshot =
          await getDocs(
            collection(
              db,
              "usuarios"
            )
          );


        const lista =
          snapshot.docs

            .map((doc) => ({
              id:
                doc.id,

              ...doc.data(),

            }))

            // ----------------------------------------------
            // SOMENTE USUÁRIOS ATIVOS
            // ----------------------------------------------

            .filter(
              (usuario) =>
                usuario.ativo !== false
            )

            // ----------------------------------------------
            // SOMENTE RECEPCIONISTAS
            // ----------------------------------------------

            .filter(
              (usuario) =>
                usuario.perfil ===
                "recepcionista"
            )

            // ----------------------------------------------
            // PRECISA TER NOME
            // ----------------------------------------------

            .filter(
              (usuario) =>
                usuario.nome
            )

            // ----------------------------------------------
            // ORDENA POR NOME
            // ----------------------------------------------

            .sort(
              (a, b) =>
                a.nome.localeCompare(
                  b.nome,
                  "pt-BR"
                )
            );


        console.log(
          "USUÁRIOS PARA TRANSFERÊNCIA:",
          lista
        );


        setUsuarios(lista);

      } catch (erro) {

        console.error(
          "Erro ao carregar usuários para transferência:",
          erro
        );

        alert(
          "Não foi possível carregar os responsáveis."
        );

      } finally {

        setCarregandoUsuarios(false);

      }

    }


    carregarUsuarios();

  }, []);


  // ==========================================================
  // TRANSFERIR LEAD
  // ==========================================================

  async function transferirLead() {

    // ========================================================
    // VALIDAÇÃO DEFENSIVA DE PERMISSÃO
    //
    // A interface já esconde este componente para quem não
    // tem permissão (LeadDetailsModal.jsx), mas a função em
    // si também não deve executar a transferência caso seja
    // chamada por alguém sem a permissão "transferirLead".
    // ========================================================

    if (!permissoes.transferirLead) {

      alert(
        "Você não tem permissão para transferir leads."
      );

      return;

    }


    if (!responsavelUid) {

      alert(
        "Selecione o novo responsável."
      );

      return;

    }


    // ========================================================
    // NOME DO USUÁRIO SELECIONADO
    //
    // O responsavelUid vem do documento real do usuário
    // (usuario.id), nunca do nome — o nome aqui é só para
    // exibição e para manter responsavel/consultora
    // compatíveis com o restante do sistema.
    // ========================================================

    const usuarioSelecionado =
      usuarios.find(
        (usuario) =>
          usuario.id === responsavelUid
      );

    const nomeSelecionado =
      usuarioSelecionado?.nome ||
      "";


    if (!motivo.trim()) {

      alert(
        "Informe o motivo da transferência."
      );

      return;

    }


    try {

      // ======================================================
      // ATUALIZA RESPONSÁVEL DO LEAD
      // ======================================================

      await atualizarLead(
  lead.id,
  {
    responsavelUid,
    responsavel: nomeSelecionado,
    consultora: nomeSelecionado,
  }
);

      // ======================================================
      // REGISTRA NO HISTÓRICO
      // ======================================================

      await registrarEvento({

        leadId:
          lead.id,

        tipo:
          "TRANSFERENCIA",

        usuario:
          nomeResponsavel,

        descricao:
          `Lead transferido de ${
            lead.responsavel ||
            "Sem responsável"
          } para ${
            nomeSelecionado
          }. Motivo: ${
            motivo
          }`,

        dados: {

          responsavelAnterior:
            lead.responsavel ||
            "",

          novoResponsavel:
            nomeSelecionado,

          motivo:
            motivo,

        },

      });


      // ======================================================
      // LIMPA FORMULÁRIO
      // ======================================================

      setResponsavelUid("");

      setMotivo("");


      alert(
        `Lead transferido para ${nomeSelecionado} com sucesso.`
      );

    } catch (erro) {

      console.error(
        "Erro ao transferir Lead:",
        erro
      );

      alert(
        "Não foi possível transferir o Lead."
      );

    }

  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <section className="leadTransfer">

      <h3>
        🔄 Transferir Lead
      </h3>


      {/* ====================================================
          RESPONSÁVEL
      ==================================================== */}

      <select
        value={
          responsavelUid
        }
        onChange={(e) =>
          setResponsavelUid(
            e.target.value
          )
        }
        disabled={
          carregandoUsuarios
        }
      >

        <option value="">
          {carregandoUsuarios
            ? "Carregando responsáveis..."
            : "Selecione..."}
        </option>


        {usuarios.map(
          (usuario) => (

            <option
              key={
                usuario.id
              }
              value={
                usuario.id
              }
            >
              {
                usuario.nome
              }
            </option>

          )
        )}

      </select>


      {/* ====================================================
          MOTIVO
      ==================================================== */}

      <textarea
        placeholder="Motivo da transferência..."
        value={
          motivo
        }
        onChange={(e) =>
          setMotivo(
            e.target.value
          )
        }
      />


      {/* ====================================================
          BOTÃO
      ==================================================== */}

      <button
        className="btnTransferir"
        onClick={
          transferirLead
        }
        disabled={
          carregandoUsuarios
        }
      >

        Transferir

      </button>

    </section>

  );

}