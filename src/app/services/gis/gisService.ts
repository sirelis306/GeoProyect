import { Injectable, signal } from '@angular/core';
import { CapasEstado, TipoElementoCap2, RadioBase, Abonado, Oficina, Agente } from '../../models/gis';

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
  radioBasesSignal = signal<RadioBase[]>([
    { nombre: 'Antena Maracaibo', estado: 'Maracaibo', region: 'Zuliana', latitud: 10.6447, longitud: -71.6365, tipo: '5G', actividad: 'Operativa' }, // Zulia
    { nombre: 'Antena Caracas', estado: 'Distrito Capital', region: 'Capital', latitud: 10.4806, longitud: -66.9036, tipo: '4G', actividad: 'Operativa' }   // Capital
  ]);

  oficinasSignal = signal<Oficina[]>([
    { nombre: 'Oficina Valencia', estado: 'Carabobo', region: 'Central', latitud: 10.162, longitud: -68.007, detalle: 'Cualquier Detalle' } // Central
  ]);

  abonadosSignal = signal<Abonado[]>([
    { nombre: 'Zona Residencial Lechería', estado: 'Anzoátegui', region: 'Nororiental', latitud: 10.185, longitud: -64.691, detalle: 'X' } // Nororiental
  ]);

  agentesSignal = signal<Agente[]>([
    { nombre: 'Agente Autorizado Coro', estado: 'Falcón', region: 'Centro Occidental', latitud: 11.404, longitud: -69.673 } // Centro Occidental
  ]);

  agregarElemento(tipo: TipoElementoCap2, data: any) {
    if (tipo === 'antenas') {
      this.radioBasesSignal.update(prev => [...prev, data]);
    } else if (tipo === 'oficinas') {
      this.oficinasSignal.update(prev => [...prev, data]);
    } else if (tipo === 'abonados') {
      this.abonadosSignal.update(prev => [...prev, data]);
    } else if (tipo === 'agentes') {
      this.agentesSignal.update(prev => [...prev, data]);
    }
  }

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
      } else if (detalle === 'abonados') {
        regiones.add('Nororiental');
      } else if (detalle === 'oficinas') {
        regiones.add('Central');
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