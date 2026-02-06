
"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  onSnapshot, 
  DocumentReference, 
  CollectionReference, 
  Query,
  doc as firestoreDoc,
  collection as firestoreCollection,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  SetOptions,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { useState, useEffect, useMemo, DependencyList } from "react";

// --- 1. CONFIGURACIÓN ---
// Las credenciales se leen desde las variables de entorno (ver .env.local)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- 2. INICIALIZACIÓN SINGLETON ---
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- 3. HOOKS PERSONALIZADOS ---

// Hook para acceder a la instancia de Firestore
export const useFirestore = () => {
  return db;
};

// Hook para acceder a la instancia de Auth
export const useAuth = () => {
    return auth;
}

// Hook para acceder al Usuario actual
export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, isUserLoading, userError: null };
};

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

// Hook para colecciones
export const useCollection = <T>(queryRef: Query | CollectionReference | null) => {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!queryRef) {
        setData(null);
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(queryRef, 
      (snapshot: QuerySnapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WithId<T>[];
        setData(docs);
        setIsLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        console.error("Error en useCollection:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [queryRef]);

  return { data, isLoading, error };
};

// Hook para documentos individuales
export const useDoc = <T>(docRef: DocumentReference | null) => {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docRef) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(docRef, 
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as WithId<T>);
        } else {
          setData(null);
        }
        setIsLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        console.error("Error leyendo documento:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, isLoading, error };
};

// Hook utilitario para memorizar referencias de Firestore
export const useMemoFirebase = <T>(factory: () => T, deps: DependencyList): T => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
};

// --- 4. FUNCIONES NON-BLOCKING ---

// LOGIN
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password).catch(console.error);
}

export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password).catch(console.error);
}

// UPDATES
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  setDoc(docRef, data, options || {}).catch(error => {
    console.error("Error en setDocumentNonBlocking:", error);
  });
}

export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data).catch(error => {
    console.error("Error en addDocumentNonBlocking:", error);
  });
  return promise;
}

export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data).catch(error => {
    console.error("Error en updateDocumentNonBlocking:", error);
  });
}

export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef).catch(error => {
    console.error("Error en deleteDocumentNonBlocking:", error);
  });
}

// --- 5. EXPORTS ---
export { app, db, auth, firestoreDoc as doc, firestoreCollection as collection };
export type { User };
