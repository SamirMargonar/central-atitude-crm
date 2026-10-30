import { useCallback, useEffect, useState } from "react";

import { servicoPlanos } from "../planos/servicoPlanosReal";

import { planosParaSeletor } from "../utils/planos";

// ==========================================================
// CATÁLOGO DE PLANOS (leitura)
// ==========================================================
//
// Lê `planos` e `categoriasPlano` uma vez (getDocs) quando o
// formulário abre (`ativo`). Devolve:
//   - lista: planos disponíveis para NOVA contratação (ativos, dentro
//     da janela da oferta, categoria ativa), mais o plano que a
//     matrícula já usa (`manter`), mesmo se estiver desativado;
//   - fallback: true quando o catálogo ainda não existe/está vazio ou
//     não pôde ser lido — nesse caso a lista é a dos 4 planos
//     legados, para a matrícula NUNCA ficar sem opções.
// ==========================================================

export default function usePlanos({ ativo = true, manter = null, servico = servicoPlanos } = {}) {

  const [catalogo, setCatalogo] = useState({ planos: [], categorias: [] });
  const [carregou, setCarregou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {

    setCarregando(true);

    try {
      setCatalogo(await servico.carregarCatalogo());
      setErro(null);
      setCarregou(true);
    } catch (e) {
      console.error("Erro ao carregar planos:", e);
      setErro(e);
      setCarregou(false);
    } finally {
      setCarregando(false);
    }

  }, [servico]);

  useEffect(() => {
    if (ativo) {
      recarregar();
    }
  }, [ativo, recarregar]);

  const { lista, fallback } = planosParaSeletor({
    planos: catalogo.planos,
    categorias: catalogo.categorias,
    carregou,
    manter,
  });

  return {
    lista,
    fallback,
    categorias: catalogo.categorias,
    planos: catalogo.planos,
    carregando,
    erro,
    recarregar,
  };

}
