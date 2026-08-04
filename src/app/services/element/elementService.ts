import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TipoElemento, RadioBase, Abonado, Oficina, Agente, Estado } from '../../models/gis';
import { CoordService } from '../coord/coordService';
import { GeocodingService } from '../gis/geocodingService';
import { GisMathService } from '../gis/gisMathService';
import { environment } from '../../../environments/environment';
import { ToastService } from '../toast/toastService';
import * as L from 'leaflet';

@Injectable({ providedIn: 'root' })
export class ElementService {
  private http = inject(HttpClient);
  private coord = inject(CoordService);
  private geocoding = inject(GeocodingService);
  private mathService = inject(GisMathService);
  private toastService = inject(ToastService);
  private API_URL = environment.apiUrl;

  // Signals de datos
  estadosSignal = signal<Estado[]>([]);
  radioBasesSignal = signal<RadioBase[]>([]);
  oficinasSignal = signal<Oficina[]>([]);
  abonadosSignal = signal<Abonado[]>([]);
  agentesSignal = signal<Agente[]>([]);
  resumenSignal = signal<any[]>([]); // Almacena el resumen agregado del servidor

  parroquiasDataSignal = signal<any>(null);
  get parroquiasData() { return this.parroquiasDataSignal(); }

  constructor() {
    this.cargarDesdeCache();
    this.cargarParroquiasGeoJson();
  }

  private cargarParroquiasGeoJson() {
    this.http.get('assets/geojson/parroquias.json').subscribe({
      next: (data: any) => {
        this.parroquiasDataSignal.set(data);
        // Re-procesar datos si ya se habían cargado desde la caché
        const cachedElements = localStorage.getItem('geoproyect_elements_cache');
        if (cachedElements) {
          try {
            this.procesarDatos(JSON.parse(cachedElements));
          } catch (e) { }
        }
      },
      error: (err) => console.error('Error cargando parroquias.json en ElementService:', err)
    });
  }

  private normalizeName(str: string): string {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  private findParroquiaForCoords(lat: number, lng: number, estado?: string): { name: string, municipio: string } | null {
    const data = this.parroquiasDataSignal();
    if (!data) return null;
    
    const targetEstadoNorm = estado ? this.normalizeName(estado) : '';

    // Primer intento: Búsqueda espacial punto en polígono
    for (const feature of data.features) {
      if (targetEstadoNorm) {
        const estNorm = this.normalizeName(feature.properties.adm1_name || '');
        if (estNorm !== targetEstadoNorm) continue;
      }
      
      const geom = feature.geometry;
      if (!geom) continue;
      
      const pName = feature.properties.adm3_name;
      const mName = feature.properties.adm2_name;

      const pointInPoly = (ring: number[][]) => {
        const vertices = ring.map(coord => L.latLng(coord[1], coord[0]));
        return this.mathService.puntoEnPoligono(lat, lng, vertices);
      };

      try {
        if (geom.type === 'Polygon') {
          if (pointInPoly(geom.coordinates[0])) return { name: pName, municipio: mName };
        } else if (geom.type === 'MultiPolygon') {
          for (const poly of geom.coordinates) {
            if (pointInPoly(poly[0])) return { name: pName, municipio: mName };
          }
        }
      } catch (e) {
        console.error('Error al evaluar punto en polígono:', e);
      }
    }

    // Si no se encontró en el estado objetivo, verificamos si las coordenadas caen en CUALQUIER OTRO estado.
    // Esto ayuda a detectar mismatches de estado en la base de datos (ej. coordenadas en Miranda pero estado Bolívar).
    let detectadoEnOtroEstado = false;
    for (const feature of data.features) {
      const estNorm = this.normalizeName(feature.properties.adm1_name || '');
      if (targetEstadoNorm && estNorm === targetEstadoNorm) continue;

      const geom = feature.geometry;
      if (!geom) continue;

      const pointInPoly = (ring: number[][]) => {
        const vertices = ring.map(coord => L.latLng(coord[1], coord[0]));
        return this.mathService.puntoEnPoligono(lat, lng, vertices);
      };

      try {
        let inside = false;
        if (geom.type === 'Polygon') {
          inside = pointInPoly(geom.coordinates[0]);
        } else if (geom.type === 'MultiPolygon') {
          for (const poly of geom.coordinates) {
            if (pointInPoly(poly[0])) {
              inside = true;
              break;
            }
          }
        }
        if (inside) {
          detectadoEnOtroEstado = true;
          break;
        }
      } catch (e) {}
    }

    if (detectadoEnOtroEstado) {
      return null;
    }

    // Fallback por cercanía dentro del mismo estado (evita pérdidas por simplificación de bordes)
    if (estado) {
      let closestPar: { name: string, municipio: string } | null = null;
      let minDistance = Infinity;
      const p = L.latLng(lat, lng);

      for (const feature of data.features) {
        const estNorm = this.normalizeName(feature.properties.adm1_name || '');
        if (estNorm !== targetEstadoNorm) continue;

        const cLat = feature.properties.center_lat;
        const cLon = feature.properties.center_lon;
        if (cLat !== undefined && cLon !== undefined) {
          const center = L.latLng(cLat, cLon);
          const dist = p.distanceTo(center);
          if (dist < minDistance) {
            minDistance = dist;
            closestPar = { name: feature.properties.adm3_name, municipio: feature.properties.adm2_name };
          }
        }
      }
      // Limitar a una distancia razonable (150 km) para evitar emparejamientos erráticos a larga distancia
      if (closestPar && minDistance < 150000) return closestPar;
    }

    return null;
  }

  private procesarDatos(rawData: any[]) {
    const mapped = rawData.map(item => {
      if (item.latitud && item.longitud) {
        const pInfo = this.findParroquiaForCoords(Number(item.latitud), Number(item.longitud), item.estado);
        if (pInfo) {
          item.parroquia = pInfo.name;
          item.municipio = pInfo.municipio;
        }
      }
      return item;
    });

    this.radioBasesSignal.set(mapped.filter(i => i.tipo === 'antenas'));
    this.oficinasSignal.set(mapped.filter(i => i.tipo === 'oficinas'));
    this.abonadosSignal.set(mapped.filter(i => i.tipo === 'abonados'));
    this.agentesSignal.set(mapped.filter(i => i.tipo === 'agentes'));
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
        const states = JSON.parse(cachedStates);
        const corrected = states.map((s: any) => {
          if (!s.latitud || !s.longitud) {
            const coords = this.coord.getCoordEstado(s.nombre);
            if (coords) {
              s.latitud = coords.lat;
              s.longitud = coords.lng;
            }
          }
          return s;
        });
        this.estadosSignal.set(corrected);
        console.log('[Cache] Estados cargados y corregidos desde almacenamiento local.');
      } catch (e) { }
    }
  }

  // Carga geográfica
  cargarConfiguracionGeografica() {
    if (!localStorage.getItem('token_geo')) {
      return;
    }
    this.http.get<any[]>(`${this.API_URL}/geo/estados`).subscribe({
      next: (data) => {
        const mapeados = data.map(e => {
          const nombreEstado = e.nombre_estado || e.nombre;
          const nombreRegion = e.region_nombre || e.nombre_region;
          const coords = this.coord.getCoordEstado(nombreEstado);
          
          return {
            ...e,
            nombre: nombreEstado,
            nombre_region: nombreRegion,
            color_region: e.color_region || this.coord.getColorRegion(nombreRegion),
            color_estado: e.color_estado || e.color_region || this.coord.getColorRegion(nombreRegion),
            latitud: coords ? coords.lat : 0,
            longitud: coords ? coords.lng : 0
          };
        });
        this.estadosSignal.set(mapeados);
        localStorage.setItem('geoproyect_states_cache', JSON.stringify(mapeados));
      },
      error: (err) => console.error('Error cargando estados:', err)
    });
  }

  // Carga de elementos desde la API
  private reparandoEnBackground = false;

  cargarDatos() {
    if (!localStorage.getItem('token_geo')) {
      return;
    }
    this.http.get<any[]>(`${this.API_URL}/elementos/listado`).subscribe({
      next: (data) => {
        let rawData = data || [];
        rawData = rawData.map((e: any) => ({
          ...e,
          estado: e.estado_nombre || e.estado,
          region: e.region_nombre || e.region,
          latitud: Number(e.latitud) || 0,
          longitud: Number(e.longitud) || 0
        }));
        this.procesarDatos(rawData);
        localStorage.setItem('geoproyect_elements_cache', JSON.stringify(rawData));

        // Disparar reparación automática silenciosa si es necesario
        if (!this.reparandoEnBackground) {
          this.repararCoordenadasSilencioso();
        }
        
        // Cargar también el resumen agregado
        this.cargarResumen();
      },
      error: (err) => {
        console.error('Error al cargar datos desde la API:', err);
        // Si hay error de red, mantenemos los datos de caché si existen
      }
    });
  }

  cargarResumen() {
    if (!localStorage.getItem('token_geo')) {
      return;
    }
    this.http.get<any[]>(`${this.API_URL}/elementos/resumen`).subscribe({
      next: (data) => this.resumenSignal.set(data || []),
      error: (err) => console.error('Error cargando resumen:', err)
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
            await this.http.put(`${this.API_URL}/elementos/actualizar/${item.id}`, coords).toPromise();
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
    this.resumenSignal()
      .filter(r => r.tipo === tipo)
      .forEach(r => {
        m.set(r.estado, (m.get(r.estado) || 0) + Number(r.total));
      });
    return m;
  }

  getTotalesPorRegion(tipo: TipoElemento): Map<string, number> {
    const m = new Map<string, number>();
    this.resumenSignal()
      .filter(r => r.tipo === tipo)
      .forEach(r => {
        m.set(r.region, (m.get(r.region) || 0) + Number(r.total));
      });
    return m;
  }

  getTotalesPorParroquia(tipo: TipoElemento): Map<string, number> {
    const m = new Map<string, number>();
    const items = this.getDataPorTipo(tipo);
    items.forEach(item => {
      if (item.parroquia && item.estado) {
        const key = `${item.parroquia}_${item.estado}`;
        const qty = Number(item.cantidad) || 1;
        m.set(key, (m.get(key) || 0) + qty);
      }
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
    return this.http.post(`${this.API_URL}/elementos/crear`, data);
  }

  actualizarElemento(id: number, data: any) {
    return this.http.put(`${this.API_URL}/elementos/actualizar/${id}`, data);
  }

  eliminarElemento(id: number) {
    return this.http.put(`${this.API_URL}/elementos/desactivar/${id}`, {});
  }

  enviarAlServidor(datos: any) {
    this.http.post(`${this.API_URL}/elementos/crear`, datos).subscribe({
      next: () => this.toastService.showSuccess('Elemento guardado con éxito'),
      error: (err) => {
        console.error('Error al guardar:', err);
        this.toastService.showError('Error al guardar el elemento');
      }
    });
  }

  // Geocodificación (ahora delegada a GeocodingService)
  async obtenerCoordsDesdeDireccion(dir: string | null | undefined) {
    return this.geocoding.obtenerCoordsDesdeDireccion(dir);
  }

  // Llama al backend para filtrar espacialmente
  filtrarPorPoligonos(wkt: string) {
    return this.http.post<any[]>(`${this.API_URL}/elementos/filtrar-poligono`, { wkt });
  }
}
