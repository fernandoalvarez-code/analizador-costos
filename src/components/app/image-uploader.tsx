'use client';

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Image as ImageIcon, UploadCloud, Trash2 } from "lucide-react";

interface ImageUploaderProps {
  // Callback modificado para devolver todo lo necesario
  onImagesChange: (files: File[], keptUrls: string[], allDescriptions: string[]) => void;
  initialImages?: string[];
  initialDescriptions?: string[];
}

export function ImageUploader({ 
  onImagesChange, 
  initialImages = [], 
  initialDescriptions = [] 
}: ImageUploaderProps) {
  
  // Estado para imágenes YA GUARDADAS (URLs)
  const [keptImages, setKeptImages] = useState<{url: string, desc: string}[]>([]);
  
  // Estado para imágenes NUEVAS (Archivos)
  const [newImages, setNewImages] = useState<{file: File, preview: string, desc: string}[]>([]);

  // Carga inicial (Solo ocurre una vez cuando llegan los datos)
  useEffect(() => {
    if (initialImages.length > 0 && keptImages.length === 0 && newImages.length === 0) {
      const formatted = initialImages.map((url, i) => ({
        url,
        desc: initialDescriptions[i] || ""
      }));
      setKeptImages(formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImages, initialDescriptions]);

  // Función central para notificar cambios al padre (Dashboard)
  const notifyParent = (currentKept: typeof keptImages, currentNew: typeof newImages) => {
    const filesToUpload = currentNew.map(img => img.file);
    const urlsToKeep = currentKept.map(img => img.url);
    
    // El orden de las descripciones debe coincidir: Primero las viejas, luego las nuevas
    const allDescs = [
      ...currentKept.map(img => img.desc),
      ...currentNew.map(img => img.desc)
    ];

    onImagesChange(filesToUpload, urlsToKeep, allDescs);
  };

  // --- MANEJO DE IMÁGENES NUEVAS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const total = keptImages.length + newImages.length + files.length;
      
      if (total > 4) { // Límite arbitrario de 4 para que no se rompa el diseño
        alert("Máximo 4 imágenes en total.");
        return;
      }

      const addedImages = files.map(file => ({
        file,
        preview: URL.createObjectURL(file),
        desc: ""
      }));

      const updatedNew = [...newImages, ...addedImages];
      setNewImages(updatedNew);
      notifyParent(keptImages, updatedNew);
    }
  };

  const removeNewImage = (index: number) => {
    const updated = newImages.filter((_, i) => i !== index);
    setNewImages(updated);
    notifyParent(keptImages, updated);
  };

  const updateNewDesc = (index: number, text: string) => {
    const updated = [...newImages];
    updated[index].desc = text;
    setNewImages(updated);
    notifyParent(keptImages, updated);
  };

  // --- MANEJO DE IMÁGENES VIEJAS ---
  const removeOldImage = (index: number) => {
    const updated = keptImages.filter((_, i) => i !== index);
    setKeptImages(updated);
    notifyParent(updated, newImages);
  };

  const updateOldDesc = (index: number, text: string) => {
    const updated = [...keptImages];
    updated[index].desc = text;
    setKeptImages(updated);
    notifyParent(updated, newImages);
  };

  return (
    <div className="border rounded-lg p-4 bg-blue-50/50 shadow-sm break-inside-avoid">
      
      {/* Botón de carga */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button
          type="button"
          variant="secondary"
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={keptImages.length + newImages.length >= 4}
          className="bg-white border hover:bg-slate-50 text-blue-700"
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          {keptImages.length + newImages.length === 0 ? "Agregar Evidencia" : "Agregar más"}
        </Button>
        <span className="text-xs text-muted-foreground">Máx 4 imágenes. (.jpg, .png)</span>
        <Input
          id="file-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Grid de Imágenes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        
        {/* 1. Imágenes YA GUARDADAS (Borde Azul) */}
        {keptImages.map((img, index) => (
          <div key={`old-${index}`} className="relative bg-white p-2 rounded-md border border-blue-200 shadow-sm">
            <div className="absolute -top-2 -left-2 bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold z-10 border border-blue-200">
              GUARDADA
            </div>
            <div className="relative aspect-video rounded overflow-hidden bg-slate-100 mb-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="Guardada" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => removeOldImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600 transition-opacity"
                title="Borrar imagen guardada"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Input 
              placeholder="Descripción..." 
              value={img.desc}
              onChange={(e) => updateOldDesc(index, e.target.value)}
              className="text-sm h-8"
            />
          </div>
        ))}

        {/* 2. Imágenes NUEVAS (Borde Verde) */}
        {newImages.map((img, index) => (
          <div key={`new-${index}`} className="relative bg-white p-2 rounded-md border border-green-300 shadow-sm">
             <div className="absolute -top-2 -left-2 bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-bold z-10 border border-green-200">
              NUEVA
            </div>
            <div className="relative aspect-video rounded overflow-hidden bg-slate-100 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="Nueva" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => removeNewImage(index)}
                className="absolute top-2 right-2 bg-slate-500 text-white p-1.5 rounded-full shadow hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input 
              placeholder="Descripción..." 
              value={img.desc}
              onChange={(e) => updateNewDesc(index, e.target.value)}
              className="text-sm h-8"
            />
          </div>
        ))}
      </div>

      {keptImages.length === 0 && newImages.length === 0 && (
        <div className="h-24 border-2 border-dashed border-blue-200 rounded flex flex-col items-center justify-center text-blue-300 bg-white/50 mt-2">
            <ImageIcon className="h-8 w-8 mb-1" />
            <span className="text-xs">Sin imágenes</span>
        </div>
      )}
    </div>
  );
}
