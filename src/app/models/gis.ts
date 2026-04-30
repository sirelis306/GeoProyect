export type TipoElemento = 'antenas' | 'abonados' | 'oficinas' | 'agentes' | 'ninguno';

export interface CapasEstado {
  regiones: boolean;
  operaciones: boolean;
  cotas: boolean;
  electricidad: boolean;
  vias: boolean;
  detalleOperaciones: TipoElemento[];
  detalleRegiones: TipoElemento[];
}

export interface RadioBase {
  id?: string;
  nombre: string;
  estado: string;
  region: string;
  latitud: number;
  longitud: number;
  tecnologia: string;
  actividad: 'Operativa' | 'Mantenimiento' | 'Vandalizada';
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
  codigoDealer?: string;
  clasificacion?: string;
}

export interface Estado {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  nombre_region: string;
  color_region: string;
  color_estado?: string;
}

export interface Region {
  id?: number;
  nombre: string;
  color: string;
}