"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

export default function HistoryPage() {
  const [simulations, setSimulations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchSimulations = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "analisis_costos"), orderBy("dateCreated", "desc"));
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

  const handleToggleStatus = async (sim: any) => {
    try {
      // Alternamos entre 'ok' y 'pending' (por defecto si no tiene, asume 'pending')
      const newStatus = sim.status === 'ok' ? 'pending' : 'ok';
      
      // Actualizamos solo en la colección actual del historial
      await updateDoc(doc(db, "analisis_costos", sim.id), { status: newStatus });
      
      // Actualizamos el estado de la UI al instante sin tener que recargar toda la página
      setSimulations(prevSims => 
        prevSims.map(s => s.id === sim.id ? { ...s, status: newStatus } : s)
      );
    } catch (error) {
      console.error("Error al cambiar el estado:", error);
      alert(`Hubo un error al actualizar. El sistema dice: ${error instanceof Error ? error.message : 'Desconocido'}`);
    }
  };

  const handleDeleteAnalysis = async (id: string, clientName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el análisis de "${clientName}"? Esta acción no se puede deshacer.`)) return;

    try {
      // Usamos el nombre de la colección correcta: analisis_costos
      await deleteDoc(doc(db, "analisis_costos", id));
      
      // Actualizamos el estado visualmente sin tener que recargar toda la página
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
                    <td className="p-4 font-bold">
                      <span 
                        onClick={() => router.push(`/taylor-curve/${sim.id}/edit`)} 
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                        title="Clic para abrir y editar este informe"
                      >
                        {sim.clientName}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{sim.caseName}</td>
                    <td className="p-4 font-black text-emerald-600">
                      {formatCurrency(sim.annualSavings)}
                    </td>
                    <td className="p-4 flex items-center justify-end gap-2">
                       <Button 
                        onClick={() => router.push(`/taylor-curve/${sim.id}/edit`)} 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" /> Editar
                      </Button>
                      
                      {sim.pdfUrl && (
                        <a href={sim.pdfUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors flex items-center gap-1">
                          📄 PDF
                        </a>
                      )}
                      
                      <button 
                        onClick={() => handleToggleStatus(sim)} 
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 shadow-sm border ${
                          sim.status === 'ok' 
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                        title="Haz clic para cambiar el estado"
                      >
                        {sim.status === 'ok' ? '✅ Análisis OK' : '⏳ Pendiente'}
                      </button>

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
