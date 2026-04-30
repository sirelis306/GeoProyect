import { inject, Injectable, signal, computed } from '@angular/core';
import { CapasEstado, TipoElemento, Region } from '../../models/gis';
import { CoordService } from '../coord/coordService';
import { ElementService } from '../element/elementService';

@Injectable({ providedIn: 'root' })
export class MapService {
  private coord = inject(CoordService);
  private element = inject(ElementService);

  constructor() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.sidebarColapsado.set(true);
    }
  }

  // Estado de UI
  capasVisibles = signal<CapasEstado>({
    regiones: false,
    operaciones: false,
    cotas: false,
    electricidad: false,
    vias: false,
    detalleOperaciones: [],
    detalleRegiones: ['antenas']
  });

  zoomLevel = signal<number>(7);
  sidebarColapsado = signal<boolean>(false);
  busquedaAntena = signal<string>('');

  // Paleta de colores
  COLORES_REGIONES_SIGNAL = computed(() => {
    const mapping: Record<string, string> = {};
    this.regionesSignal().forEach(r => { mapping[r.nombre] = r.color; });
    return mapping;
  });

  // lista de regiones
  regionesSignal = computed<Region[]>(() => {
    const unique = new Map<string, string>();
    const FALLBACK = ['Capital', 'Central', 'Los Llanos', 'Centro Occidental', 'Zuliana', 'Los Andes', 'Nororiental', 'Insular', 'Guayana'];

    this.element.estadosSignal().forEach(e => {
      if (e.nombre_region && e.color_region) unique.set(e.nombre_region, e.color_region);
    });

    return Array.from(unique.entries()).map(([nombre, color]) => ({ nombre, color }));
  });

  // Geografía
  obtenerRegion(nombreEstado: string): string {
    const fromDB = this.element.estadosSignal().find(e => e.nombre === nombreEstado);
    if (fromDB) return fromDB.nombre_region;
    return this.coord.getRegionDeEstado(nombreEstado);
  }

  getColorEstado(nombreEstado: string): string {
    const estado = this.element.estadosSignal().find(e => e.nombre === nombreEstado) as any;
    return estado?.color_estado || estado?.color_region || '#DEE2E6';
  }

  getCentroRegion(nombreRegion: string): { lat: number; lng: number } | null {
    // Primero intenta calcular el centroide dinámico desde los estados en BD
    const estados = this.element.estadosSignal().filter(e => e.nombre_region === nombreRegion);
    if (estados.length > 0) {
      const latSum = estados.reduce((a, e) => a + Number(e.latitud), 0);
      const lngSum = estados.reduce((a, e) => a + Number(e.longitud), 0);
      const lat = latSum / estados.length;
      const lng = lngSum / estados.length;
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return this.coord.getCoordRegion(nombreRegion);
  }

  // Filtros activos
  getRegionesConDatos(): string[] {
    const capas = this.capasVisibles();
    const regiones = new Set<string>();

    const extraer = (lista: any[]) => lista.forEach(i => { if (i.region) regiones.add(i.region); });
    const tipos = capas.operaciones ? capas.detalleOperaciones : capas.detalleRegiones;

    if (tipos.length > 0) {
      tipos.forEach((t: TipoElemento) => extraer(this.element.getDataPorTipo(t)));
    } else {
      ['antenas', 'oficinas', 'abonados', 'agentes'].forEach(t =>
        extraer(this.element.getDataPorTipo(t as TipoElemento))
      );
    }
    return Array.from(regiones);
  }

  getEstadosConDatos(): { nombre: string; color: string }[] {
    const capas = this.capasVisibles();
    const tipos: TipoElemento[] = capas.operaciones ? capas.detalleOperaciones : [...capas.detalleRegiones];

    const nombres = new Set<string>();
    tipos.forEach(t => this.element.getDataPorTipo(t).forEach((i: any) => { if (i.estado) nombres.add(i.estado); }));

    return this.element.estadosSignal()
      .filter(e => nombres.has(e.nombre))
      .map(e => ({ nombre: e.nombre, color: this.getColorEstado(e.nombre) }));
  }

  // Totales
  getTotalesPorEstado(tipo: TipoElemento) { return this.element.getTotalesPorEstado(tipo); }
  getTotalesPorRegion(tipo: TipoElemento) { return this.element.getTotalesPorRegion(tipo); }

  // Control de capas
  toggleCapa(nombre: keyof CapasEstado) {
    this.capasVisibles.update(e => {
      if (nombre === 'cotas' || nombre === 'electricidad' || nombre === 'vias') {
        return { ...e, [nombre]: !e[nombre] };
      }

      const activar = !e[nombre];
      const nuevo = { ...e, [nombre]: activar };
      if (nombre === 'operaciones' && activar) { nuevo.regiones = false; nuevo.detalleRegiones = []; }
      if (nombre === 'regiones' && activar) { nuevo.operaciones = false; nuevo.detalleOperaciones = []; }
      if (nombre === 'operaciones' && !activar) nuevo.detalleOperaciones = [];
      return nuevo;
    });
  }

  setDetalleOperaciones(tipo: TipoElemento) {
    this.capasVisibles.update(e => {
      const lista = e.detalleOperaciones.includes(tipo)
        ? e.detalleOperaciones.filter(t => t !== tipo)
        : [...e.detalleOperaciones, tipo];
      return { ...e, detalleOperaciones: lista };
    });
  }

  setDetalleRegiones(tipo: TipoElemento) {
    this.capasVisibles.update(e => {
      const actual = [...e.detalleRegiones];
      const idx = actual.indexOf(tipo);
      const nuevo = idx >= 0 ? actual.filter(t => t !== tipo) : [...actual, tipo];
      return { ...e, detalleRegiones: nuevo.length > 0 ? nuevo : actual }; // nunca vacío
    });
  }
}
