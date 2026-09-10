import "../styles/dashboard.css";


// ==========================================================
// CARD DE INDICADOR — MOBILE
// ==========================================================
//
// Componente pequeno e específico do Dashboard Mobile — não é
// um componente do Desktop, não importa CSS do Desktop. Área
// de toque de pelo menos ~44px (padding generoso + min-height).
//
// `bloqueado` cobre o caso de um indicador que hoje não pode
// ser calculado com os dados/hooks disponíveis ao Mobile nesta
// fase — nunca mostra um número inventado, só avisa que está
// indisponível.
//
// `carregando` cobre uma consulta real ainda em andamento (ex.:
// buscarVisitasPorPerfil(), que é uma Promise única, não um
// listener) — mostra "…" em vez de inventar um número antes da
// resposta chegar.
// ==========================================================

export default function IndicadorCard({
  icone,
  rotulo,
  numero,
  subtitulo,
  destaque = false,
  bloqueado = false,
  carregando = false,
  onClick,
}) {

  const clicavel =
    !bloqueado &&
    typeof onClick === "function";


  return (

    <button
      type="button"
      className={`
        mobileIndicadorCard
        ${destaque ? "mobileIndicadorCardDestaque" : ""}
        ${bloqueado ? "mobileIndicadorCardBloqueado" : ""}
      `}
      onClick={
        clicavel
          ? onClick
          : undefined
      }
      disabled={!clicavel}
    >

      <div className="mobileIndicadorCardTopo">

        <span className="mobileIndicadorCardIcone">
          {icone}
        </span>

        <span className="mobileIndicadorCardRotulo">
          {rotulo}
        </span>

      </div>


      {bloqueado ? (

        <span className="mobileIndicadorCardIndisponivel">
          🔒 Indisponível nesta fase
        </span>

      ) : (

        <>

          <strong className="mobileIndicadorCardNumero">
            {carregando ? "…" : numero}
          </strong>

          {subtitulo && (

            <span className="mobileIndicadorCardSubtitulo">
              {subtitulo}
            </span>

          )}

        </>

      )}

    </button>

  );

}
