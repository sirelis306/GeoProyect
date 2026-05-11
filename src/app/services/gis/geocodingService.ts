import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout, catchError } from 'rxjs/operators';
import { of, lastValueFrom } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);

  /* Obtiene coordenadas (lat, lng) desde una dirección de texto usando OpenStreetMap (Nominatim). */
  async obtenerCoordsDesdeDireccion(direccion: string | null | undefined): Promise<{ lat: number; lng: number } | null> {
    if (!direccion) return null;

    const limpia = this.limpiarDireccionParaBusqueda(direccion);
    const pais = 'Venezuela';
    const maxIntentos = 2;

    for (let i = 0; i < maxIntentos; i++) {
      let queryActual = i === 0 ? limpia : direccion;
      
      // Si la dirección es muy larga en el segundo intento, intentar simplificarla más
      if (i === 1 && queryActual.length > 80) {
        queryActual = queryActual.split(',').slice(0, 2).join(',') + `, ${pais}`;
      }

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryActual)}, ${pais}`;
        // Usar lastValueFrom y timeout para evitar que la app se cuelgue si OSM no responde
        const res: any = await lastValueFrom(
          this.http.get(url).pipe(
            timeout(12000), // 12 segundos de timeout
            catchError(err => {
              console.warn('Timeout o error de red en Geocoding. Saltando al siguiente intento.');
              return of(null);
            })
          )

        );

        if (res && res.length > 0) {
          return { lat: parseFloat(res[0].lat), lng: parseFloat(res[0].lon) };
        }
      } catch (err) {
        // Error silencioso, pasamos al siguiente intento
      }

      if (i < maxIntentos - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // FALLBACK: Si todo lo anterior falló, intentar solo con Municipio y Estado
    try {
      const partes = direccion.split(',');
      const fallbackQuery = partes.slice(-2).join(',') + `, ${pais}`; // Toma los últimos dos elementos (usualmente Municipio/Estado)
      const urlFallback = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}`;
      const resFallback: any = await lastValueFrom(
        this.http.get(urlFallback).pipe(timeout(5000), catchError(() => of(null)))
      );
      if (resFallback && resFallback.length > 0) {
        console.log(`Ubicación aproximada encontrada para: ${direccion}`);
        return { lat: parseFloat(resFallback[0].lat), lng: parseFloat(resFallback[0].lon) };
      }
    } catch (e) {}

    return null;

  }

  /* Limpia ruidos comunes en direcciones para mejorar la búsqueda en OSM. */
  private limpiarDireccionParaBusqueda(dir: string): string {
    const ruidos = [
      /LOCAL\s+(NRO\.?|N°?|NUMERO)?\s*\d+/gi,
      /NIVEL\s+\w+/gi,
      /PISO\s+\d+/gi,
      /PB/gi,
      /P\.B/gi,
      /EDIFICIO\s+\w+/gi,
      /EDIF\.\s+\w+/gi,
      /APT\s+\d+/gi,
      /APTO\s+\d+/gi,
      /C.C\s+\w+/gi,
      /CENTRO COMERCIAL\s+\w+/gi,
      /BASEMENT/gi,
      /PLANTA BAJA/gi,
      /ESTADO\s+/gi,
      /A\s+\d+\s*MTS?\s+DE\s+L[OA]\s+.+/gi, 
      /CERCA\s+DE\s+.+/gi,
      /LOCAL\s+S\/N/gi,
      /S\/N/gi,
      /\(.*?\)/g // Eliminar contenido entre paréntesis

    ];

    let limpia = dir.toUpperCase();
    ruidos.forEach(r => { limpia = limpia.replace(r, ''); });
    return limpia.replace(/, ,/g, ',').replace(/\s+/g, ' ').trim();
  }
}
