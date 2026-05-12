import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout, catchError } from 'rxjs/operators';
import { of, lastValueFrom } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);
  private API_URL = 'http://localhost:3000/api'; // Cambiar a tu URL de API si es distinta en prod

  /* Obtiene coordenadas (lat, lng) desde el Proxy de nuestro Backend para evitar CORS. */
  async obtenerCoordsDesdeDireccion(direccion: string | null | undefined): Promise<{ lat: number; lng: number } | null> {
    if (!direccion) return null;

    const limpia = this.limpiarDireccionParaBusqueda(direccion);
    const maxIntentos = 2;

    for (let i = 0; i < maxIntentos; i++) {
      let queryActual = i === 0 ? limpia : direccion;
      
      if (i === 1 && queryActual.length > 80) {
        queryActual = queryActual.split(',').slice(0, 2).join(',');
      }

      try {
        // Llamamos a NUESTRA API (Proxy) en lugar de directamente a OSM
        const url = `${this.API_URL}/geocode?q=${encodeURIComponent(queryActual)}`;
        
        const res: any = await lastValueFrom(
          this.http.get(url).pipe(
            timeout(15000), // Más tiempo de margen para el proxy
            catchError(err => {
              console.warn('Error en el Proxy de Geocoding. Saltando al siguiente intento.');
              return of(null);
            })
          )
        );

        if (res && res.length > 0) {
          return { lat: parseFloat(res[0].lat), lng: parseFloat(res[0].lon) };
        }
      } catch (err) {
        // Error silencioso
      }

      if (i < maxIntentos - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return null;
  }

  /* Limpia ruidos comunes en direcciones para mejorar la búsqueda. */
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
