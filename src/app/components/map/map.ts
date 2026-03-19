import { Component, AfterViewInit, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { Gis } from '../../services/gis/gisService';
import { HttpClient } from '@angular/common/http';
import { RadioBase, Oficina, Abonado, Agente } from '../../models/gis';
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
    'Zuliana': '#7ab8fc',
    'Andina': '#ac7cf8',
    'Central': '#f8ab6b',
    'Capital': '#ce5461',
    'Llanos': '#ffda6b',
    'Centro Occidental': '#e0679f',
    'Nororiental': '#53c7a4',
    'Guayana': '#55aa69',
    'Insular': '#59afbd'
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
      const antenas = this.gis.radioBasesSignal();
      const oficinas = this.gis.oficinasSignal();
      const abonados = this.gis.abonadosSignal();
      const agentes = this.gis.agentesSignal();
      
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
        if (this.map) {
          // 1. Limpiamos todas las capas de marcadores
          [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.clearLayers());

          // 2. Definimos la función ANTES del switch para que sea accesible
          const crearPinIcon = (colorClass: string) => {
            return L.divIcon({
              html: `<div class="custom-pin-marker ${colorClass}"></div>`,
              className: 'marker-pin-container',
              iconSize: [30, 30],
              iconAnchor: [15, 30],
              popupAnchor: [0, -30]
            });
          };

          if (estado.operaciones && estado.detalleCap2 !== 'ninguno') {
            // 3. Renderizado condicional
            switch (estado.detalleCap2) {
              case 'antenas':
                const iconA = crearPinIcon('pin-antena');
                antenas.forEach((a: RadioBase) => {
                  L.marker([a.latitud, a.longitud], { icon: iconA })
                    .bindPopup(`<b>Antena:</b> ${a.nombre}<br><b>Estado:</b> ${a.estado}`)
                    .addTo(this.radioBases);
                });
                this.radioBases.addTo(this.map);
                break;

              case 'abonados':
                const iconAb = crearPinIcon('pin-abonado');
                abonados.forEach((ab: Abonado) => {
                  L.marker([ab.latitud, ab.longitud], { icon: iconAb })
                    .bindPopup(`<b>Abonado:</b> ${ab.nombre}<br><b>Estado:</b> ${ab.estado}`)
                    .addTo(this.abonados);
                });
                this.abonados.addTo(this.map);
                break;

              case 'oficinas':
                const iconO = crearPinIcon('pin-oficina');
                oficinas.forEach((o: Oficina) => {
                  L.marker([o.latitud, o.longitud], { icon: iconO })
                    .bindPopup(`<b>Oficina:</b> ${o.nombre}<br><b>Estado:</b> ${o.estado}`)
                    .addTo(this.oficinas);
                });
                this.oficinas.addTo(this.map);
                break;

              case 'agentes':
                const iconAg = crearPinIcon('pin-agente');
                agentes.forEach((ag: Agente) => {
                  L.marker([ag.latitud, ag.longitud], { icon: iconAg })
                    .bindPopup(`<b>Agente:</b> ${ag.nombre}<br><b>Estado:</b> ${ag.estado}`)
                    .addTo(this.agentes);
                });
                this.agentes.addTo(this.map);
                break;
            }
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
      minZoom: 6,        // Zoom mínimo
      maxZoom: 18,       // Zoom máximo 
      maxBounds: [       // Límites del mapa (para que no se salga de cierta área)
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