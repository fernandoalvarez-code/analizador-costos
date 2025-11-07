'use client';

import { useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';

type CaseData = {
  id: string;
  name: string;
  status: 'Pendiente' | 'Exitoso' | 'No Exitoso';
  dateCreated: { seconds: number; nanoseconds: number };
};

const StaleCaseChecker = () => {
  const firestore = useFirestore();

  const casesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'cuttingToolAnalyses'), where('status', '==', 'Pendiente'));
  }, [firestore]);

  const { data: pendingCases } = useCollection<CaseData>(casesQuery);

  useEffect(() => {
    if (!firestore || !pendingCases) return;

    const checkCases = async () => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const notificationsCollection = collection(firestore, 'notifications');

      for (const caseData of pendingCases) {
        if (caseData.dateCreated && caseData.dateCreated.seconds * 1000 < thirtyDaysAgo) {
          // Case is stale. Check if a notification already exists.
          const q = query(notificationsCollection, where('caseId', '==', caseData.id));
          const existingNotifs = await getDocs(q);

          if (existingNotifs.empty) {
            // No notification found, create one using non-blocking update
            const notificationData = {
              title: 'Caso Pendiente de Seguimiento',
              message: `El caso "${caseData.name}" lleva más de 30 días pendiente.`,
              caseId: caseData.id,
              createdAt: serverTimestamp(),
              readBy: [],
            };
            addDocumentNonBlocking(notificationsCollection, notificationData);
          }
        }
      }
    };

    checkCases();
  }, [pendingCases, firestore]);

  // This component doesn't render anything visible
  return null;
};

export default StaleCaseChecker;
