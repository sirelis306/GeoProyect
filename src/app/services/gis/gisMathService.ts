import { Injectable } from '@angular/core';
import * as L from 'leaflet';

@Injectable({ providedIn: 'root' })
export class GisMathService {

  /**
   * Comprueba si un punto (lat, lng) está dentro de un círculo.
   * Utiliza la distancia entre los dos puntos.
   */
  puntoEnCirculo(lat: number, lng: number, centro: L.LatLng, radioMetros: number): boolean {
    const p = L.latLng(lat, lng);
    return p.distanceTo(centro) <= radioMetros;
  }

  /**
   * Convierte un array de vértices a formato MULTIPOLYGON de WKT.
   * Solo considera polígonos. Los círculos se aproximan a polígonos si se desea, 
   * pero aquí asumiremos Polígonos de Leaflet.
   */
  figurasToWKT(figuras: {tipo: string, layer: L.Layer}[]): string | null {
    const poligonos = figuras.filter(f => f.tipo === 'poligono');
    if (poligonos.length === 0) return null;

    const wktPolygons = poligonos.map(f => {
      const p = f.layer as L.Polygon;
      const latlngs = (p.getLatLngs()[0] as L.LatLng[]);
      // El formato WKT es LONGITUD LATITUD
      let coords = latlngs.map(ll => `${ll.lng} ${ll.lat}`);
      // Asegurarse de cerrar el polígono
      if (coords[0] !== coords[coords.length - 1]) {
        coords.push(coords[0]);
      }
      return `((${coords.join(', ')}))`;
    });

    return `MULTIPOLYGON(${wktPolygons.join(', ')})`;
  }

  /**
   * Comprueba si un punto (lat, lng) está dentro de un polígono delimitado por sus vértices.
   * Utiliza el algoritmo de Ray-Casting (PNPOLY).
   */
  puntoEnPoligono(lat: number, lng: number, vertices: L.LatLng[]): boolean {
    let dentro = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].lng, yi = vertices[i].lat;
      const xj = vertices[j].lng, yj = vertices[j].lat;
      
      const intersecta = ((yi > lat) !== (yj > lat))
          && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersecta) dentro = !dentro;
    }
    return dentro;
  }

  /**
   * Calcula el área de un polígono esférico aproximado proyectándolo en un plano plano local.
   * Utiliza el algoritmo de Shoelace. Retorna el valor en metros cuadrados (m²).
   */
  calcularAreaPoligono(vertices: L.LatLng[]): number {
    const R = 6378137; // Radio ecuatorial de la Tierra en metros
    let area = 0;
    
    if (vertices.length > 2) {
      for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        
        // Conversión a coordenadas planas usando proyección cilíndrica equidistante local
        const x1 = p1.lng * Math.PI / 180 * R * Math.cos(p1.lat * Math.PI / 180);
        const y1 = p1.lat * Math.PI / 180 * R;
        const x2 = p2.lng * Math.PI / 180 * R * Math.cos(p2.lat * Math.PI / 180);
        const y2 = p2.lat * Math.PI / 180 * R;
        
        area += (x1 * y2) - (x2 * y1);
      }
      area = Math.abs(area / 2);
    }
    return area;
  }

  /**
   * Calcula el perímetro de un polígono sumando las distancias entre vértices.
   * Retorna el perímetro en metros.
   */
  calcularPerimetroPoligono(vertices: L.LatLng[]): number {
    let perimetro = 0;
    if (vertices.length > 1) {
      for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        perimetro += p1.distanceTo(p2);
      }
    }
    return perimetro;
  }

  /**
   * Calcula la longitud total de una polilínea (ruta).
   * Retorna la longitud en metros.
   */
  calcularLongitudRuta(vertices: L.LatLng[]): number {
    let longitud = 0;
    if (vertices.length > 1) {
      for (let i = 0; i < vertices.length - 1; i++) {
        longitud += vertices[i].distanceTo(vertices[i + 1]);
      }
    }
    return longitud;
  }

  /**
   * Calcula el rumbo inicial (bearing) en grados (0° a 360°) entre dos puntos.
   */
  calcularRumboInicial(p1: L.LatLng, p2: L.LatLng): number {
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const rumbo = Math.atan2(y, x) * 180 / Math.PI;
    return (rumbo + 360) % 360;
  }

  /**
   * Convierte un rumbo en grados a su correspondiente sigla de dirección cardinal / intercardinal.
   */
  obtenerDireccionCardinal(rumbo: number): string {
    const direcciones = ['Norte (N)', 'Nordeste (NE)', 'Este (E)', 'Sudeste (SE)', 'Sur (S)', 'Sudoeste (SO)', 'Oeste (O)', 'Noroeste (NO)', 'Norte (N)'];
    const index = Math.round(rumbo / 45);
    return direcciones[index];
  }

  /**
   * Comprueba si un punto (lat, lng) está a menos de maxDistanciaMetros de la ruta.
   */
  puntoCercaDeRuta(lat: number, lng: number, verticesRuta: L.LatLng[], maxDistanciaMetros: number): boolean {
    const p = L.latLng(lat, lng);
    for (let i = 0; i < verticesRuta.length - 1; i++) {
      const a = verticesRuta[i];
      const b = verticesRuta[i + 1];
      
      const d = this.distanciaPuntoASegmento(p, a, b);
      if (d <= maxDistanciaMetros) {
        return true;
      }
    }
    return false;
  }

  /**
   * Distancia perpendicular de un punto a un segmento AB.
   */
  private distanciaPuntoASegmento(p: L.LatLng, a: L.LatLng, b: L.LatLng): number {
    const l2 = Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2);
    if (l2 === 0) return p.distanceTo(a);
    
    let t = ((p.lng - a.lng) * (b.lng - a.lng) + (p.lat - a.lat) * (b.lat - a.lat)) / l2;
    t = Math.max(0, Math.min(1, t)); // Limitar proyección al segmento AB
    
    const proyeccion = L.latLng(
      a.lat + t * (b.lat - a.lat),
      a.lng + t * (b.lng - a.lng)
    );
    
    return p.distanceTo(proyeccion);
  }
}
