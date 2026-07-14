export type TipoElemento = 'antenas' | 'abonados' | 'oficinas' | 'agentes' | 'ninguno';

export interface CapasEstado {
  regiones: boolean;
  operaciones: boolean;
  cotas: boolean;
  electricidad: boolean;
  vias: boolean;
  poblacion: boolean;
  detalleOperaciones: TipoElemento[];
  detalleRegiones: TipoElemento[];
}

export interface RadioBase {
  id?: string;
  nombre: string;
  estado: string;
  region: string;
  municipio?: string;
  parroquia?: string;
  latitud: number;
  longitud: number;
  tecnologia: string;
  actividad: 'Operativa' | 'Mantenimiento' | 'Vandalizada' | 'Inoperativa';
  direccion?: string;
}

export interface Abonado {
  id?: string;
  nombre: string;
  estado: string;
  region: string;
  municipio?: string;
  parroquia?: string;
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
  municipio?: string;
  parroquia?: string;
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
  municipio?: string;
  parroquia?: string;
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
  poblacion?: number;
}

export interface Region {
  id?: number;
  nombre: string;
  color: string;
}

export interface Proyecto {
  id?: number;
  nombre: string;
  descripcion?: string;
  usuario_id?: number;
}

export interface ProyectoFigura {
  id?: number;
  proyecto_id: number;
  nombre: string;
  tipo: 'poligono' | 'ruta' | 'circulo';
  coordenadas: any;
  radio?: number;
  color?: string;
  visible?: boolean; // Auxiliar para la UI (👁️)
}