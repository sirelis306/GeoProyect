import { inject, Injectable, signal } from '@angular/core';
import { CapasEstado, TipoElementoCap2, RadioBase, Abonado, Oficina, Agente } from '../../models/gis';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Gis {
  private http = inject(HttpClient);
  private API_URL = 'http://localhost:3000/api';
  // Usamos WritableSignals para un manejo de estado moderno y eficiente
  capasVisibles = signal<CapasEstado>({
    regiones: true,
    operaciones: false, // Iniciamos la Capa 2 apagada
    detalleCap2: 'ninguno'
  });

 // Iniciamos los signals vacíos
  radioBasesSignal = signal<RadioBase[]>([]);
  oficinasSignal = signal<Oficina[]>([]);
  abonadosSignal = signal<Abonado[]>([]);
  agentesSignal = signal<Agente[]>([]);

  constructor() {
    this.cargarDatos(); // Cargamos al iniciar el servicio
  }

  cargarDatos() {
    this.http.get<any[]>(`${this.API_URL}/elementos`).subscribe({
      next: (data) => {
      // Separamos los datos por tipo y actualizamos los signals
      this.radioBasesSignal.set(data.filter(i => i.tipo === 'antenas'));
      this.oficinasSignal.set(data.filter(i => i.tipo === 'oficinas'));
      this.abonadosSignal.set(data.filter(i => i.tipo === 'abonados'));
      this.agentesSignal.set(data.filter(i => i.tipo === 'agentes'));
      },
      error: (err) => console.error('Error conectando al backend:', err)
    });
  }

  agregarElemento(tipo: TipoElementoCap2, data: any) {
    const nuevoItem = { ...data, tipo }; // Añadimos el tipo para la base de datos
    
    this.http.post(`${this.API_URL}/elementos`, data).subscribe({ 
      next: () => {
        this.cargarDatos(); // Recargamos todo desde la BD para que el mapa se actualice solo
    },
      error: (err) => alert('Error al guardar en la base de datos')
    });
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