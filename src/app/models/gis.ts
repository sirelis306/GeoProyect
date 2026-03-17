export type TipoElementoCap2 = 'antenas' | 'abonados' | 'oficinas' | 'agentes' | 'ninguno';

export interface CapasEstado {
  regiones: boolean;
  operaciones: boolean; // Esta es la Capa 2 principal
  detalleCap2: TipoElementoCap2; // Lo que se elija en el select
}
  
  // Define cómo es una Radio Base (Antena) para la Capa 2
  export interface RadioBase {
    id?: string;
    nombre: string;
    latitud: number;
    longitud: number;
    tipo: '4G' | '5G' | 'LTE';
    estado: 'Operativa' | 'Mantenimiento' | 'Falla';
  }
  
  // Define cómo es una Oficina Comercial
  export interface Oficina {
    id?: string;
    nombre: string;
    direccion: string;
    latitud: number;
    longitud: number;
  }