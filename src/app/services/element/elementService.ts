import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TipoElemento, RadioBase, Abonado, Oficina, Agente, Estado } from '../../models/gis';
import { CoordService } from '../coord/coordService';
import { GeocodingService } from '../gis/geocodingService';

/**
 * ElementService — Principio SRP
 * Única responsabilidad: gestionar el ESTADO DE DATOS del sistema.
 * Sabe de la API, de los modelos y de los Mock Data. No sabe nada de colores ni de UI.
 */
@Injectable({ providedIn: 'root' })
export class ElementService {
  private http = inject(HttpClient);
  private coord = inject(CoordService);
  private geocoding = inject(GeocodingService);
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
        const coordsAuto = await this.geocoding.obtenerCoordsDesdeDireccion(nuevoItem.direccion);
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

  // Geocodificación (ahora delegada a GeocodingService)
  async obtenerCoordsDesdeDireccion(dir: string | null | undefined) {
    return this.geocoding.obtenerCoordsDesdeDireccion(dir);
  }
}
