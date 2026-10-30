import { useCallback, useEffect, useMemo, useState } from "react";

import LeadActionModal from "../components/LeadDetailsModal/LeadActionModal";

import { useAuth } from "../auth/AuthContext";

import { servicoPlanos } from "./servicoPlanosReal";

import {
  CATEGORIAS_INICIAIS,
  PLANOS_INICIAIS,
  centavosParaCampo,
  centavosParaReais,
  formatarPeriodoOferta,
  hojeEmISO,
  nomeCategoria,
  planoVigente,
  reaisParaCentavos,
} from "../utils/planos";

import "../styles/planos.css";

// ==========================================================
// GERENCIAMENTO DE PLANOS — SOMENTE ADMINISTRADOR
//
// Cadastra, edita, ativa e desativa planos e categorias. NUNCA
// exclui. Matrículas já contratadas não mudam: elas guardam o
// próprio instantâneo do plano. A permissão real é das Firestore
// Rules (`planos`/`categoriasPlano`: escrita só de admin); a tela
// só evita mostrar o que seria negado.
// ==========================================================

const FORM_VAZIO = {
  nome: "",
  categoriaId: "convencionais",
  valor: "",
  taxaAdesao: "",
  duracaoMeses: "1",
  descricao: "",
  condicoes: "",
  ofertaInicio: "",
  ofertaFim: "",
  ativo: true,
};

function formDoPlano(plano) {
  return {
    nome: plano.nome || "",
    categoriaId: plano.categoriaId || "convencionais",
    valor: centavosParaCampo(plano.valorCentavos),
    taxaAdesao: centavosParaCampo(plano.taxaAdesaoCentavos),
    duracaoMeses: String(plano.duracaoMeses ?? "1"),
    descricao: plano.descricao || "",
    condicoes: plano.condicoes || "",
    ofertaInicio: plano.ofertaInicio || "",
    ofertaFim: plano.ofertaFim || "",
    ativo: plano.ativo !== false,
  };
}

export default function GerenciamentoPlanos({ servico = servicoPlanos }) {

  const { usuario, perfilUsuario, isAdmin } = useAuth();

  const autor = useMemo(
    () => ({ uid: usuario?.uid || "", nome: perfilUsuario?.nome || "" }),
    [usuario?.uid, perfilUsuario?.nome]
  );

  const [catalogo, setCatalogo] = useState({ planos: [], categorias: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [mostrarInativos, setMostrarInativos] = useState(true);

  const [editando, setEditando] = useState(null);      // null | "novo" | plano
  const [form, setForm] = useState(FORM_VAZIO);
  const [errosForm, setErrosForm] = useState([]);

  const [categoriasAbertas, setCategoriasAbertas] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");

  const recarregar = useCallback(async () => {

    setCarregando(true);

    try {
      setCatalogo(await servico.carregarCatalogo());
      setErro("");
    } catch (e) {
      console.error("Erro ao carregar planos:", e);
      setErro("Não foi possível carregar o catálogo de planos.");
    } finally {
      setCarregando(false);
    }

  }, [servico]);

  useEffect(() => {
    if (isAdmin) {
      recarregar();
    }
  }, [isAdmin, recarregar]);

  if (!isAdmin) {
    return (
      <section className="planosPagina">
        <p className="planosAviso">
          O gerenciamento de planos é exclusivo para administradores.
        </p>
      </section>
    );
  }

  const categoriasOrdenadas = [...catalogo.categorias].sort(
    (a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.nome).localeCompare(String(b.nome), "pt-BR")
  );

  const faltaCargaInicial =
    CATEGORIAS_INICIAIS.some((c) => !catalogo.categorias.some((x) => x.id === c.id)) ||
    PLANOS_INICIAIS.some((p) => !catalogo.planos.some((x) => x.id === p.id));

  const hoje = hojeEmISO();

  const planosVisiveis = catalogo.planos
    .filter((p) => filtroCategoria === "todas" || p.categoriaId === filtroCategoria)
    .filter((p) => mostrarInativos || p.ativo !== false)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));

  async function executar(acao, sucesso) {

    if (salvando) {
      return false;
    }

    setSalvando(true);
    setMensagem("");

    try {
      const resultado = await acao();
      await recarregar();
      setMensagem(typeof sucesso === "function" ? sucesso(resultado) : sucesso);
      return true;
    } catch (e) {
      console.error("Erro no gerenciamento de planos:", e);
      setErro(
        e?.codigo === "PLANO_INVALIDO" || e?.codigo === "CATEGORIA_DUPLICADA"
          ? e.message
          : e?.code === "permission-denied"
            ? "Sem permissão: somente administradores podem alterar planos."
            : "Não foi possível concluir a operação."
      );
      return false;
    } finally {
      setSalvando(false);
    }

  }

  function abrirNovo() {
    setEditando("novo");
    setForm(FORM_VAZIO);
    setErrosForm([]);
    setErro("");
  }

  function abrirEdicao(plano) {
    setEditando(plano);
    setForm(formDoPlano(plano));
    setErrosForm([]);
    setErro("");
  }

  function fecharForm() {
    setEditando(null);
    setErrosForm([]);
  }

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {

    const valorCentavos = reaisParaCentavos(form.valor);
    const taxaCentavos = reaisParaCentavos(form.taxaAdesao);

    const problemas = [];
    if (Number.isNaN(valorCentavos)) problemas.push("O valor informado é inválido.");
    if (Number.isNaN(taxaCentavos)) problemas.push("A taxa de adesão informada é inválida.");
    if (problemas.length) {
      setErrosForm(problemas);
      return;
    }

    const dados = {
      nome: form.nome,
      categoriaId: form.categoriaId,
      duracaoMeses: Number(form.duracaoMeses),
      valorCentavos,
      taxaAdesaoCentavos: taxaCentavos,
      descricao: form.descricao,
      condicoes: form.condicoes,
      ofertaInicio: form.ofertaInicio || null,
      ofertaFim: form.ofertaFim || null,
    };

    const novo = editando === "novo";

    const ok = await executar(async () => {
      await servico.salvarPlano(
        { id: novo ? null : editando.id, dados, ativo: !!form.ativo },
        autor
      );
    }, novo ? "Plano cadastrado." : "Plano atualizado. As matrículas já contratadas não foram alteradas.");

    if (ok) {
      fecharForm();
    }

  }

  async function alternarAtivo(plano) {
    const ativar = plano.ativo === false;
    await executar(
      () => servico.definirAtivoPlano(plano.id, ativar, autor),
      ativar
        ? "Plano ativado: já pode ser usado em novas matrículas."
        : "Plano desativado: não aparece mais em novas matrículas (matrículas existentes não mudam)."
    );
  }

  async function cargaInicial() {
    if (!window.confirm(
      "Criar as categorias e os 4 planos iniciais (Mensal, Trimestral, Semestral, Anual) que ainda não existem? Nada existente será alterado."
    )) {
      return;
    }
    await executar(
      () => servico.cargaInicial(autor),
      (r) => `Carga inicial concluída: ${r.criadas.length} criado(s), ${r.jaExistiam.length} já existia(m).`
    );
  }

  async function adicionarCategoria() {
    const nome = novaCategoria.trim();
    if (!nome) return;
    const ok = await executar(
      () => servico.criarCategoria(nome, autor, categoriasOrdenadas.length + 1),
      "Categoria criada."
    );
    if (ok) setNovaCategoria("");
  }

  async function alternarCategoria(categoria) {
    const ativar = categoria.ativo === false;
    await executar(
      () => servico.definirAtivaCategoria(categoria.id, ativar, autor),
      ativar ? "Categoria ativada." : "Categoria desativada: seus planos deixam de aparecer em novas matrículas."
    );
  }

  const categoriasDoForm = categoriasOrdenadas.filter(
    (c) => c.ativo !== false || (editando && editando !== "novo" && editando.categoriaId === c.id)
  );
  const opcoesCategoria = categoriasDoForm.length ? categoriasDoForm : CATEGORIAS_INICIAIS;

  return (

    <section className="planosPagina">

      <div className="planosCabecalho">

        <div>
          <h1>🎓 Gerenciamento de Planos</h1>
          <p>
            Cadastre e mantenha os planos de matrícula. Alterar ou desativar
            um plano não muda as matrículas já contratadas.
          </p>
        </div>

        <div className="planosAcoes">
          <button type="button" className="btnSalvar" onClick={abrirNovo}>
            ➕ Novo plano
          </button>
          <button type="button" className="btnCancelar" onClick={() => setCategoriasAbertas(true)}>
            🏷️ Categorias
          </button>
        </div>

      </div>

      {mensagem && <div className="planosMensagem">{mensagem}</div>}
      {erro && <div className="planosErro">{erro}</div>}

      {!carregando && faltaCargaInicial && (
        <div className="planosCargaInicial">
          <span>
            O catálogo está incompleto. Enquanto não for cadastrado, as
            matrículas usam os 4 planos padrão (sem valores).
          </span>
          <button type="button" className="btnSalvar" onClick={cargaInicial} disabled={salvando}>
            Criar planos e categorias iniciais
          </button>
        </div>
      )}

      <div className="planosFiltros">
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="todas">Todas as categorias</option>
          {categoriasOrdenadas.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}{c.ativo === false ? " (inativa)" : ""}</option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          {" "}Mostrar desativados
        </label>
      </div>

      {carregando && <p className="planosAviso">Carregando planos...</p>}

      {!carregando && planosVisiveis.length === 0 && (
        <p className="planosAviso">Nenhum plano encontrado.</p>
      )}

      <div className="planosLista">

        {planosVisiveis.map((plano) => (

          <article key={plano.id} className={`planoCard${plano.ativo === false ? " planoInativo" : ""}`}>

            <header>
              <strong>{plano.nome}</strong>
              <span className={plano.ativo === false ? "planoBadge off" : planoVigente(plano, hoje) ? "planoBadge on" : "planoBadge fora"}>
                {plano.ativo === false ? "Desativado" : planoVigente(plano, hoje) ? "Ativo" : "Fora da vigência"}
              </span>
            </header>

            <small>{nomeCategoria(plano.categoriaId, catalogo.categorias) || "Sem categoria"}</small>

            <dl>
              <div><dt>Duração</dt><dd>{plano.duracaoMeses} {plano.duracaoMeses === 1 ? "mês" : "meses"}</dd></div>
              <div><dt>Valor</dt><dd>{Number.isInteger(plano.valorCentavos) ? centavosParaReais(plano.valorCentavos) : "— (não definido)"}</dd></div>
              <div><dt>Adesão</dt><dd>{Number.isInteger(plano.taxaAdesaoCentavos) ? centavosParaReais(plano.taxaAdesaoCentavos) : "—"}</dd></div>
              <div><dt>Oferta</dt><dd>{formatarPeriodoOferta(plano.ofertaInicio, plano.ofertaFim)}</dd></div>
            </dl>

            {plano.descricao && <p className="planoTexto">{plano.descricao}</p>}
            {plano.condicoes && <p className="planoTexto">📝 {plano.condicoes}</p>}

            <footer>
              <button type="button" className="btnCancelar" onClick={() => abrirEdicao(plano)}>✏️ Editar</button>
              <button type="button" className="btnCancelar" onClick={() => alternarAtivo(plano)} disabled={salvando}>
                {plano.ativo === false ? "Ativar" : "Desativar"}
              </button>
            </footer>

          </article>

        ))}

      </div>

      {/* ---------------- FORMULÁRIO ---------------- */}

      <LeadActionModal aberto={!!editando} titulo={editando === "novo" ? "Novo plano" : "Editar plano"}>

        <label>Nome do plano</label>
        <input type="text" value={form.nome} maxLength={80} onChange={(e) => atualizar("nome", e.target.value)} />

        <label>Categoria</label>
        <select value={form.categoriaId} onChange={(e) => atualizar("categoriaId", e.target.value)}>
          {opcoesCategoria.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>

        <div className="planosDuasColunas">
          <div>
            <label>Valor (R$)</label>
            <input type="text" inputMode="decimal" placeholder="Ex.: 129,90" value={form.valor} onChange={(e) => atualizar("valor", e.target.value)} />
          </div>
          <div>
            <label>Taxa de adesão (R$)</label>
            <input type="text" inputMode="decimal" placeholder="Ex.: 0,00" value={form.taxaAdesao} onChange={(e) => atualizar("taxaAdesao", e.target.value)} />
          </div>
        </div>

        <label>Duração do contrato (meses)</label>
        <input type="number" min="1" max="120" value={form.duracaoMeses} onChange={(e) => atualizar("duracaoMeses", e.target.value)} />

        <label>Descrição</label>
        <textarea rows={2} maxLength={500} value={form.descricao} onChange={(e) => atualizar("descricao", e.target.value)} />

        <label>Condições comerciais</label>
        <textarea rows={3} maxLength={1000} value={form.condicoes} onChange={(e) => atualizar("condicoes", e.target.value)} />

        <div className="planosDuasColunas">
          <div>
            <label>Oferta válida a partir de</label>
            <input type="date" value={form.ofertaInicio} onChange={(e) => atualizar("ofertaInicio", e.target.value)} />
          </div>
          <div>
            <label>Oferta válida até</label>
            <input type="date" value={form.ofertaFim} onChange={(e) => atualizar("ofertaFim", e.target.value)} />
          </div>
        </div>

        <label className="planosCheck">
          <input type="checkbox" checked={form.ativo} onChange={(e) => atualizar("ativo", e.target.checked)} />
          {" "}Plano ativo (disponível para novas matrículas)
        </label>

        {errosForm.length > 0 && (
          <div className="planosErro">{errosForm.map((m) => <div key={m}>{m}</div>)}</div>
        )}

        <div className="leadActionButtons">
          <button type="button" className="btnCancelar" onClick={fecharForm}>Cancelar</button>
          <button type="button" className="btnSalvar" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>

      </LeadActionModal>

      {/* ---------------- CATEGORIAS ---------------- */}

      <LeadActionModal aberto={categoriasAbertas} titulo="Categorias de planos">

        <ul className="planosCategorias">
          {categoriasOrdenadas.map((c) => (
            <li key={c.id}>
              <span>{c.nome}{c.ativo === false ? " (inativa)" : ""}</span>
              <button type="button" className="btnCancelar" onClick={() => alternarCategoria(c)} disabled={salvando}>
                {c.ativo === false ? "Ativar" : "Desativar"}
              </button>
            </li>
          ))}
          {categoriasOrdenadas.length === 0 && <li>Nenhuma categoria cadastrada.</li>}
        </ul>

        <label>Nova categoria</label>
        <input type="text" value={novaCategoria} maxLength={60} placeholder="Ex.: Estudantes" onChange={(e) => setNovaCategoria(e.target.value)} />

        {erro && <div className="planosErro">{erro}</div>}

        <div className="leadActionButtons">
          <button type="button" className="btnCancelar" onClick={() => setCategoriasAbertas(false)}>Fechar</button>
          <button type="button" className="btnSalvar" onClick={adicionarCategoria} disabled={salvando || !novaCategoria.trim()}>
            Adicionar categoria
          </button>
        </div>

      </LeadActionModal>

    </section>

  );

}
