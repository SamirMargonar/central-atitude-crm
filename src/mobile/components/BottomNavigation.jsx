import "../styles/shell.css";


// ==========================================================
// BOTTOM NAVIGATION — MOBILE
// ==========================================================
//
// Navegação por toque, fixa no rodapé. Nesta fase, só alterna
// o estado "tela" dentro de AppMobile.jsx (sem react-router-dom).
// Todas as telas além de "Início" mostram um placeholder "Em
// construção" — a navegação em si já funciona de ponta a ponta.
// ==========================================================

const ITENS = [

  { id: "inicio", icone: "🏠", rotulo: "Início" },

  { id: "leads", icone: "👥", rotulo: "Leads" },

  { id: "agenda", icone: "📅", rotulo: "Agenda" },

  { id: "alertas", icone: "🔔", rotulo: "Alertas" },

  { id: "perfil", icone: "👤", rotulo: "Perfil" },

];


export default function BottomNavigation({
  telaAtual,
  onMudarTela,
}) {

  return (

    <nav className="mobileBottomNav">

      {ITENS.map((item) => (

        <button
          type="button"
          key={item.id}
          className={`mobileBottomNavItem ${
            telaAtual === item.id
              ? "mobileBottomNavItemAtivo"
              : ""
          }`}
          onClick={() =>
            onMudarTela(item.id)
          }
        >

          <span className="mobileBottomNavIcone">
            {item.icone}
          </span>

          <span className="mobileBottomNavRotulo">
            {item.rotulo}
          </span>

        </button>

      ))}

    </nav>

  );

}
