import { useEffect, useRef, useState } from "react";

import { cacheBuscaLeadsSessao } from "../services/buscaLeadsSessao";

import { normalizarTexto } from "../utils/buscaLeads";

// ==========================================================
// BUSCA GLOBAL DE LEADS (recepcionista)
// ==========================================================
//
// Complementa a lista local (leads da própria recepcionista)
// com leads de outras recepcionistas, pelo cache em memória.
// A leitura da coleção só acontece UMA vez por sessão (ou após
// o TTL) e só quando há um termo com 2+ caracteres, depois de
// uma pausa na digitação. Não faz nada para admin/coordenador
// (a lista local deles já é completa).
// ==========================================================

export const ATRASO_DIGITACAO_MS = 300;

export default function useBuscaLeadsGlobal({
  termo,
  uid,
  ativo,
  cache = cacheBuscaLeadsSessao,
  atraso = ATRASO_DIGITACAO_MS,
}) {

  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [versao, setVersao] = useState(0);

  const sequencia = useRef(0);

  const texto = normalizarTexto(termo);

  useEffect(() => {

    if (!ativo || !uid || texto.length < 2) {
      setResultados([]);
      setCarregando(false);
      setErro(null);
      return undefined;
    }

    const minha = ++sequencia.current;

    const timer = setTimeout(async () => {

      try {

        if (!cache.estaCarregado()) {
          setCarregando(true);
        }

        await cache.carregar(uid);

        if (minha === sequencia.current) {
          setResultados(cache.buscar(termo));
          setErro(null);
        }

      } catch (e) {

        console.error("Erro na busca global de leads:", e);

        if (minha === sequencia.current) {
          // Falha NÃO é resultado vazio: se já havia cache, os dados
          // anteriores continuam valendo e o erro é informado.
          setResultados(
            cache.estaCarregado()
              ? cache.buscar(termo)
              : []
          );
          setErro(e);
        }

      } finally {

        if (minha === sequencia.current) {
          setCarregando(false);
        }

      }

    }, atraso);

    return () => clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, uid, ativo, versao]);

  async function atualizar() {

    if (!uid) {
      return;
    }

    try {
      setCarregando(true);
      await cache.recarregar(uid);
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e);
    } finally {
      setCarregando(false);
    }

  }

  return { resultados, carregando, erro, atualizar };

}
