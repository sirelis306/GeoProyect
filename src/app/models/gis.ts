export type TipoElementoCap2 = 'antenas' | 'abonados' | 'oficinas' | 'agentes' | 'ninguno';

export interface CapasEstado {
  regiones: boolean;
  operaciones: boolean;
  detalleCap2: TipoElementoCap2;
}
  
  export interface RadioBase {
    id?: string;
    nombre: string;
    estado: string;
    region: string;
    latitud: number;
    longitud: number;
    tecnologia: '4G' | '5G' | 'LTE';
    actividad: 'Operativa' | 'Mantenimiento' | 'Falla';
    direccion?: string;
  }

  export interface Abonado {
    id?: string;
    nombre: string;
    estado: string;
    region: string;
    latitud: number;
    longitud: number;
    cantidad?: number;
    direccion?: string;
    segmentacion: string;
  }
  
  export interface Oficina {
    id?: string;
    nombre: string;
    estado: string;
    region: string;
    latitud: number;
    longitud: number;
    cantidad?: number;
    direccion?: string;
  }

  export interface Agente {
    id?: string;
    nombre: string;
    estado: string;
    region: string;
    latitud: number;
    longitud: number;
    cantidad?: number;
    direccion?: string;
  }