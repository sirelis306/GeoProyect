import { Component, AfterViewInit, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { Gis } from '../../services/gis/gisService';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit {
  private gis = inject(Gis);
  private http = inject(HttpClient);
  private capaGeoJsonRegiones: L.GeoJSON | null = null;
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private map!: L.Map;

  // Definir los grupos de capas como propiedades de la clase
  private radioBases = L.layerGroup();
  private abonados = L.layerGroup();
  private oficinas = L.layerGroup();
  private agentes = L.layerGroup();

  private COLORES_REGIONES: any = {
    'Zuliana': '#007bff',
    'Andina': '#6610f2',
    'Central': '#fd7e14',
    'Capital': '#dc3545',
    'Llanos': '#ffc107',
    'Centro Occidental': '#e83e8c',
    'Nororiental': '#20c997',
    'Guayana': '#28a745',
    'Insular': '#17a2b8'
  };

  // Mapeo completo de Estados por Región
  private REGION_POR_ESTADO: any = {
    // Región Capital
    'Distrito Capital': 'Capital', 'Miranda': 'Capital', 'Vargas': 'Capital', 'La Guaira': 'Capital',
    
    // Región Central
    'Aragua': 'Central', 'Carabobo': 'Central', 'Cojedes': 'Central',
    
    // Región de los Llanos
    'Guárico': 'Los Llanos', 'Apure': 'Los Llanos',
    
    // Región Centro Occidental
    'Falcón': 'Centro Occidental', 'Lara': 'Centro Occidental', 'Portuguesa': 'Centro Occidental', 'Yaracuy': 'Centro Occidental',
    
    // Región Zuliana
    'Zulia': 'Zuliana',
    
    // Región Andina
    'Mérida': 'Andina', 'Táchira': 'Andina', 'Trujillo': 'Andina', 'Barinas': 'Andina',
    
    // Región Nororiental
    'Anzoátegui': 'Nororiental', 'Monagas': 'Nororiental', 'Sucre': 'Nororiental',
    
    // Región Insular
    'Nueva Esparta': 'Insular', 'Dependencias Federales': 'Insular',
    
    // Región de Guayana
    'Bolívar': 'Guayana', 'Amazonas': 'Guayana', 'Delta Amacuro': 'Guayana'
  };

  constructor() {
    // Creamos un efecto que reaccione a los cambios del servicio automáticamente
    effect(() => {
      const estado = this.gis.capasVisibles();
      
      if (this.map && this.capaGeoJsonRegiones) {
        if (estado.regiones) {
          this.capaGeoJsonRegiones.addTo(this.map);
          
          // Obtenemos las regiones a marcar (ahora incluye lógica para Capa 1 sola)
          const activas = this.gis.getRegionesConDatos();
    
          this.capaGeoJsonRegiones.setStyle((feature: any) => {
            const nombreEstado = feature.properties.estado || feature.properties.name;
            const region = this.REGION_POR_ESTADO[nombreEstado];
            const tieneDatos = activas.includes(region);
    
            return {
              fillColor: tieneDatos ? (this.COLORES_REGIONES[region] || '#DEE2E6') : 'transparent',
              weight: tieneDatos ? 1.5 : 0,
              opacity: tieneDatos ? 1 : 0,
              color: '#FFFFFF',
              fillOpacity: tieneDatos ? 0.7 : 0
            };
          });
        } else {
          this.map.removeLayer(this.capaGeoJsonRegiones);
        }
    
        // --- LÓGICA CAPA 2: PUNTOS ---
        // Limpiamos todo primero
        [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.clearLayers());
    
        if (estado.operaciones) {
          if (estado.detalleCap2 === 'antenas') {
            this.gis.MOCK_ANTENAS.forEach(a => L.marker([a.latitud, a.longitud]).addTo(this.radioBases));
            this.radioBases.addTo(this.map);
          }
          if (estado.detalleCap2 === 'oficinas') {
            this.gis.MOCK_OFICINAS.forEach(o => L.marker([o.latitud, o.longitud]).addTo(this.oficinas));
            this.oficinas.addTo(this.map);
          }
          if (estado.detalleCap2 === 'abonados') {
            this.gis.MOCK_ABONADOS.forEach(ab => {
              L.marker([ab.latitud, ab.longitud]).addTo(this.abonados);
            });
            this.abonados.addTo(this.map);
          }
          if (estado.detalleCap2 === 'agentes') {
            this.gis.MOCK_AGENTES.forEach(ag => {
              L.marker([ag.latitud, ag.longitud]).addTo(this.agentes);
            });
            this.agentes.addTo(this.map);
          }
          
        } else {
          // Si Capa 2 (operaciones) está OFF, removemos los grupos del mapa
          [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.remove());
        }
      }
    });
  }

  ngAfterViewInit() {
    // Crea el mapa
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [7.1291, -66.1818],
      zoom: 7,
      zoomControl: false,
      minZoom: 6,        // Zoom mínimo (no dejará alejar más de esto)
      maxZoom: 18,       // Zoom máximo (opcional, puedes ajustarlo)
      maxBounds: [       // Límites del mapa (opcional, para que no se salga de cierta área)
        [-15, -85],      // Suroeste (lat, lng)
        [20, -55]        // Noreste (lat, lng)
      ],
      maxBoundsViscosity: 1.0 // Qué tan "duro" es el límite (1 = no deja salir)
    });

    // Muestra los demas paises
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    }).addTo(this.map);

    // Cargar Capa 1 (Relieve/Estados)
    this.http.get('assets/geojson/venezuela.json').subscribe((data: any) => {
      this.capaGeoJsonRegiones = L.geoJSON(data, {
        style: (feature: any) => {
          const nombreEstado = feature.properties.estado || feature.properties.name;
          const region = this.REGION_POR_ESTADO[nombreEstado];
          
          // Lógica de filtrado:
          const regionesActivas = this.gis.getRegionesConDatos();
          const estaActiva = regionesActivas.includes(region);
          const colorRegion = estaActiva ? (this.COLORES_REGIONES[region] || '#DEE2E6') : 'transparent';
    
          return {
            fillColor: colorRegion,
            weight: estaActiva ? 1.5 : 0.5, // Más delgado si no tiene datos
            opacity: estaActiva ? 1 : 0.3,
            color: '#FFFFFF',
            fillOpacity: estaActiva ? 0.8 : 0
          };
        }
      });
    
      // Forzamos al effect a revisar el estado inicial:
      if (this.gis.capasVisibles().regiones) {
        this.capaGeoJsonRegiones.addTo(this.map);
      }
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);
  }

  get regionesFiltradas() {
    const nombresActivos = this.gis.getRegionesConDatos();
    return nombresActivos.map(nombre => ({
      nombre: nombre,
      color: this.COLORES_REGIONES[nombre]
    }));
  }
}