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
  DocumentSnapshot
} from "firebase/firestore";
// 👇 1. FALTABA ESTA IMPORTACIÓN
import { getStorage } from "firebase/storage"; 
import { getAuth, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, Auth } from "firebase/auth";
import { useState, useEffect, useMemo, DependencyList } from "react";

// --- 1. CONFIGURACIÓN ---
const cleanBucket = (bucket: string | undefined) => {
  if (!bucket) return "";
  return bucket.replace("gs://", "");
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: cleanBucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- 2. INICIALIZACIÓN SINGLETON ---
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// 👇 2. FALTABA INICIALIZAR EL STORAGE
const storage = getStorage(app); 

// --- 3. HOOKS PERSONALIZADOS ---
// (Mantenemos tus hooks useFirestore, useAuth, useUser, etc. igual que antes)
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

// ... (El resto de tus hooks useCollection, useDoc, useMemoFirebase déjalos igual) ...
// Para ahorrar espacio aquí, asumo que mantienes el código intermedio igual.
// Solo asegúrate de copiar los exports del final correctamente.

export const useCollection = <T>(queryRef: Query | CollectionReference | null) => {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [isLoading, setIsLoading] = useState(!!queryRef);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!queryRef) { setData([]); setIsLoading(false); return; }
    let isMounted = true; setIsLoading(true);
    const unsubscribe = onSnapshot(queryRef, (snapshot) => {
        setTimeout(() => { if (isMounted) {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WithId<T>[];
            setData(docs); setIsLoading(false); setError(null);
        }}, 0);
      }, (err) => { setTimeout(() => { if (isMounted) { console.error(err); setError(err); setIsLoading(false); }}, 0); }
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
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
        setTimeout(() => { if (isMounted) {
            if (snapshot.exists()) setData({ id: snapshot.id, ...snapshot.data() } as WithId<T>);
            else setData(null);
            setIsLoading(false); setError(null);
        }}, 0);
      }, (err) => { setTimeout(() => { if (isMounted) { console.error(err); setError(err); setIsLoading(false); }}, 0); }
    );
    return () => { isMounted = false; unsubscribe(); };
  }, [docRef]);
  return { data, isLoading, error };
};

export const useMemoFirebase = <T>(factory: () => T, deps: DependencyList): T => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
};

// ... (Tus funciones non-blocking initiateEmailSignUp, etc. déjalas igual) ...
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void { createUserWithEmailAndPassword(authInstance, email, password).catch(console.error); }
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void { signInWithEmailAndPassword(authInstance, email, password).catch(console.error); }
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) { setDoc(docRef, data, options || {}).catch(console.error); }
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) { return addDoc(colRef, data).catch(console.error); }
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) { updateDoc(docRef, data).catch(console.error); }
export function deleteDocumentNonBlocking(docRef: DocumentReference) { deleteDoc(docRef).catch(console.error); }

// --- 5. EXPORTS ---
// 👇 3. ¡ESTA ES LA CLAVE! AGREGAR 'storage' AL EXPORT
export { app, db, auth, storage, firestoreDoc as doc, firestoreCollection as collection };
export type { User };
