// Instância única (por aba) do cache de busca de leads, ligada ao
// Firestore real. Desktop e mobile compartilham a mesma instância.
import * as firestore from "firebase/firestore";

import { db } from "../firebase/firebase";

import { criarCacheBuscaLeads } from "./cacheBuscaLeads";

export const cacheBuscaLeadsSessao = criarCacheBuscaLeads({
  db,
  fs: firestore,
});
