// Instância do serviço de planos ligada ao Firestore real.
import * as firestore from "firebase/firestore";

import { db } from "../firebase/firebase";

import { criarServicoPlanos } from "./servicoPlanos";

export const servicoPlanos = criarServicoPlanos({ db, fs: firestore });
