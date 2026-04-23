import { inject, Injectable, signal, computed } from '@angular/core';
import { CapasEstado, TipoElementoCap2, RadioBase, Abonado, Oficina, Agente, Estado, Region } from '../../models/gis';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class Gis {
  private http = inject(HttpClient);
  private API_URL = 'http://localhost:3000/api';
  // private API_URL = 'https://geobackend-api.onrender.com/api';

  // Signals para configuración geográfica dinámica
  estadosSignal = signal<Estado[]>([]);

  // Computed para la lista de regiones (usada en la leyenda)
  regionesSignal = computed<Region[]>(() => {
    const unique = new Map<string, string>();
    
    // Si hay datos en la BD, los usamos
    if (this.estadosSignal().length > 0) {
      this.estadosSignal().forEach(e => {
        if (e.nombre_region && e.color_region) {
          unique.set(e.nombre_region, e.color_region);
        }
      });
    }

    // Si el mapa está vacío o para asegurar que todas las regiones existan:
    this.REGIONES_FALLBACK.forEach(nombre => {
      if (!unique.has(nombre)) {
        unique.set(nombre, this.COLORES_REGIONES[nombre] || '#DEE2E6');
      }
    });

    return Array.from(unique.entries()).map(([nombre, color]) => ({ nombre, color }));
  });

  // Computed para el mapeo de colores (mantiene compatibilidad con código existente)
  COLORES_REGIONES_SIGNAL = computed(() => {
    const mapping: any = { ...this.COLORES_REGIONES };
    this.regionesSignal().forEach(r => mapping[r.nombre] = r.color);
    return mapping;
  });

  private readonly REGIONES_FALLBACK = [
    'Capital', 'Central', 'Los Llanos', 'Centro Occidental', 'Zuliana', 'Los Andes', 'Nororiental', 'Insular', 'Guayana'
  ];

  private readonly COORD_REGIONES: any = {
    'Capital': { lat: 10.4806, lng: -66.8983 },
    'Central': { lat: 10.0000, lng: -68.0000 },
    'Los Llanos': { lat: 8.5000, lng: -67.0000 },
    'Centro Occidental': { lat: 10.0000, lng: -69.5000 },
    'Zuliana': { lat: 10.3333, lng: -72.0000 },
    'Los Andes': { lat: 8.5000, lng: -71.0000 },
    'Nororiental': { lat: 9.5000, lng: -64.0000 },
    'Insular': { lat: 10.9500, lng: -64.0000 },
    'Guayana': { lat: 6.0000, lng: -63.0000 }
  };

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

  public obtenerRegion(nombreEstado: string): string {
    const found = this.estadosSignal().find(e => e.nombre === nombreEstado);
    if (found) return found.nombre_region;

    // Fallback mapeo estático temporal (Opcional: eliminar cuando la BD esté madura)
    const mapeoEstatico: any = {
      'Distrito Capital': 'Capital', 'Miranda': 'Capital', 'La Guaira': 'Capital',
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
    return mapeoEstatico[nombreEstado] || '';
  }

  public getCoordsCentrales(nombreEstado: string) {
    const found = this.estadosSignal().find(e => e.nombre === nombreEstado);
    if (found) {
      const lat = Number(found.latitud);
      const lng = Number(found.longitud);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return this.COORD_CENTRALES[nombreEstado];
  }

  capasVisibles = signal<CapasEstado>({
    regiones: true,
    operaciones: false,
    detalleCap2: [],
    detalleCap1: ['antenas']
  });

  zoomLevel = signal<number>(7);

  // Iniciamos los signals vacíos
  radioBasesSignal = signal<RadioBase[]>([]);
  oficinasSignal = signal<Oficina[]>([]);
  abonadosSignal = signal<Abonado[]>([]);
  agentesSignal = signal<Agente[]>([]);

  busquedaAntena = signal<string>('');
  sidebarColapsado = signal<boolean>(false);

  public readonly COLORES_REGIONES: any = {
    'Zuliana': '#7ab8fc',
    'Los Andes': '#ac7cf8',
    'Central': '#f8ab6b',
    'Capital': '#ce5461',
    'Los Llanos': '#ffda6b',
    'Centro Occidental': '#e0679f',
    'Nororiental': '#53c7a4',
    'Guayana': '#55aa69',
    'Insular': '#59afbd'
  };

  public readonly COLORES_ESTADOS: Record<string, string> = {
    // Región Capital
    'Distrito Capital': '#ce5461',
    'Miranda':          '#e57381',
    'La Guaira':        '#a33d49',
    // Región Central
    'Carabobo':         '#f8ab6b',
    'Aragua':           '#fbc18f',
    'Cojedes':          '#d68d4f',
    // Región Los Llanos
    'Guárico':          '#ffda6b',
    'Apure':            '#ffe79a',
    // Región Centro Occidental
    'Falcón':           '#e0679f',
    'Lara':             '#eb8db8',
    'Portuguesa':       '#b84d7f',
    'Yaracuy':          '#f4b3d1',
    // Región Zuliana
    'Zulia':            '#7ab8fc',
    // Región Los Andes
    'Mérida':           '#ac7cf8',
    'Táchira':          '#c4a1fa',
    'Trujillo':         '#8c5dd6',
    'Barinas':          '#dcc7ff',
    // Región Nororiental
    'Anzoátegui':       '#53c7a4',
    'Monagas':          '#7ed9bc',
    'Sucre':            '#3a9c7f',
    // Región Insular
    'Nueva Esparta':    '#59afbd',
    'Dependencias Federales': '#84c8d4',
    // Región Guayana
    'Bolívar':          '#55aa69',
    'Amazonas':         '#7bc28c',
    'Delta Amacuro':    '#3d824d'
  };

  /** Devuelve el color específico de un estado, con fallback al color de su región */
  public getColorEstado(nombreEstado: string): string {
    if (this.COLORES_ESTADOS[nombreEstado]) return this.COLORES_ESTADOS[nombreEstado];
    // Fallback: color de la región a la que pertenece
    const region = this.obtenerRegion(nombreEstado);
    return this.COLORES_REGIONES_SIGNAL()[region] || '#DEE2E6';
  }

  constructor() {
    this.cargarConfiguracionGeografica();
  }

  cargarConfiguracionGeografica() {
    this.http.get<Estado[]>(`${this.API_URL}/estados`).subscribe({
      next: (data) => {
        this.estadosSignal.set(data);
        console.log('Configuración geográfica cargada:', data.length, 'estados');
      },
      error: (err) => console.error('Error cargando configuración geográfica:', err)
    });
  }

  // Centralizamos la obtención de regiones con sus colores para uso en Sidebar y Map
  public getRegionesConColores() {
    const nombresActivos = this.getRegionesConDatos();
    const coloresMapping = this.COLORES_REGIONES_SIGNAL();

    return nombresActivos.map(nombre => ({
      nombre: nombre,
      color: coloresMapping[nombre] || this.COLORES_REGIONES[nombre] || '#DEE2E6'
    }));
  }

  /** Devuelve los estados que tienen datos para los tipos activos en Capa 2 (operaciones) */
  public getEstadosConDatos(): { nombre: string; color: string }[] {
    const estado = this.capasVisibles();
    // detalleCap1 ya es TipoElementoCap2[], usamos spread para no crear array anidado
    const tipos: TipoElementoCap2[] = estado.operaciones ? estado.detalleCap2 : [...estado.detalleCap1];

    const estadosConData = new Set<string>();
    tipos.forEach(tipo => {
      this.getDataPorTipo(tipo).forEach((item: any) => {
        if (item.estado) estadosConData.add(item.estado);
      });
    });

    return this.estadosSignal()
      .filter(e => estadosConData.has(e.nombre))
      .map(e => ({
        nombre: e.nombre,
        color: this.getColorEstado(e.nombre)   // color específico por estado
      }));
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
    // Datos "quemados" para simular el sistema poblado
    const mockData: any[] = [
      // Antenas
      { id: 101, nombre: 'Ospino', latitud: 9.3034, longitud: -69.4510, tipo: 'antenas', region: 'Centro Occidental', estado: 'Portuguesa', tecnologia: 'GSM / UMTS / LTE', actividad: 'Operativa' },
      { id: 102, nombre: 'Zuata', latitud: 10.1871830, longitud: -67.37695, tipo: 'antenas', region: 'Central', estado: 'Aragua', tecnologia: 'GSM / UMTS', actividad: 'Operativa' },
      { id: 103, nombre: 'Calabozo Industrial', latitud: 8.89609478912229, longitud: -67.4624255505939, tipo: 'antenas', region: 'Los Llanos', estado: 'Guárico', tecnologia: 'GSM / UMTS / LTE', actividad: 'Operativa' },
      { id: 104, nombre: 'Guri', latitud: 7.770964, longitud: -63.047719, tipo: 'antenas', region: 'Guayana', estado: 'Bolívar', tecnologia: 'GSM / UMTS', actividad: 'Operativa' },

      // Oficinas
      { id: 201, nombre: 'Oficina de Servicio Tibisay', latitud: 8.5896488, longitud: -71.156224, tipo: 'oficinas', region: 'Los Andes', estado: 'Mérida', cantidad: 1 },
      { id: 202, nombre: 'Oficina de Servicio Plaza Mayor', latitud: 10.18116, longitud: -64.6828, tipo: 'oficinas', region: 'Nororiental', estado: 'Anzoátegui', cantidad: 1 },
      { id: 203, nombre: 'Oficina de Servicio Porlamar', latitud: 10.98703, longitud: -63.81752, tipo: 'oficinas', region: 'Insular', estado: 'Nueva Esparta', cantidad: 1 },
      { id: 204, nombre: 'Oficina de Servicio CCCT', latitud: 10.48544, longitud: -66.85448, tipo: 'oficinas', region: 'Capital', estado: 'Miranda', cantidad: 1 },


      // Abonados
      { id: 301, nombre: 'Abonados Amazonas 3G', latitud: 3.4167, longitud: -65.5, tipo: 'abonados', region: 'Guayana', estado: 'Amazonas', cantidad: 8470, segmentacion: '3G' },
      { id: 302, nombre: 'Abonados Amazonas 4G', latitud: 3.4167, longitud: -65.5, tipo: 'abonados', region: 'Guayana', estado: 'Amazonas', cantidad: 33813, segmentacion: '4G' },
      { id: 303, nombre: 'Abonados Zulia 3G', latitud: 10.3333, longitud: -72, tipo: 'abonados', region: 'Zuliana', estado: 'Zulia', cantidad: 36048, segmentacion: '3G' },
      { id: 304, nombre: 'Abonados Zulia 4G', latitud: 10.3333, longitud: -72, tipo: 'abonados', region: 'Zuliana', estado: 'Zulia', cantidad: 78583, segmentacion: '4G' },
      { id: 305, nombre: 'Abonados Mérida 3G', latitud: 8.5, longitud: -71.1667, tipo: 'abonados', region: 'Los Andes', estado: 'Mérida', cantidad: 143903, segmentacion: '3G' },
      { id: 306, nombre: 'Abonados Mérida 4G', latitud: 8.5, longitud: -71.1667, tipo: 'abonados', region: 'Los Andes', estado: 'Mérida', cantidad: 270518, segmentacion: '4G' },

      // Agentes
      { id: 401, nombre: 'COMERCIAL NOFA, C.A.', latitud: 10.1656, longitud: -66.8856, tipo: 'agentes', region: 'Capital', estado: 'Miranda', cantidad: 1, codigoDealer: '0088M', clasificacion: 'AA', direccion: 'CALLE JOSE MARIA CARREÑO LOCAL MINICOZZI N° PB SECTOR CASCO CENTRAL CUA MIRANDA' },
      { id: 402, nombre: 'VARIEDADES MOTOCENTRO, C.A.', latitud: 9.3146, longitud: -70.6044, tipo: 'agentes', region: 'Los Andes', estado: 'Trujillo', cantidad: 1, codigoDealer: '704AA', clasificacion: 'ACI', direccion: 'CALLE 7, ENTRE AV BOLIVAR Y CALLE 9, LOCAL MOTO CENTRO, SECTOR CENTRO VALERA, EDO TRUJILLO' },
      { id: 403, nombre: 'DISTRIBUIDORA ATRACHE, C.A.', latitud: 8.9248, longitud: -67.4287, tipo: 'agentes', region: 'Los Llanos', estado: 'Apure', cantidad: 1, codigoDealer: '336AA', clasificacion: 'ACI', direccion: 'EDIFICIO ATRACHE, CARRETERA 11 ENTRE 7 Y 8, NIVEL PB, CALABOZO EDO GUARICO.' },
      { id: 404, nombre: 'GRUPO RC, C.A.', latitud: 9.9272, longitud: -69.6201, tipo: 'agentes', region: 'Centro Occidental', estado: 'Lara', cantidad: 1, codigoDealer: '699AA', clasificacion: 'AA', direccion: 'CARRERA 10  CON C.ALLE BOLIVAR, ZONA CENTRO, EDIF SALAMANC.A, PB.' },
    ];

    // Actualizamos los signals con los datos quemados
    this.radioBasesSignal.set(mockData.filter(i => i.tipo === 'antenas'));
    this.oficinasSignal.set(mockData.filter(i => i.tipo === 'oficinas'));
    this.abonadosSignal.set(mockData.filter(i => i.tipo === 'abonados'));
    this.agentesSignal.set(mockData.filter(i => i.tipo === 'agentes'));

    /*
    // Comentado: Carga real desde el servidor
    this.http.get<any[]>(`${this.API_URL}/elementos`).subscribe({
      next: (data) => {
        this.radioBasesSignal.set(data.filter(i => i.tipo === 'antenas'));
        this.oficinasSignal.set(data.filter(i => i.tipo === 'oficinas'));
        this.abonadosSignal.set(data.filter(i => i.tipo === 'abonados'));
        this.agentesSignal.set(data.filter(i => i.tipo === 'agentes'));
      },
      error: (err) => console.error('Error conectando al backend:', err)
    });
    */
  }

  async construirYValidarElemento(tipoEdicion: TipoElementoCap2, nuevoItem: any): Promise<any> {
    const itemFinal: any = {
      estado: nuevoItem.estado,
      region: this.obtenerRegion(nuevoItem.estado),
      tipo: tipoEdicion,
      direccion: nuevoItem.direccion || '',
      cantidad: Number(nuevoItem.cantidad) || 0
    };

    if (tipoEdicion === 'antenas' || tipoEdicion === 'agentes') {
      let lat = nuevoItem.latitud;
      let lng = nuevoItem.longitud;

      if (!lat || !lng) {
        if (!nuevoItem.direccion && tipoEdicion === 'antenas') {
          throw new Error("Para antenas debe colocar coordenadas o una dirección válida.");
        }

        const coordsAuto = await this.obtenerCoordsDesdeDireccion(nuevoItem.direccion);
        if (coordsAuto) {
          lat = coordsAuto.lat;
          lng = coordsAuto.lng;
        } else if (tipoEdicion === 'agentes') {
          // Si la geocodificación falla, usar centro del estado con un pequeño margen aleatorio (jitter)
          const coordsEstado = this.getCoordsCentrales(nuevoItem.estado);
          const jitter = () => (Math.random() - 0.5) * 0.04; // Aproximadamente 4-5km de dispersión
          lat = coordsEstado ? coordsEstado.lat + jitter() : 0;
          lng = coordsEstado ? coordsEstado.lng + jitter() : 0;
        } else {
          throw new Error("No se pudo encontrar la ubicación por dirección. Intente colocar coordenadas manualmente.");
        }
      }

      const latNum = Number(lat);
      const lngNum = Number(lng);

      itemFinal.nombre = nuevoItem.nombre;
      itemFinal.latitud = latNum;
      itemFinal.longitud = lngNum;
      itemFinal.cantidad = 1;

      if (tipoEdicion === 'antenas') {
        itemFinal.tecnologia = (nuevoItem.tecnologia || []).join(' / ');
        if (!itemFinal.tecnologia) itemFinal.tecnologia = 'LTE';
        itemFinal.actividad = nuevoItem.actividad || 'Operativa';
        itemFinal.cantidad = 1;

        if (latNum < 0.6 || latNum > 12.2 || lngNum < -73.3 || lngNum > -59.7) {
          throw new Error("Error: Las coordenadas están fuera de los límites de Venezuela.");
        }
      } else {
        // Campos específicos para Agentes
        itemFinal.codigoDealer = nuevoItem.codigoDealer;
        itemFinal.clasificacion = nuevoItem.clasificacion;
        itemFinal.cantidad = 1; // Aseguramos que tenga cantidad para pasar la validación
        itemFinal.tecnologia = null;
        itemFinal.actividad = null;
      }

    } else {
      const coords = this.getCoordsCentrales(nuevoItem.estado);

      if (tipoEdicion === 'abonados') {
        itemFinal.segmentacion = nuevoItem.segmentacion_elegida || '4G';
        itemFinal.nombre = `Abonados ${itemFinal.segmentacion} ${nuevoItem.estado}`;
      } else {
        itemFinal.nombre = `${tipoEdicion.toUpperCase()} - ${nuevoItem.estado}`;
        itemFinal.segmentacion = null;
      }

      itemFinal.latitud = coords ? coords.lat : 0;
      itemFinal.longitud = coords ? coords.lng : 0;
      itemFinal.tecnologia = null;
      itemFinal.actividad = null;
    }

    // Validación final simplificada
    if (!itemFinal.estado || itemFinal.cantidad < 0) {
      throw new Error("Por favor, seleccione un estado válido.");
    }

    if (tipoEdicion !== 'antenas' && tipoEdicion !== 'agentes' && itemFinal.cantidad <= 0) {
      throw new Error("Por favor, ingrese una cantidad válida.");
    }

    return itemFinal;
  }

  agregarElemento(tipo: TipoElementoCap2, data: any) {
    const nuevoItem = { ...data, tipo };
    return this.http.post(`${this.API_URL}/elementos`, data);
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

    if (estado.operaciones && estado.detalleCap2.length > 0) {
      // Si la Capa 2 está activa, extraemos regiones de todos los tipos seleccionados
      estado.detalleCap2.forEach(tipo => {
        if (tipo === 'antenas') extraerDe(this.radioBasesSignal());
        else if (tipo === 'oficinas') extraerDe(this.oficinasSignal());
        else if (tipo === 'abonados') extraerDe(this.abonadosSignal());
        else if (tipo === 'agentes') extraerDe(this.agentesSignal());
      });
    } else if (estado.regiones && estado.detalleCap1.length > 0) {
      // Capa 1 activa: iterar todos los tipos seleccionados (multi-select)
      estado.detalleCap1.forEach(tipo => {
        if (tipo === 'antenas') extraerDe(this.radioBasesSignal());
        else if (tipo === 'oficinas') extraerDe(this.oficinasSignal());
        else if (tipo === 'abonados') extraerDe(this.abonadosSignal());
        else if (tipo === 'agentes') extraerDe(this.agentesSignal());
      });
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
      // this.http.post('https://geobackend-api.onrender.com/api/elementos', datos).subscribe({
      next: (res) => {
        alert("Elemento guardado con éxito");
      },
      error: (err) => console.error("Error al guardar:", err)
    });
  }

  async obtenerCoordsDesdeDireccion(direccion: string | null | undefined): Promise<{ lat: number, lng: number } | null> {
    if (!direccion) return null;

    // Limpiamos ruidos genéricos
    const direccionLimpia = this.limpiarDireccionParaBusqueda(direccion);

    // Dividimos por comas para reintentar desde lo más general si falla lo específico
    const partes = direccionLimpia.split(',').map(p => p.trim()).filter(p => p.length > 2);

    // Máximo 4 intentos para no saturar el API
    const maxIntentos = Math.min(partes.length, 4);

    for (let i = 0; i < maxIntentos; i++) {
      const queryActual = partes.slice(i).join(', ');

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryActual)}, ${this.contextoPais}`;
        const res: any = await this.http.get(url).toPromise();

        if (res && res.length > 0) {
          console.log(`Geocodificación exitosa tras ${i + 1} intento(s) con: "${queryActual}"`);
          return {
            lat: parseFloat(res[0].lat),
            lng: parseFloat(res[0].lon)
          };
        }
      } catch (error) {
        console.error('Error en geocodificación:', error);
      }

      // Pequeña espera (300ms) para respetar políticas de Nominatim solo si vamos a reintentar
      if (i < maxIntentos - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return null;
  }

  private contextoPais = 'Venezuela';

  private limpiarDireccionParaBusqueda(dir: string): string {
    // Convertimos a mayúsculas para facilitar el reemplazo
    let limpia = dir.toUpperCase();

    // Palabras que suelen confundir a los buscadores de calles/sectores
    const ruidos = [
      /LOCAL\s+(NRO\.?|N°?|NUMERO)?\s*\d+/gi, // Maneja "LOCAL NRO. 2", "LOCAL 5", "LOCAL N°3"
      /NIVEL\s+\w+/gi, /PISO\s+\d+/gi, /PB/gi, /P\.B/gi,
      /EDIFICIO\s+\w+/gi, /EDIF\.\s+\w+/gi, /APT\s+\d+/gi, /APTO\s+\d+/gi,
      /C.C\s+\w+/gi, /CENTRO COMERCIAL\s+\w+/gi, /BASEMENT/gi, /PLANTA BAJA/gi,
      /ESTADO\s+/gi // Remueve la palabra "ESTADO" para dejar solo el nombre (ej: MERIDA)
    ];

    ruidos.forEach(regex => {
      limpia = limpia.replace(regex, '');
    });

    // Limpiar comas dobles o espacios extra que queden
    limpia = limpia.replace(/, ,/g, ',').replace(/\s+/g, ' ').trim();

    return limpia;
  }

  toggleCapa(nombre: keyof CapasEstado) {
    this.capasVisibles.update(estado => {
      const activar = !estado[nombre];
      const nuevoEstado = { ...estado, [nombre]: activar };

      // Capas mutuamente exclusivas: activar una desactiva la otra
      if (nombre === 'operaciones' && activar) {
        nuevoEstado.regiones = false;
        nuevoEstado.detalleCap1 = [];
      }
      if (nombre === 'regiones' && activar) {
        nuevoEstado.operaciones = false;
        nuevoEstado.detalleCap2 = [];
      }

      // Al desactivar operaciones, limpiar detalleCap2
      if (nombre === 'operaciones' && !activar) {
        nuevoEstado.detalleCap2 = [];
      }

      return nuevoEstado;
    });
  }

  setDetalleCap2(tipo: TipoElementoCap2) {
    this.capasVisibles.update(estado => {
      let nuevosDetalles = [...estado.detalleCap2];

      if (nuevosDetalles.includes(tipo)) {
        nuevosDetalles = nuevosDetalles.filter(t => t !== tipo);
      } else {
        nuevosDetalles.push(tipo);
      }

      return {
        ...estado,
        detalleCap2: nuevosDetalles
      };
    });
  }

  /** Activa/desactiva un tipo en la selección múltiple de Capa 1 (Regiones) */
  setDetalleCap1(tipo: TipoElementoCap2) {
    this.capasVisibles.update(estado => {
      const actual = Array.isArray(estado.detalleCap1) ? [...estado.detalleCap1] : [estado.detalleCap1];
      const idx = actual.indexOf(tipo);
      const nuevo = idx >= 0 ? actual.filter(t => t !== tipo) : [...actual, tipo];
      return { ...estado, detalleCap1: nuevo.length > 0 ? nuevo : actual }; // nunca vacío
    });
  }

  // Helper para obtener centros de regiones
  getCentroRegion(nombreRegion: string) {
    const estadosDeRegion = this.estadosSignal().filter(e => e.nombre_region === nombreRegion);

    if (estadosDeRegion.length > 0) {
      // Cast to Number to prevent string concatenation when the API returns string values
      const latSum = estadosDeRegion.reduce((acc, e) => acc + Number(e.latitud), 0);
      const lngSum = estadosDeRegion.reduce((acc, e) => acc + Number(e.longitud), 0);
      const lat = latSum / estadosDeRegion.length;
      const lng = lngSum / estadosDeRegion.length;

      // If the average produced NaN (e.g. missing coords in DB), fall through to the static fallback
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }

    // Fallback a coordenadas predefinidas
    return this.COORD_REGIONES[nombreRegion] || null;
  }

  // Obtener totales por estado para un tipo
  getTotalesPorEstado(tipo: TipoElementoCap2) {
    const data: any[] = this.getDataPorTipo(tipo);
    const totales = new Map<string, number>();

    data.forEach(item => {
      const actual = totales.get(item.estado) || 0;
      totales.set(item.estado, actual + (Number(item.cantidad) || 1));
    });

    return totales;
  }

  // Obtener totales por región para un tipo
  getTotalesPorRegion(tipo: TipoElementoCap2) {
    const data: any[] = this.getDataPorTipo(tipo);
    const totales = new Map<string, number>();

    data.forEach(item => {
      const region = item.region || this.obtenerRegion(item.estado);
      const actual = totales.get(region) || 0;
      totales.set(region, actual + (Number(item.cantidad) || 1));
    });

    return totales;
  }

  private getDataPorTipo(tipo: TipoElementoCap2): any[] {
    switch (tipo) {
      case 'antenas': return this.radioBasesSignal();
      case 'oficinas': return this.oficinasSignal();
      case 'abonados': return this.abonadosSignal();
      case 'agentes': return this.agentesSignal();
      default: return [];
    }
  }
}