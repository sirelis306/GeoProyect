import { Injectable, signal } from '@angular/core';
import { CapasEstado } from '../../models/gis';

@Injectable({ providedIn: 'root' })
export class MapStateService {
  /* Estado de visibilidad de las capas del mapa. */
  capasVisibles = signal<CapasEstado>({
    regiones: false,
    operaciones: false,
    cotas: false,
    electricidad: false,
    vias: false,
    detalleOperaciones: [],
    detalleRegiones: ['antenas']
  });

  /* Otros estados de UI relacionados con el mapa. */
  zoomLevel = signal<number>(7);
  sidebarColapsado = signal<boolean>(false);
  busquedaAntena = signal<string>('');

  constructor() {
    // Inicialización responsiva básica
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.sidebarColapsado.set(true);
    }
  }

  /* Actualiza una capa específica. */
  actualizarCapa(nuevaCapa: Partial<CapasEstado>) {
    this.capasVisibles.update(actual => ({ ...actual, ...nuevaCapa }));
  }
}
