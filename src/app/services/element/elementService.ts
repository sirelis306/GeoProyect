import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TipoElemento, RadioBase, Abonado, Oficina, Agente, Estado } from '../../models/gis';
import { CoordService } from '../coord/coordService';

/**
 * ElementService — Principio SRP
 * Única responsabilidad: gestionar el ESTADO DE DATOS del sistema.
 * Sabe de la API, de los modelos y de los Mock Data. No sabe nada de colores ni de UI.
 */
@Injectable({ providedIn: 'root' })
export class ElementService {
  private http = inject(HttpClient);
  private coord = inject(CoordService);
  private API_URL = 'http://localhost:3000/api';
  // private API_URL = 'https://geobackend-api.onrender.com/api';

  // Signals de datos
  estadosSignal = signal<Estado[]>([]);
  radioBasesSignal = signal<RadioBase[]>([]);
  oficinasSignal = signal<Oficina[]>([]);
  abonadosSignal = signal<Abonado[]>([]);
  agentesSignal = signal<Agente[]>([]);

  // Carga geográfica
  cargarConfiguracionGeografica() {
    this.http.get<Estado[]>(`${this.API_URL}/estados`).subscribe({
      next: (data) => this.estadosSignal.set(data),
      error: (err) => console.error('Error cargando estados:', err)
    });
  }

  // Carga de elementos desde la API
  cargarDatos() {
    this.http.get<any[]>(`${this.API_URL}/elementos`).subscribe({
      next: (data) => {
        const rawData = data || [];
        this.radioBasesSignal.set(rawData.filter(i => i.tipo === 'antenas'));
        this.oficinasSignal.set(rawData.filter(i => i.tipo === 'oficinas'));
        this.abonadosSignal.set(rawData.filter(i => i.tipo === 'abonados'));
        this.agentesSignal.set(rawData.filter(i => i.tipo === 'agentes'));
      },
      error: (err) => {
        console.error('Error al cargar datos desde la API:', err);
        // Limpiamos señales en caso de error para evitar datos residuales
        this.radioBasesSignal.set([]);
        this.oficinasSignal.set([]);
        this.abonadosSignal.set([]);
        this.agentesSignal.set([]);
      }
    });
  }

  // Helpers de datos
  getDataPorTipo(tipo: TipoElemento): any[] {
    switch (tipo) {
      case 'antenas': return this.radioBasesSignal();
      case 'abonados': return this.abonadosSignal();
      case 'oficinas': return this.oficinasSignal();
      case 'agentes': return this.agentesSignal();
      default: return [];
    }
  }

  getTotalesPorEstado(tipo: TipoElemento): Map<string, number> {
    const m = new Map<string, number>();
    this.getDataPorTipo(tipo).forEach((item: any) => {
      const cantidad = Number(item.cantidad);
      const val = !isNaN(cantidad) ? cantidad : 1;
      m.set(item.estado, (m.get(item.estado) || 0) + val);
    });
    return m;
  }

  getTotalesPorRegion(tipo: TipoElemento): Map<string, number> {
    const m = new Map<string, number>();
    this.getDataPorTipo(tipo).forEach((item: any) => {
      const cantidad = Number(item.cantidad);
      const val = !isNaN(cantidad) ? cantidad : 1;
      m.set(item.region, (m.get(item.region) || 0) + val);
    });
    return m;
  }

  // Agregar elemento
  async construirYValidarElemento(tipoEdicion: TipoElemento, nuevoItem: any, obtenerRegion: (e: string) => string): Promise<any> {
    const itemFinal: any = {
      estado: nuevoItem.estado,
      region: obtenerRegion(nuevoItem.estado),
      tipo: tipoEdicion,
      direccion: nuevoItem.direccion || '',
      cantidad: Number(nuevoItem.cantidad) || 0
    };

    if (tipoEdicion === 'antenas' || tipoEdicion === 'agentes') {
      let lat = nuevoItem.latitud;
      let lng = nuevoItem.longitud;

      if (!lat || !lng) {
        const coordsAuto = await this.obtenerCoordsDesdeDireccion(nuevoItem.direccion);
        if (coordsAuto) {
          lat = coordsAuto.lat; lng = coordsAuto.lng;
        } else {
          const c = this.coord.getCoordEstado(nuevoItem.estado);
          const jitter = () => (Math.random() - 0.5) * 0.04;
          lat = c ? c.lat + jitter() : 0;
          lng = c ? c.lng + jitter() : 0;
        }
      }

      itemFinal.nombre = nuevoItem.nombre;
      itemFinal.latitud = Number(lat);
      itemFinal.longitud = Number(lng);
      itemFinal.cantidad = 1;

      if (tipoEdicion === 'antenas') {
        itemFinal.tecnologia = (nuevoItem.tecnologia || []).join(' / ') || 'LTE';
        itemFinal.actividad = nuevoItem.actividad || 'Operativa';
      } else {
        itemFinal.codigoDealer = nuevoItem.codigoDealer;
        itemFinal.clasificacion = nuevoItem.clasificacion;
        itemFinal.tecnologia = null;
        itemFinal.actividad = null;
      }
    } else {
      const c = this.coord.getCoordEstado(nuevoItem.estado);
      itemFinal.latitud = c ? c.lat : 0;
      itemFinal.longitud = c ? c.lng : 0;

      if (tipoEdicion === 'abonados') {
        itemFinal.segmentacion = nuevoItem.segmentacion_elegida || '4G';
        itemFinal.nombre = `Abonados ${itemFinal.segmentacion} ${nuevoItem.estado}`;
      } else {
        itemFinal.nombre = `${tipoEdicion.toUpperCase()} - ${nuevoItem.estado}`;
        itemFinal.segmentacion = null;
      }
      itemFinal.tecnologia = null;
      itemFinal.actividad = null;
    }

    if (!itemFinal.estado || itemFinal.cantidad < 0)
      throw new Error('Por favor, seleccione un estado válido.');

    return itemFinal;
  }

  agregarElemento(tipo: TipoElemento, data: any) {
    return this.http.post(`${this.API_URL}/elementos`, data);
  }

  enviarAlServidor(datos: any) {
    this.http.post(`${this.API_URL}/elementos`, datos).subscribe({
      next: () => alert('Elemento guardado con éxito'),
      error: (err) => console.error('Error al guardar:', err)
    });
  }

  // Geocodificación
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
        if (res && res.length > 0)
          return { lat: parseFloat(res[0].lat), lng: parseFloat(res[0].lon) };
      } catch { /* continúa */ }

      if (i < maxIntentos - 1)
        await new Promise(r => setTimeout(r, 300));
    }
    return null;
  }

  private limpiarDireccionParaBusqueda(dir: string): string {
    const ruidos = [
      /LOCAL\s+(NRO\.?|N°?|NUMERO)?\s*\d+/gi, /NIVEL\s+\w+/gi, /PISO\s+\d+/gi,
      /PB/gi, /P\.B/gi, /EDIFICIO\s+\w+/gi, /EDIF\.\s+\w+/gi,
      /APT\s+\d+/gi, /APTO\s+\d+/gi, /C.C\s+\w+/gi, /CENTRO COMERCIAL\s+\w+/gi,
      /BASEMENT/gi, /PLANTA BAJA/gi, /ESTADO\s+/gi
    ];
    let limpia = dir.toUpperCase();
    ruidos.forEach(r => { limpia = limpia.replace(r, ''); });
    return limpia.replace(/, ,/g, ',').replace(/\s+/g, ' ').trim();
  }
}
