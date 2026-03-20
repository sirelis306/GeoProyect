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

  // Función auxiliar para extraer regiones de cualquier lista de datos
  const extraerDe = (lista: any[]) => lista.forEach(item => {
    if (item.region) regiones.add(item.region);
  });

  if (estado.operaciones && detalle !== 'ninguno') {
    // Si la Capa 2 está activa, extraemos regiones solo del tipo seleccionado
    if (detalle === 'antenas') extraerDe(this.radioBasesSignal());
    else if (detalle === 'oficinas') extraerDe(this.oficinasSignal());
    else if (detalle === 'abonados') extraerDe(this.abonadosSignal());
    else if (detalle === 'agentes') extraerDe(this.agentesSignal());
  } else {
    // Si solo la Capa 1 está activa, extraemos regiones de TODOS los datos
    extraerDe(this.radioBasesSignal());
    extraerDe(this.oficinasSignal());
    extraerDe(this.abonadosSignal());
    extraerDe(this.agentesSignal());
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