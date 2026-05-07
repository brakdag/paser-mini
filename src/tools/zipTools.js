import JSZip from 'jszip';
import fs from 'fs/promises';
import path from 'path';

// Almacén en memoria para contenedores ZIP activos
const activeZips = new Map();

export const loadZip = async ({ filePath }) => {
  try {
    const data = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(data);
    const zipId = `zip_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    activeZips.set(zipId, zip);
    return JSON.stringify({ zipId, message: `Contenedor cargado exitosamente desde ${filePath}` });
  } catch (e) {
    return `ERR: Error cargando ZIP: ${e.message}`;
  }
};

export const readZipFile = async ({ zipId, internalPath }) => {
  try {
    const zip = activeZips.get(zipId);
    if (!zip) return 'ERR: No se encontró un contenedor activo con ese zipId';
    
    const file = zip.file(internalPath);
    if (!file) return 'ERR: El archivo no existe dentro del contenedor';
    
    const content = await file.async('string');
    return JSON.stringify({ internalPath, content });
  } catch (e) {
    return `ERR: Error leyendo archivo interno: ${e.message}`;
  }
};

export const writeZipFile = async ({ zipId, internalPath, content }) => {
  try {
    const zip = activeZips.get(zipId);
    if (!zip) return 'ERR: No se encontró un contenedor activo con ese zipId';
    
    zip.file(internalPath, content);
    return JSON.stringify({ internalPath, message: 'Archivo actualizado en RAM' });
  } catch (e) {
    return `ERR: Error escribiendo archivo interno: ${e.message}`;
  }
};

export const saveZip = async ({ zipId, outputPath }) => {
  try {
    const zip = activeZips.get(zipId);
    if (!zip) return 'ERR: No se encontró un contenedor activo con ese zipId';
    
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.writeFile(outputPath, content);
    
    // Limpiamos la memoria después de guardar
    activeZips.delete(zipId);
    
    return JSON.stringify({ outputPath, message: 'Contenedor guardado exitosamente en disco' });
  } catch (e) {
    return `ERR: Error guardando ZIP: ${e.message}`;
  }
};

export const listZipFiles = async ({ zipId }) => {
  try {
    const zip = activeZips.get(zipId);
    if (!zip) return 'ERR: No se encontró un contenedor activo con ese zipId';
    
    const files = Object.keys(zip.files);
    return JSON.stringify({ files });
  } catch (e) {
    return `ERR: Error listando archivos: ${e.message}`;
  }
};