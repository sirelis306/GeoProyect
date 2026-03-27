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
    'Los Andes': '#ac7cf8',
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
    'Mérida': 'Los Andes', 'Táchira': 'Los Andes', 'Trujillo': 'Los Andes', 'Barinas': 'Los Andes',
    
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
          const regionesActivas = this.gis.getRegionesConDatos();
    
          this.capaGeoJsonRegiones.setStyle((feature: any) => {
            const nombreEstado = feature.properties.estado || feature.properties.name;
            const region = this.REGION_POR_ESTADO[nombreEstado];
            const tieneDatos = regionesActivas.includes(region);
    
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
          // Limpiamos todas las capas de marcadores
          [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.clearLayers());

          // Definimos la función ANTES del switch para que sea accesible
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
            // Renderizado condicional
            switch (estado.detalleCap2) {
              case 'antenas':
                const iconA = crearPinIcon('pin-antena');
                antenas.forEach((a: RadioBase) => {
                  const lat = Number(a.latitud);
                  const lng = Number(a.longitud);
                  const colorActividad = a.actividad === 'Operativa' ? 'green' : a.actividad === 'Falla' ? 'red' : 'orange';
                  L.marker([lat, lng], { icon: iconA })
                    .bindPopup(`<b>Antena:</b> ${a.nombre}<br><b>Ubicación:</b> ${a.estado} (${a.region})<br> <b>Coordenadas:</b> ${lat.toFixed(4)}, ${lng.toFixed(4)}<br> <b>Tecnología:</b> ${a.tecnologia}<br> ${a.actividad ? `<b>Estado:</b> <span style="color:${colorActividad}; font-weight: bold;">${a.actividad}</span>` : ''} ${a.direccion ? `<b>Dirección:</b> ${a.direccion}<br>` : ''}`)
                    .addTo(this.radioBases);
                });
                this.radioBases.addTo(this.map);
                break;

              case 'abonados':
                const iconAb = crearPinIcon('pin-abonado');
                abonados.forEach((ab: Abonado) => {
                  const lat = Number(ab.latitud);
                  const lng = Number(ab.longitud);
                  
                  // Mostramos el desglose que viene de la base de datos
                  const desglose = ab.segmentacion || "3G:0 | 4G:0 | 5G:0";

                  L.marker([lat, lng], { icon: iconAb })
                    .bindPopup(`
                      <div style="min-width: 180px; font-family: sans-serif;">
                        <h3 style="margin: 0; color: #00BFFF; font-size: 16px;">Abonados - ${ab.estado}</h3>
                        <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                        
                        <div style="font-size: 12px; margin-bottom: 8px;">
                          <b style="color: #555;">Segmentación de Cartera:</b><br>
                          <div style="margin-top: 5px; display: grid; gap: 4px;">
                            <span style="background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px;">● ${desglose.split('|')[0] || '3G:0'}</span>
                            <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">● ${desglose.split('|')[1] || '4G:0'}</span>
                            <span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px;">● ${desglose.split('|')[2] || '5G:0'}</span>
                          </div>
                        </div>

                        <div style="background-color: #daf6ff; padding: 10px; border-radius: 6px; margin-top: 10px; text-align: center; color: white; border: 1px solid #adebff;">
                          <span style="display: block; font-size: 10px; color: #555; text-transform: uppercase; opacity: 0.9;">Total Acumulado</span>
                          <strong style="font-size: 20px; color: #06a7dd;">${ab.cantidad || 0}</strong>
                        </div>
                        
                        <div style="margin-top: 8px; font-size: 9px; color: #aaa; text-align: center;">
                          Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}
                        </div>
                      </div>
                    `)
                    .addTo(this.abonados);
                });
                this.abonados.addTo(this.map);
                break;

              case 'oficinas':
                const iconO = crearPinIcon('pin-oficina');
                oficinas.forEach((o: Oficina) => {
                  const lat = Number(o.latitud);
                  const lng = Number(o.longitud);
                  L.marker([lat, lng], { icon: iconO })
                    .bindPopup(`
                      <div style="min-width: 160px;">
                        <h3 style="margin: 0; color: #32CD32; font-size: 16px;">Oficina Comercial</h3>
                        <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                        <b>Ubicación:</b> ${o.estado} (${o.region})<br>
                        <div style="background-color: #f4fff4; padding: 10px; border-radius: 6px; margin-top: 8px; text-align: center; border: 1px solid #c2ffc2;">
                          <span style="display: block; font-size: 11px; color: #555; text-transform: uppercase;">Total Oficinas</span>
                          <strong style="font-size: 20px; color: #28a745;">${o.cantidad || 0}</strong>
                        </div>
                      </div>
                    `)
                    .addTo(this.oficinas);
                });
                this.oficinas.addTo(this.map);
                break;

              case 'agentes':
                const iconAg = crearPinIcon('pin-agente');
                agentes.forEach((ag: Agente) => {
                  const lat = Number(ag.latitud);
                  const lng = Number(ag.longitud);
                  L.marker([lat, lng], { icon: iconAg })
                    .bindPopup(`
                      <div style="min-width: 160px;">
                        <h3 style="margin: 0; color: #FF8C00; font-size: 16px;">Agente Autorizado</h3>
                        <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                        <b>Ubicación:</b> ${ag.estado} (${ag.region})<br>
                        <div style="background-color: #fff9f2; padding: 10px; border-radius: 6px; margin-top: 8px; text-align: center; border: 1px solid #ffebcc;">
                          <span style="display: block; font-size: 11px; color: #555; text-transform: uppercase;">Total Agentes</span>
                          <strong style="font-size: 20px; color: #e67e00;">${ag.cantidad || 0}</strong>
                        </div>
                      </div>
                    `)
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