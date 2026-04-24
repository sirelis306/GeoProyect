import { inject, Injectable } from '@angular/core';
import { TipoElemento, CapasEstado } from '../../models/gis';
import { CoordService } from '../coord/coordService';
import { ElementService } from '../element/elementService';
import { MapService } from '../map/mapService';

@Injectable({ providedIn: 'root' })
export class GisService {
  private coord = inject(CoordService);
  private element = inject(ElementService);
  private map = inject(MapService);

  constructor() {
    // Al iniciar, carga la configuración geográfica (estados desde la BD)
    this.element.cargarConfiguracionGeografica();
  }

  // Signals de datos
  get estadosSignal() { return this.element.estadosSignal; }
  get radioBasesSignal() { return this.element.radioBasesSignal; }
  get oficinasSignal() { return this.element.oficinasSignal; }
  get abonadosSignal() { return this.element.abonadosSignal; }
  get agentesSignal() { return this.element.agentesSignal; }

  // Signals de UI
  get capasVisibles() { return this.map.capasVisibles; }
  get zoomLevel() { return this.map.zoomLevel; }
  get sidebarColapsado() { return this.map.sidebarColapsado; }
  get busquedaAntena() { return this.map.busquedaAntena; }
  get regionesSignal() { return this.map.regionesSignal; }

  // Colores
  get COLORES_REGIONES_SIGNAL() { return this.map.COLORES_REGIONES_SIGNAL; }

  // Geografía
  obtenerRegion(estado: string) { return this.map.obtenerRegion(estado); }
  getColorEstado(estado: string) { return this.map.getColorEstado(estado); }
  getCoordsCentrales(estado: string) { return this.coord.getCoordEstado(estado); }
  getCentroRegion(region: string) { return this.map.getCentroRegion(region); }

  // Filtros
  getRegionesConDatos() { return this.map.getRegionesConDatos(); }
  getEstadosConDatos() { return this.map.getEstadosConDatos(); }

  /* Regiones que tienen datos, con su color → para la leyenda del mapa */
  getRegionesConColores() {
    const conDatos = new Set(this.map.getRegionesConDatos());
    const filtradas = this.map.regionesSignal().filter(r => conDatos.has(r.nombre));
    // Si no hay datos específicos, devolvemos todas para que la leyenda no desaparezca
    return filtradas.length > 0 ? filtradas : this.map.regionesSignal();
  }

  // Totales
  getTotalesPorEstado(tipo: TipoElemento) { return this.element.getTotalesPorEstado(tipo); }
  getTotalesPorRegion(tipo: TipoElemento) { return this.element.getTotalesPorRegion(tipo); }

  // Control de capas
  toggleCapa(nombre: keyof CapasEstado) { this.map.toggleCapa(nombre); }
  setDetalleCap2(tipo: TipoElemento) { this.map.setDetalleCap2(tipo); }
  setDetalleCap1(tipo: TipoElemento) { this.map.setDetalleCap1(tipo); }

  // Carga de datos
  cargarDatos() { this.element.cargarDatos(); }

  // Agregar elementos
  async construirYValidarElemento(tipo: TipoElemento, data: any) {
    return this.element.construirYValidarElemento(tipo, data, (e) => this.map.obtenerRegion(e));
  }

  agregarElemento(tipo: TipoElemento, data: any) { return this.element.agregarElemento(tipo, data); }
  enviarAlServidor(datos: any) { this.element.enviarAlServidor(datos); }

  async obtenerCoordsDesdeDireccion(dir: string | null | undefined) {
    return this.element.obtenerCoordsDesdeDireccion(dir);
  }
}

export { GisService as Gis };