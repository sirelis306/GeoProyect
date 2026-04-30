import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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
      const queryActual = i === 0 ? limpia : direccion;
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryActual)}, ${pais}`;
        const res: any = await this.http.get(url).toPromise();
        if (res && res.length > 0) {
          return { lat: parseFloat(res[0].lat), lng: parseFloat(res[0].lon) };
        }
      } catch (err) {
        console.warn(`Intento ${i + 1} de geocodificación fallido:`, err);
      }

      if (i < maxIntentos - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
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
      /ESTADO\s+/gi
    ];

    let limpia = dir.toUpperCase();
    ruidos.forEach(r => { limpia = limpia.replace(r, ''); });
    return limpia.replace(/, ,/g, ',').replace(/\s+/g, ' ').trim();
  }
}
