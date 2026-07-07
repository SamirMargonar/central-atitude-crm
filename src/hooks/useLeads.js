import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";

export default function useLeads() {
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "leads"),
      (snapshot) => {
        const lista = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setLeads(lista);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    leads,
    setLeads,
  };
}