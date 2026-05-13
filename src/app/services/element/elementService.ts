import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TipoElemento, RadioBase, Abonado, Oficina, Agente, Estado } from '../../models/gis';
import { CoordService } from '../coord/coordService';
import { GeocodingService } from '../gis/geocodingService';

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

  constructor() {
    this.cargarDesdeCache();
  }

  private cargarDesdeCache() {
    const cachedElements = localStorage.getItem('geoproyect_elements_cache');
    const cachedStates = localStorage.getItem('geoproyect_states_cache');
    
    if (cachedElements) {
      try {
        this.procesarDatos(JSON.parse(cachedElements));
        console.log('[Cache] Elementos cargados desde almacenamiento local.');
      } catch (e) { }
    }
    
    if (cachedStates) {
      try {
        this.estadosSignal.set(JSON.parse(cachedStates));
        console.log('[Cache] Estados cargados desde almacenamiento local.');
      } catch (e) { }
    }
  }

  private procesarDatos(rawData: any[]) {
    this.radioBasesSignal.set(rawData.filter(i => i.tipo === 'antenas'));
    this.oficinasSignal.set(rawData.filter(i => i.tipo === 'oficinas'));
    this.abonadosSignal.set(rawData.filter(i => i.tipo === 'abonados'));
    this.agentesSignal.set(rawData.filter(i => i.tipo === 'agentes'));
  }

  // Carga geográfica
  cargarConfiguracionGeografica() {
    this.http.get<Estado[]>(`${this.API_URL}/estados`).subscribe({
      next: (data) => {
        this.estadosSignal.set(data);
        localStorage.setItem('geoproyect_states_cache', JSON.stringify(data));
      },
      error: (err) => console.error('Error cargando estados:', err)
    });
  }

  // Carga de elementos desde la API
  private reparandoEnBackground = false;

  cargarDatos() {
    this.http.get<any[]>(`${this.API_URL}/elementos`).subscribe({
      next: (data) => {
        const rawData = data || [];
        this.procesarDatos(rawData);
        localStorage.setItem('geoproyect_elements_cache', JSON.stringify(rawData));

        // Disparar reparación automática silenciosa si es necesario
        if (!this.reparandoEnBackground) {
          this.repararCoordenadasSilencioso();
        }
      },
      error: (err) => {
        console.error('Error al cargar datos desde la API:', err);
        // Si hay error de red, mantenemos los datos de caché si existen
      }
    });
  }

  private async repararCoordenadasSilencioso() {
    this.reparandoEnBackground = true;
    const todos = [...this.radioBasesSignal(), ...this.agentesSignal(), ...this.oficinasSignal(), ...this.abonadosSignal()];
    const faltantes = todos.filter(item => (!item.latitud || !item.longitud || Number(item.latitud) === 0) && item.direccion);

    if (faltantes.length > 0) {
      console.log(`[Background] Geocodificando ${faltantes.length} elementos faltantes...`);
      for (const item of faltantes) {
        const coords = await this.geocoding.obtenerCoordsDesdeDireccion(item.direccion);
        if (coords) {
          try {
            await this.http.put(`${this.API_URL}/elementos/${item.id}/coordenadas`, coords).toPromise();
            // Actualizar localmente para que aparezca en el mapa de inmediato
            item.latitud = coords.lat; item.longitud = coords.lng;
          } catch (e) { }
        }
        await new Promise(r => setTimeout(r, 1200)); // Respetar rate limit
      }
    }
    this.reparandoEnBackground = false;
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
    // 1. Validación básica de estado
    if (!nuevoItem.estado) throw new Error('Por favor, seleccione un estado.');

    const itemFinal: any = {
      estado: nuevoItem.estado,
      region: obtenerRegion(nuevoItem.estado),
      tipo: tipoEdicion,
      direccion: nuevoItem.direccion || '',
      cantidad: Number(nuevoItem.cantidad) || 0
    };

    // 2. Validación por tipo
    if (tipoEdicion === 'antenas' || tipoEdicion === 'agentes') {
      // Nombre obligatorio para estos tipos
      if (!nuevoItem.nombre) throw new Error('El nombre o razón social es obligatorio.');

      let lat = nuevoItem.latitud;
      let lng = nuevoItem.longitud;

      // Validación de Coordenadas / Dirección
      if (!lat || !lng) {
        if (!nuevoItem.direccion) {
          throw new Error('Debe ingresar las coordenadas o una dirección para ubicar el elemento.');
        }

        // Intentar geocodificar si hay dirección pero no coordenadas
        const coordsAuto = await this.geocoding.obtenerCoordsDesdeDireccion(nuevoItem.direccion);
        if (coordsAuto) {
          lat = coordsAuto.lat; lng = coordsAuto.lng;
        } else {
          throw new Error('No se pudo determinar la ubicación desde la dirección. Por favor, ingrese las coordenadas manualmente.');
        }
      }

      itemFinal.nombre = nuevoItem.nombre;
      itemFinal.latitud = Number(lat);
      itemFinal.longitud = Number(lng);
      itemFinal.cantidad = 1;

      if (tipoEdicion === 'antenas') {
        const orden = ['GSM', 'UMTS', 'LTE', 'NR'];
        itemFinal.tecnologia = orden
          .map(t => ((nuevoItem.tecnologia || []).includes(t) ? t : ''))
          .join(' / ');
        itemFinal.actividad = nuevoItem.actividad || 'Operativa';
      } else {
        // Validación de Código Dealer para Agentes
        if (!nuevoItem.codigoDealer) throw new Error('El Código Dealer es obligatorio para Agentes Autorizados.');
        itemFinal.codigoDealer = nuevoItem.codigoDealer;
        itemFinal.clasificacion = nuevoItem.clasificacion || 'AA';
      }
    } else {
      // Caso para Abonados y Oficinas
      const c = this.coord.getCoordEstado(nuevoItem.estado);
      itemFinal.latitud = c ? c.lat : 0;
      itemFinal.longitud = c ? c.lng : 0;

      if (tipoEdicion === 'abonados') {
        // Validación de Cantidad para Abonados
        if (!nuevoItem.cantidad || Number(nuevoItem.cantidad) <= 0) {
          throw new Error('Debe ingresar una cantidad de abonados válida (mayor a 0).');
        }
        itemFinal.segmentacion = nuevoItem.segmentacion_elegida || '4G';
        itemFinal.nombre = `Abonados ${itemFinal.segmentacion} ${nuevoItem.estado}`;
      } else {
        // Oficinas
        if (!nuevoItem.nombre) throw new Error('El nombre de la oficina es obligatorio.');
        itemFinal.nombre = nuevoItem.nombre;
      }
    }

    return itemFinal;
  }

  agregarElemento(tipo: TipoElemento, data: any) {
    return this.http.post(`${this.API_URL}/elementos`, data);
  }

  actualizarElemento(id: number, data: any) {
    return this.http.put(`${this.API_URL}/elementos/${id}`, data);
  }

  eliminarElemento(id: number) {
    return this.http.delete(`${this.API_URL}/elementos/${id}`);
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
