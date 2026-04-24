import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CoordService {

  /* Centros geográficos de cada estado */
  private readonly COORD_ESTADOS: Record<string, { lat: number; lng: number }> = {
    'Amazonas': { lat: 3.4167, lng: -65.5000 },
    'Anzoátegui': { lat: 9.3333, lng: -64.3333 },
    'Apure': { lat: 7.0000, lng: -69.0000 },
    'Aragua': { lat: 10.2500, lng: -67.2500 },
    'Barinas': { lat: 8.3333, lng: -70.0000 },
    'Bolívar': { lat: 6.0000, lng: -63.0000 },
    'Carabobo': { lat: 10.1620, lng: -68.0070 },
    'Cojedes': { lat: 9.1667, lng: -68.3333 },
    'Delta Amacuro': { lat: 8.5000, lng: -61.5000 },
    'Distrito Capital': { lat: 10.5000, lng: -66.9167 },
    'Falcón': { lat: 11.0000, lng: -70.0000 },
    'Guárico': { lat: 8.5000, lng: -66.5000 },
    'La Guaira': { lat: 10.6000, lng: -66.9333 },
    'Lara': { lat: 10.1667, lng: -69.6667 },
    'Mérida': { lat: 8.5000, lng: -71.1667 },
    'Miranda': { lat: 10.2500, lng: -66.5000 },
    'Monagas': { lat: 9.3333, lng: -63.0000 },
    'Nueva Esparta': { lat: 10.9833, lng: -63.9167 },
    'Portuguesa': { lat: 9.0000, lng: -69.2500 },
    'Sucre': { lat: 10.4167, lng: -63.5000 },
    'Táchira': { lat: 7.8333, lng: -72.1667 },
    'Trujillo': { lat: 9.4167, lng: -70.5000 },
    'Yaracuy': { lat: 10.3333, lng: -68.7500 },
    'Zulia': { lat: 10.3333, lng: -72.0000 },
  };

  /* Centros aproximados de cada región */
  private readonly COORD_REGIONES: Record<string, { lat: number; lng: number }> = {
    'Capital': { lat: 10.4806, lng: -66.8983 },
    'Central': { lat: 10.0000, lng: -68.0000 },
    'Los Llanos': { lat: 8.5000, lng: -67.0000 },
    'Centro Occidental': { lat: 10.0000, lng: -69.5000 },
    'Zuliana': { lat: 10.3333, lng: -72.0000 },
    'Los Andes': { lat: 8.5000, lng: -71.0000 },
    'Nororiental': { lat: 9.5000, lng: -64.0000 },
    'Insular': { lat: 10.9500, lng: -64.0000 },
    'Guayana': { lat: 6.0000, lng: -63.0000 },
  };

  /* Mapeo estático estado → región */
  readonly MAPEO_ESTADOS_REGIONES: Record<string, string> = {
    'Distrito Capital': 'Capital', 'Miranda': 'Capital', 'La Guaira': 'Capital',
    'Carabobo': 'Central', 'Aragua': 'Central', 'Cojedes': 'Central',
    'Guárico': 'Los Llanos', 'Apure': 'Los Llanos',
    'Falcón': 'Centro Occidental', 'Lara': 'Centro Occidental',
    'Portuguesa': 'Centro Occidental', 'Yaracuy': 'Centro Occidental',
    'Zulia': 'Zuliana',
    'Mérida': 'Los Andes', 'Táchira': 'Los Andes',
    'Trujillo': 'Los Andes', 'Barinas': 'Los Andes',
    'Anzoátegui': 'Nororiental', 'Monagas': 'Nororiental', 'Sucre': 'Nororiental',
    'Nueva Esparta': 'Insular', 'Dependencias Federales': 'Insular',
    'Bolívar': 'Guayana', 'Amazonas': 'Guayana', 'Delta Amacuro': 'Guayana',
  };

  /* Devuelve las coordenadas centrales de un estado */
  getCoordEstado(nombre: string): { lat: number; lng: number } | null {
    return this.COORD_ESTADOS[nombre] ?? null;
  }

  /* Devuelve las coordenadas centrales de una región */
  getCoordRegion(nombre: string): { lat: number; lng: number } | null {
    return this.COORD_REGIONES[nombre] ?? null;
  }

  /** Devuelve la región de un estado usando el mapeo estático */
  getRegionDeEstado(nombreEstado: string): string {
    return this.MAPEO_ESTADOS_REGIONES[nombreEstado] ?? '';
  }
}
