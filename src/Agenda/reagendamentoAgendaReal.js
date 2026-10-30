// Reagendamento da Agenda ligado ao Firestore real.
import * as firestore from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

import { criarReagendamentoAgenda } from "./reagendamentoAgenda";

export const reagendamentoAgenda = criarReagendamentoAgenda({
  db,
  fs: firestore,
  auth,
});
