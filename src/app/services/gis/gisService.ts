import { inject, Injectable, signal } from '@angular/core';
import { CapasEstado, TipoElementoCap2, RadioBase, Abonado, Oficina, Agente } from '../../models/gis';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Gis {
  private http = inject(HttpClient);
  private API_URL = 'http://localhost:3000/api';

  private readonly COORD_CENTRALES: any = {
    'Amazonas': { lat: 3.4167, lng: -65.5000 },
    'Anzoátegui': { lat: 9.3333, lng: -64.3333 },
    'Apure': { lat: 7.0000, lng: -69.0000 },
    'Aragua': { lat: 10.2500, lng: -67.2500 },
    'Barinas': { lat: 8.3333, lng: -70.0000 },
    'Bolívar': { lat: 6.0000, lng: -63.0000 },
    'Carabobo': { lat: 10.1620, lng: -68.0070 },
    'Cojedes': { lat: 9.1667, lng: -68.3333 },
    'Delta Amacuro': { lat: 8.5000, lng: -61.5000 },
    'Distrito Capital': { lat: 10.5000, lng: -66.9167 },
    'Falcón': { lat: 11.0000, lng: -70.0000 },
    'Guárico': { lat: 8.5000, lng: -66.5000 },
    'La Guaira': { lat: 10.6000, lng: -66.9333 },
    'Lara': { lat: 10.1667, lng: -69.6667 },
    'Mérida': { lat: 8.5000, lng: -71.1667 },
    'Miranda': { lat: 10.2500, lng: -66.5000 },
    'Monagas': { lat: 9.3333, lng: -63.0000 },
    'Nueva Esparta': { lat: 10.9833, lng: -63.9167 },
    'Portuguesa': { lat: 9.0000, lng: -69.2500 },
    'Sucre': { lat: 10.4167, lng: -63.5000 },
    'Táchira': { lat: 7.8333, lng: -72.1667 },
    'Trujillo': { lat: 9.4167, lng: -70.5000 },
    'Yaracuy': { lat: 10.3333, lng: -68.7500 },
    'Zulia': { lat: 10.3333, lng: -72.0000 }
  };

  public obtenerRegion(estado: string): string {
    const mapeo: any = {
    // Región Capital
    'Distrito Capital': 'Capital','Miranda': 'Capital','La Guaira': 'Capital',
    // Región Central
    'Carabobo': 'Central', 'Aragua': 'Central', 'Cojedes': 'Central',
    // Región de los Llanos
    'Guárico': 'Los Llanos', 'Apure': 'Los Llanos',
    // Región Centro Occidental
    'Falcón': 'Centro Occidental', 'Lara': 'Centro Occidental', 'Portuguesa': 'Centro Occidental', 'Yaracuy': 'Centro Occidental',
    // Región Zuliana
    'Zulia': 'Zuliana',
    // Región de los Andes
    'Mérida': 'Los Andes', 'Táchira': 'Los Andes', 'Trujillo': 'Los Andes', 'Barinas': 'Los Andes',
    // Región Nororiental
    'Anzoátegui': 'Nororiental', 'Monagas': 'Nororiental', 'Sucre': 'Nororiental',
    // Región Insular
    'Nueva Esparta': 'Insular', 'Dependencias Federales': 'Insular',
    // Región Guayana
    'Bolívar': 'Guayana', 'Amazonas': 'Guayana', 'Delta Amacuro': 'Guayana'
  };
    return mapeo[estado] || '';
  }

  public getCoordsCentrales(estado: string) {
    return this.COORD_CENTRALES[estado];
  }

  capasVisibles = signal<CapasEstado>({
    regiones: true,
    operaciones: false, 
    detalleCap2: 'ninguno'
  });

 // Iniciamos los signals vacíos
  radioBasesSignal = signal<RadioBase[]>([]);
  oficinasSignal = signal<Oficina[]>([]);
  abonadosSignal = signal<Abonado[]>([]);
  agentesSignal = signal<Agente[]>([]);

  constructor() {
  }

  get totalAbonadosSum() {
    return this.abonadosSignal().reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
  }

  get totalOficinasSum() {
    return this.oficinasSignal().reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
  }

  get totalAgentesSum() {
    return this.agentesSignal().reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
  }

  // Para antenas se mantiene el conteo de items individuales
  get totalAntenasCount() {
    return this.radioBasesSignal().length;
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
    const nuevoItem = { ...data, tipo }; 
    
    this.http.post(`${this.API_URL}/elementos`, data).subscribe({ 
      next: () => {
        this.cargarDatos();
    },
      error: (err) => alert('Error al guardar en la base de datos')
    });
  }

  // Lógica para determinar qué regiones tienen datos
  getRegionesConDatos(): string[] {
    const estado = this.capasVisibles();
    const direccion = estado.detalleCap2;
    const regiones = new Set<string>();

    // Función auxiliar para extraer regiones de cualquier lista de datos
    const extraerDe = (lista: any[]) => lista.forEach(item => {
      if (item.region) regiones.add(item.region);
  });

  if (estado.operaciones && direccion !== 'ninguno') {
    // Si la Capa 2 está activa, extraemos regiones solo del tipo seleccionado
    if (direccion === 'antenas') extraerDe(this.radioBasesSignal());
    else if (direccion === 'oficinas') extraerDe(this.oficinasSignal());
    else if (direccion === 'abonados') extraerDe(this.abonadosSignal());
    else if (direccion === 'agentes') extraerDe(this.agentesSignal());
  } else {
    // Si solo la Capa 1 está activa, extraemos regiones de TODOS los datos
    extraerDe(this.radioBasesSignal());
    extraerDe(this.oficinasSignal());
    extraerDe(this.abonadosSignal());
    extraerDe(this.agentesSignal());
  }

  return Array.from(regiones);
  }

  enviarAlServidor(datos: any) {
    this.http.post('http://localhost:3000/api/elementos', datos).subscribe({
      next: (res) => {
        alert("Elemento guardado con éxito");
      },
      error: (err) => console.error("Error al guardar:", err)
    });
  }

  async obtenerCoordsDesdeDireccion(direccion: string | null | undefined): Promise<{lat: number, lng: number} | null> {
    if (!direccion) return null; // Resuelve el error 2345 al asegurar que hay un string
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}, Venezuela`;
      const res: any = await this.http.get(url).toPromise();
      
      if (res && res.length > 0) {
        return {
          lat: parseFloat(res[0].lat),
          lng: parseFloat(res[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error("Error en geocodificación:", error);
      return null;
    }
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