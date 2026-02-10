'use client';

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Image as ImageIcon, UploadCloud } from "lucide-react";

interface ImageUploaderProps {
  onImagesChange: (files: File[], descriptions: string[]) => void;
  initialImages?: string[];
  initialDescriptions?: string[];
}

export function ImageUploader({ 
  onImagesChange, 
  initialImages = [], 
  initialDescriptions = [] 
}: ImageUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);

  // NOTA: Para este caso simple, no cargamos visualmente las imágenes iniciales en el editor
  // para evitar mezclar lógica de "borrar existente" vs "borrar nueva".
  // Solo se manejan las nuevas cargas.

  useEffect(() => {
    return () => previews.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
  }, [previews]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const totalImages = selectedFiles.length + newFiles.length;
      
      if (totalImages > 3) {
        alert("Máximo 3 imágenes permitidas.");
        return;
      }

      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
      const newDescriptions = newFiles.map(() => ""); 

      const updatedFiles = [...selectedFiles, ...newFiles];
      const updatedPreviews = [...previews, ...newPreviews];
      const updatedDescriptions = [...descriptions, ...newDescriptions];
      
      setSelectedFiles(updatedFiles);
      setPreviews(updatedPreviews);
      setDescriptions(updatedDescriptions);
      
      onImagesChange(updatedFiles, updatedDescriptions);
    }
  };

  const handleDescriptionChange = (index: number, text: string) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = text;
    setDescriptions(newDescriptions);
    onImagesChange(selectedFiles, newDescriptions);
  };

  const removeImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    const newDescriptions = descriptions.filter((_, i) => i !== index);
    
    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
    setDescriptions(newDescriptions);
    onImagesChange(newFiles, newDescriptions);
  };

  return (
    <div className="border rounded-lg p-4 bg-blue-50/50 shadow-sm break-inside-avoid">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={previews.length >= 3}
          className="w-full sm:w-auto bg-white border hover:bg-slate-50"
        >
          <UploadCloud className="mr-2 h-4 w-4 text-blue-600" />
          {previews.length === 0 ? "Agregar Evidencia" : "Agregar más"}
        </Button>
        <div className="text-xs text-muted-foreground">
            <p>Formatos: .jpg, .png, .webp</p>
            <p>Máximo 3 imágenes.</p>
        </div>
        <Input
          id="file-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={previews.length >= 3}
        />
      </div>

      {previews.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {previews.map((src, index) => (
            <div key={index} className="relative bg-white p-2 rounded-md border border-blue-200 shadow-sm">
              <div className="relative aspect-video rounded overflow-hidden bg-slate-100 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={src} 
                  alt={`Preview ${index}`} 
                  className="w-full h-full object-contain" 
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md z-10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Input 
                placeholder="Descripción (Ej: Desgaste en flanco)" 
                value={descriptions[index]}
                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                className="text-sm h-8"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-24 border-2 border-dashed border-blue-200 rounded flex flex-col items-center justify-center text-blue-300 bg-white/50">
            <ImageIcon className="h-8 w-8 mb-1" />
            <span className="text-xs">Sin imágenes seleccionadas</span>
        </div>
      )}
    </div>
  );
}