import { Component, AfterViewInit, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { Gis } from '../../services/gis/gisService';
import { HttpClient } from '@angular/common/http';
import { RadioBase, Oficina, Abonado, Agente } from '../../models/gis';
import * as L from 'leaflet';
import { Totales } from "../totales/totales";

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [Totales],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit {
  private gis = inject(Gis);
  private http = inject(HttpClient);
  private capaGeoJsonRegiones: L.GeoJSON | null = null;
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private map!: L.Map;

  private radioBases = L.layerGroup();
  private abonados = L.layerGroup();
  private oficinas = L.layerGroup();
  private agentes = L.layerGroup();

  private COLORES_REGIONES: any = {
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

  // Mapeo completo de Estados por Región
  private REGION_POR_ESTADO: any = {
    // Región Capital
    'Distrito Capital': 'Capital', 'Miranda': 'Capital', 'La Guaira': 'Capital',

    // Región Central
    'Aragua': 'Central', 'Carabobo': 'Central',

    // Región de los Llanos
    'Guárico': 'Los Llanos', 'Apure': 'Los Llanos', 'Barinas': 'Los Llanos', 'Portuguesa': 'Los Llanos', 'Cojedes': 'Los Llanos',

    // Región Centro Occidental
    'Falcón': 'Centro Occidental', 'Lara': 'Centro Occidental', 'Yaracuy': 'Centro Occidental',

    // Región Zuliana
    'Zulia': 'Zuliana',

    // Región Andina
    'Mérida': 'Los Andes', 'Táchira': 'Los Andes', 'Trujillo': 'Los Andes',

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

          // Obtenemos las regiones a marcar
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

        // --- LÓGICA CAPA 2 ---
        if (this.map) {
          // Limpiamos todas las capas de marcadores
          [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.clearLayers());

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
            switch (estado.detalleCap2) {
              case 'antenas':
                const iconA = crearPinIcon('pin-antena');
                const terminoAntena = this.gis.busquedaAntena().toLowerCase();

                let antenasFiltradas = antenas;
                if (terminoAntena) {
                  antenasFiltradas = antenas.filter(a =>
                    (a.nombre && a.nombre.toLowerCase().includes(terminoAntena)) ||
                    (a.direccion && a.direccion.toLowerCase().includes(terminoAntena))
                  );
                }

                antenasFiltradas.forEach((a: RadioBase) => {
                  const lat = Number(a.latitud);
                  const lng = Number(a.longitud);
                  const colorActividad = a.actividad === 'Operativa' ? 'green' : a.actividad === 'Vandalizada' ? 'red' : 'orange';
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

                  // Filtramos todos los registros que pertenecen al mismo estado para sumar sus segmentaciones
                  const abonadosDelEstado = abonados.filter(item => item.estado === ab.estado);

                  const total3G = abonadosDelEstado
                    .filter(item => item.segmentacion === '3G')
                    .reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);

                  const total4G = abonadosDelEstado
                    .filter(item => item.segmentacion === '4G')
                    .reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);

                  const total5G = abonadosDelEstado
                    .filter(item => item.segmentacion === '5G')
                    .reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);

                  const totalGeneral = total3G + total4G + total5G;

                  L.marker([lat, lng], { icon: iconAb })
                    .bindPopup(`
                      <div style="min-width: 200px; font-family: sans-serif;">
                        <h3 style="margin: 0; color: #00BFFF; font-size: 16px;">Abonados - ${ab.estado}</h3>
                        <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                        
                        <div style="font-size: 13px; margin-bottom: 8px;">
                          <b style="color: #555;">Segmentación por Tecnología:</b><br>
                          <div style="margin-top: 8px; display: grid; gap: 6px;">
                            <div style="background: #fee2e2; color: #b91c1c; padding: 5px 10px; border-radius: 4px; display: flex; justify-content: space-between;">
                              <span>● 3G</span> <b>${total3G.toLocaleString()}</b>
                            </div>
                            <div style="background: #e0f2fe; color: #0369a1; padding: 5px 10px; border-radius: 4px; display: flex; justify-content: space-between;">
                              <span>● 4G</span> <b>${total4G.toLocaleString()}</b>
                            </div>
                            <div style="background: #dcfce7; color: #15803d; padding: 5px 10px; border-radius: 4px; display: flex; justify-content: space-between;">
                              <span>● 5G</span> <b>${total5G.toLocaleString()}</b>
                            </div>
                          </div>
                        </div>

                        <div style="background-color: #daf6ff; padding: 12px; border-radius: 6px; margin-top: 10px; text-align: center; border: 1px solid #adebff;">
                          <span style="display: block; font-size: 11px; color: #555; text-transform: uppercase; opacity: 0.9; margin-bottom: 4px;"> Total en el Estado </span>
                          <strong style="font-size: 22px; color: #06a7dd;">
                            ${totalGeneral.toLocaleString()}
                          </strong>
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
                agentes.forEach((ag: any) => {
                  const lat = Number(ag.latitud);
                  const lng = Number(ag.longitud);
                  L.marker([lat, lng], { icon: iconAg })
                    .bindPopup(`
                      <div style="min-width: 180px; font-family: sans-serif;">
                        <h3 style="margin: 0; color: #FF8C00; font-size: 16px;">${ag.nombre || 'Agente Autorizado'}</h3>
                        <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                        <div style="font-size: 13px; line-height: 1.5;">
                          <b>Código Dealer:</b> ${ag.codigo_dealer || 'N/A'}<br>
                          <b>Clasificación:</b> ${ag.clasificacion || 'N/A'}<br>
                          <b>Región:</b> ${ag.region}<br>
                          <b>Estado:</b> ${ag.estado}<br>
                          ${ag.direccion ? `<b>Dirección:</b> ${ag.direccion}` : ''}
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
          // Si Capa 2 está OFF, removemos los grupos del mapa
          [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.remove());
        }
      }
    });
  }

  ngAfterViewInit() {
    // Validación de seguridad para evitar el error TypeError
    if (this.mapContainer && this.mapContainer.nativeElement) {
      this.initMap();
    } else {
      console.error("No se pudo encontrar el contenedor del mapa.");
    }
  }

  private initMap() {
    if (!this.mapContainer || !this.mapContainer.nativeElement) {
      console.error("Error: No se encontró el contenedor del mapa en el DOM.");
      return;
    }
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
      maxBoundsViscosity: 1.0
    });

    // Muestra los demas paises
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    }).addTo(this.map);

    // Cargar Capa 1 (Relieve/Regiones)
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
    this.gis.cargarDatos();
  }

  get regionesFiltradas() {
    const nombresActivos = this.gis.getRegionesConDatos();
    return nombresActivos.map(nombre => ({
      nombre: nombre,
      color: this.COLORES_REGIONES[nombre]
    }));
  }
}