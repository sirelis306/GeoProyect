import { Injectable, signal } from '@angular/core';
import { CapasEstado, TipoElementoCap2, RadioBase, Oficina  } from '../../models/gis';

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

  // Datos de prueba (Mock Data)
  readonly MOCK_ANTENAS: RadioBase[] = [
    { nombre: 'Antena Maracaibo', latitud: 10.6447, longitud: -71.6365, tipo: '5G', estado: 'Operativa' }, // Zulia
    { nombre: 'Antena Caracas', latitud: 10.4806, longitud: -66.9036, tipo: '4G', estado: 'Operativa' }   // Capital
  ];

  readonly MOCK_OFICINAS: Oficina[] = [
    { nombre: 'Oficina Valencia', direccion: 'Av. Bolívar', latitud: 10.162, longitud: -68.007 } // Central
  ];

  readonly MOCK_ABONADOS = [
    { nombre: 'Zona Residencial Lechería', latitud: 10.185, longitud: -64.691 } // Nororiental
  ];

  readonly MOCK_AGENTES = [
    { nombre: 'Agente Autorizado Coro', latitud: 11.404, longitud: -69.673 } // Centro Occidental
  ];

  // Agregaremos lógica para determinar qué regiones tienen datos
  getRegionesConDatos(): string[] {
    const estado = this.capasVisibles();
    const detalle = estado.detalleCap2;
    const regiones = new Set<string>();
  
    // Si la Capa 2 está activa y tiene un detalle, filtramos por ese detalle
    if (estado.operaciones && detalle !== 'ninguno') {
      if (detalle === 'antenas') {
        regiones.add('Zuliana');
        regiones.add('Capital');
      } else if (detalle === 'oficinas') {
        regiones.add('Central');
      } else if (detalle === 'abonados') {
        regiones.add('Nororiental');
      } else if (detalle === 'agentes') {
        regiones.add('Centro Occidental');
      }
    } else {
      // SI SOLO LA CAPA 1 ESTÁ ACTIVA (o Capa 2 sin detalle):
      // Mostramos todas las regiones que tienen CUALQUIER dato de prueba
      regiones.add('Zuliana');
      regiones.add('Capital');
      regiones.add('Central');
      regiones.add('Nororiental');
      regiones.add('Centro Occidental');
    }
  
    return Array.from(regiones);
  }

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