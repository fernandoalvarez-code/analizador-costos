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
  FirestoreError,
  DocumentSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { getStorage } from "firebase/storage"; 
import { getAuth, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, Auth, updateProfile } from "firebase/auth";
import { useState, useEffect, useMemo, DependencyList } from "react";

// --- 1. CONFIGURACIÓN ---
const firebaseConfig = {
  apiKey: "AIzaSyCHUJ52y_kSw7urqOxuj7aC-dhusJ6xas4",
  authDomain: "studio-1546170521-5d9b0.firebaseapp.com",
  projectId: "studio-1546170521-5d9b0",
  storageBucket: "studio-1546170521-5d9b0.firebasestorage.app",
  messagingSenderId: "390176636803",
  appId: "1:390176636803:web:ea4652902e1c246092c0b6"
};

// --- 2. INICIALIZACIÓN SINGLETON ---
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); 

// --- 3. HOOKS PERSONALIZADOS ---
export const useFirestore = () => db;
export const useAuth = () => auth;

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setTimeout(() => {
        if (isMounted) {
          setUser(currentUser);
          setLoading(false);
        }
      }, 0);
    });
    return () => { isMounted = false; unsubscribe(); };
  }, []);
  return { user, loading };
};

export type WithId<T> = T & { id: string };

export const useCollection = <T>(queryRef: Query | CollectionReference | null) => {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [isLoading, setIsLoading] = useState(!!queryRef);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!queryRef) { setData([]); setIsLoading(false); return; }
    let isMounted = true; setIsLoading(true);
    const unsubscribe = onSnapshot(queryRef, 
      (snapshot: QuerySnapshot) => {
        setTimeout(() => {
            if (!isMounted) return;
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WithId<T>[];
            setData(docs); setIsLoading(false); setError(null);
        }, 0);
      },
      (err: FirestoreError) => {
        setTimeout(() => {
            if (!isMounted) return;
            console.error("Error en useCollection:", err);
            setError(err);
            setIsLoading(false);
        }, 0);
      }
    );
    return () => { isMounted = false; unsubscribe(); };
  }, [queryRef]);
  return { data, isLoading, error };
};

export const useDoc = <T>(docRef: DocumentReference | null) => {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(!!docRef);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docRef) { setData(null); setIsLoading(false); return; }
    let isMounted = true; setIsLoading(true);
    const unsubscribe = onSnapshot(docRef, 
      (snapshot: DocumentSnapshot) => {
        setTimeout(() => {
            if (!isMounted) return;
            if (snapshot.exists()) {
              setData({ id: snapshot.id, ...snapshot.data() } as WithId<T>);
            } else {
              setData(null);
            }
            setIsLoading(false); setError(null);
        }, 0);
      },
      (err: FirestoreError) => {
        setTimeout(() => {
            if (!isMounted) return;
            console.error("Error leyendo documento:", err);
            setError(err);
            setIsLoading(false);
        }, 0);
      }
    );
    return () => { isMounted = false; unsubscribe(); };
  }, [docRef]);
  return { data, isLoading, error };
};

export const useMemoFirebase = <T>(factory: () => T, deps: DependencyList): T => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
};

// --- 4. FUNCIONES NON-BLOCKING ---
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, displayName: string): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(userCredential => {
        if (userCredential.user) {
            updateProfile(userCredential.user, { displayName: displayName });
        }
    })
    .catch(console.error);
}
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password).catch(console.error);
}
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  setDoc(docRef, data, options || {}).catch(console.error);
}
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  return addDoc(colRef, data).catch(console.error);
}
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data).catch(console.error);
}
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef).catch(console.error);
}

// --- 5. EXPORTS ---
export { app, db, auth, storage, firestoreDoc as doc, firestoreCollection as collection };
export type { User };
