"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/formatters";

export default function HistoryPage() {
  const [simulations, setSimulations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchSimulations = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "simulaciones_historial"), orderBy("dateCreated", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSimulations(data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulations();
  }, []);

  const handlePromoteToCRM = async (sim: any) => {
    if (!window.confirm(`¿Estás seguro de promover el análisis de "${sim.caseName}" para el cliente "${sim.clientName}" a un Caso de Éxito en el CRM?`)) return;
    
    try {
      // 1. Clonar a la colección oficial del CRM (cuttingToolAnalyses)
      const crmPayload = {
        cliente: sim.clientName,
        name: sim.caseName,
        recordType: 'success_case',
        status: 'Pendiente', // Pendiente de prueba física/confirmación
        annualSavings: sim.annualSavings,
        pdfUrl: sim.pdfUrl,
        dateCreated: serverTimestamp(),
        dateModified: serverTimestamp(),
        promotedFromId: sim.id,
        userId: sim.userId, // <-- REQUISITO DE SEGURIDAD AÑADIDO
        ...(sim.taylorInputs || {}),
      };

      const newCaseRef = await addDoc(collection(db, "cuttingToolAnalyses"), crmPayload);

      // 2. Marcar como promovido en el historial
      await updateDoc(doc(db, "simulaciones_historial", sim.id), { status: 'promoted' });
      
      alert("¡Promovido exitosamente! El caso ahora está en el CRM principal.");
      router.push(`/cases/${newCaseRef.id}/edit`); // Redirigir a la página de edición del nuevo caso
      
    } catch (error) {
      console.error("Error DETALLADO al promover:", error);
      // Mostrar el error real que devuelve Firebase
      alert(`Fallo al promover. El sistema dice: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  };

  const handleDeleteAnalysis = async (id: string, clientName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el análisis de "${clientName}"? Esta acción no se puede deshacer.`)) return;

    try {
      await deleteDoc(doc(db, "simulaciones_historial", id));
      
      setSimulations(prevSims => prevSims.filter(sim => sim.id !== id));
      alert("Análisis eliminado correctamente.");
    } catch (error) {
      console.error("Error al eliminar el análisis:", error);
      alert("Hubo un error al eliminar el registro. Revisa los permisos.");
    }
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Historial de Análisis de Costos</h1>
          <p className="text-sm text-slate-500">Cotizaciones teóricas y simulaciones guardadas.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Pieza / Operación</th>
                <th className="p-4">Ahorro Proyectado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Cargando historial...</td></tr>
              ) : simulations.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No hay análisis guardados aún.</td></tr>
              ) : (
                simulations.map((sim) => (
                  <tr key={sim.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-600">
                      {sim.dateCreated ? new Date(sim.dateCreated.toDate()).toLocaleDateString('es-ES') : 'N/A'}
                    </td>
                    <td className="p-4 font-bold text-slate-800">{sim.clientName}</td>
                    <td className="p-4 text-slate-600">{sim.caseName}</td>
                    <td className="p-4 font-black text-emerald-600">
                      {formatCurrency(sim.annualSavings)}
                    </td>
                    <td className="p-4 flex items-center justify-end gap-2">
                      {sim.pdfUrl && (
                        <a href={sim.pdfUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors flex items-center gap-1">
                          📄 PDF
                        </a>
                      )}
                      {sim.status !== 'promoted' ? (
                        <button onClick={() => handlePromoteToCRM(sim)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold transition-colors flex items-center gap-1 shadow-sm">
                          🚀 Promover a CRM
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold flex items-center gap-1">
                          ✅ Promovido
                        </span>
                      )}
                       <button 
                        onClick={() => handleDeleteAnalysis(sim.id, sim.clientName)} 
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-bold transition-colors flex items-center gap-1 shadow-sm ml-1"
                        title="Eliminar este análisis"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
