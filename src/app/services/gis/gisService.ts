import { Injectable, signal } from '@angular/core';
import { CapasEstado, TipoElementoCap2  } from '../../models/gis';

@Injectable({
  providedIn: 'root',
})
export class Gis {
  // Usamos WritableSignals para un manejo de estado moderno y eficiente
  capasVisibles = signal<CapasEstado>({
    regiones: true,
    operaciones: false, // Iniciamos la Capa 2 apagada
    detalleCap2: 'ninguno'
  });

  toggleCapa(nombre: keyof CapasEstado) {
    this.capasVisibles.update(estado => ({
      ...estado,
      [nombre]: !estado[nombre]
    }));
  }

  setDetalleCap2(tipo: TipoElementoCap2) {
    this.capasVisibles.update(estado => ({
      ...estado,
      detalleCap2: tipo
    }));
  }
}