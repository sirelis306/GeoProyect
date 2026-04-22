import { Component, AfterViewInit, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Gis } from '../../services/gis/gisService';
import { RadioBase, Oficina, Abonado, Agente, TipoElementoCap2 } from '../../models/gis';
import * as L from 'leaflet';
import { Totales } from "../totales/totales";

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, Totales],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit {
  public gis = inject(Gis);
  private http = inject(HttpClient);
  private capaGeoJsonRegiones: L.GeoJSON | null = null;
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private map!: L.Map;

  private radioBases = L.layerGroup();
  private abonados = L.layerGroup();
  private oficinas = L.layerGroup();
  private agentes = L.layerGroup();
  private layerAggregated = L.layerGroup();

  private configIconos: any = {
    antenas: { icon: 'fa-broadcast-tower', color: '#FF1493', label: 'Radio Bases' },
    abonados: { icon: 'fa-user-check', color: '#00BFFF', label: 'Abonados' },
    oficinas: { icon: 'fa-building', color: '#32CD32', label: 'Oficinas' },
    agentes: { icon: 'fa-store', color: '#FF8C00', label: 'Agentes' }
  };




  constructor() {
    effect(() => {
      const estado = this.gis.capasVisibles();
      const configGeografica = this.gis.estadosSignal();
      const zoom = this.gis.zoomLevel();

      // Dependencias para reaccionar a la carga de datos
      this.gis.radioBasesSignal();
      this.gis.oficinasSignal();
      this.gis.abonadosSignal();
      this.gis.agentesSignal();

      if (!this.map) return;

      // Limpiamos todas las capas de marcadores
      [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.clearLayers());
      if (this.layerAggregated) this.layerAggregated.clearLayers();

      // --- LÓGICA CAPA 1 (GEOMETRÍA) ---
      if (this.capaGeoJsonRegiones) {
        if (estado.regiones) {
          this.capaGeoJsonRegiones.addTo(this.map);
          const regionesActivas = this.gis.getRegionesConDatos();

          this.capaGeoJsonRegiones.setStyle((feature: any) => {
            const nombreEstado = feature.properties.estado || feature.properties.name;
            const region = this.gis.obtenerRegion(nombreEstado);
            const tieneDatos = regionesActivas.includes(region);

            return {
              fillColor: tieneDatos ? (this.gis.COLORES_REGIONES_SIGNAL()[region] || '#DEE2E6') : 'transparent',
              weight: tieneDatos ? 1.5 : 0,
              opacity: tieneDatos ? 1 : 0,
              color: '#FFFFFF',
              fillOpacity: tieneDatos ? 0.7 : 0
            };
          });
        } else {
          this.map.removeLayer(this.capaGeoJsonRegiones);
        }
      }

      // --- LÓGICA DE VISUALIZACIÓN SEGÚN ZOOM ---
      const esVistaDetalle = zoom >= 8;

      if (estado.operaciones) {
        if (esVistaDetalle) {
          // Puntos individuales (excepto Abonados)
          this.renderIndividualMarkers(estado.detalleCap2);
          // Abonados siempre como total por estado en esta vista
          if (estado.detalleCap2.includes('abonados')) {
            this.renderStateTotals(['abonados']);
          }
        } else {
          // Totales por estado
          this.renderStateTotals(estado.detalleCap2);
        }
      } else if (estado.regiones && zoom < 8) {
        // Totales por región
        this.renderRegionTotals(estado.detalleCap1);
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

    this.map.on('zoomend', () => {
      this.gis.zoomLevel.set(this.map.getZoom());
    });

    this.layerAggregated.addTo(this.map);

    // Forzamos que se muestre en el nivel inicial
    this.gis.zoomLevel.set(this.map.getZoom());

    // Cargar Capa 1 (Relieve/Regiones)
    this.http.get('assets/geojson/venezuela.json').subscribe((data: any) => {
      this.capaGeoJsonRegiones = L.geoJSON(data, {
        style: (feature: any) => {
          const nombreEstado = feature.properties.estado || feature.properties.name;
          const region = this.gis.obtenerRegion(nombreEstado);

          // Lógica de filtrado:
          const regionesActivas = this.gis.getRegionesConDatos();
          const estaActiva = regionesActivas.includes(region);
          const colorRegion = estaActiva ? (this.gis.COLORES_REGIONES[region] || '#DEE2E6') : 'transparent';

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

  // --- MÉTODOS DE RENDERIZADO ---

  private renderIndividualMarkers(tipos: TipoElementoCap2[]) {
    const crearPinIcon = (tipo: TipoElementoCap2) => {
      const config = this.configIconos[tipo];
      return L.divIcon({
        html: `<div class="custom-pin-marker pin-${tipo}">
                 <i class="fas ${config.icon}"></i>
               </div>`,
        className: 'marker-pin-container',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
      });
    };

    if (tipos.includes('antenas')) {
      const icon = crearPinIcon('antenas');
      const termino = this.gis.busquedaAntena().toLowerCase();
      this.gis.radioBasesSignal()
        .filter(a => !termino || a.nombre?.toLowerCase().includes(termino) || a.direccion?.toLowerCase().includes(termino))
        .forEach(a => {
          L.marker([a.latitud, a.longitud], { icon })
            .bindPopup(`<b>Antena:</b> ${a.nombre}<br><b>Estado:</b> ${a.estado}<br><b>Región:</b> ${a.region}`)
            .addTo(this.radioBases);
        });
      this.radioBases.addTo(this.map);
    }

    if (tipos.includes('oficinas')) {
      const icon = crearPinIcon('oficinas');
      this.gis.oficinasSignal().forEach(o => {
        L.marker([o.latitud, o.longitud], { icon })
          .bindPopup(`<b>Oficina:</b> ${o.nombre}<br><b>Estado:</b> ${o.estado}`)
          .addTo(this.oficinas);
      });
      this.oficinas.addTo(this.map);
    }

    if (tipos.includes('agentes')) {
      const icon = crearPinIcon('agentes');
      this.gis.agentesSignal().forEach(ag => {
        L.marker([ag.latitud, ag.longitud], { icon })
          .bindPopup(`<b>Agente:</b> ${ag.nombre}<br><b>Estado:</b> ${ag.estado}`)
          .addTo(this.agentes);
      });
      this.agentes.addTo(this.map);
    }
  }

  private renderStateTotals(tipos: TipoElementoCap2[]) {
    const estados = this.gis.estadosSignal();

    estados.forEach(est => {
      const items: any[] = [];
      tipos.forEach(tipo => {
        const total = this.gis.getTotalesPorEstado(tipo).get(est.nombre) || 0;
        if (total > 0) {
          items.push({ tipo, total });
        }
      });

      if (items.length > 0) {
        const icon = this.crearBadgeGroupIcon(items);
        L.marker([est.latitud, est.longitud], { icon, zIndexOffset: 1000 })
          .bindPopup(this.crearPopupAgregado(`Estado: ${est.nombre}`, items))
          .addTo(this.layerAggregated);
      }
    });
  }

  private renderRegionTotals(tipo: TipoElementoCap2) {
    const regiones = this.gis.regionesSignal();
    regiones.forEach(reg => {
      const total = this.gis.getTotalesPorRegion(tipo).get(reg.nombre) || 0;
      if (total > 0) {
        const centro = this.gis.getCentroRegion(reg.nombre);
        if (centro) {
          const items = [{ tipo, total }];
          const icon = this.crearBadgeGroupIcon(items, true);
          const marker = L.marker([centro.lat, centro.lng], { icon, zIndexOffset: 2000 });

          marker.bindPopup(this.crearPopupAgregado(`Región: ${reg.nombre}`, items));
          marker.addTo(this.layerAggregated);
        }
      }
    });
  }

  private crearBadgeGroupIcon(items: any[], esRegion = false) {
    let html = `<div class="badge-group ${esRegion ? 'region-badge' : ''}">`;
    items.forEach(item => {
      const config = this.configIconos[item.tipo];
      html += `
        <div class="badge-item" style="--bg-color: ${config.color}">
          <i class="fas ${config.icon}"></i>
          <span>${item.total.toLocaleString()}</span>
        </div>
      `;
    });
    html += '</div>';

    return L.divIcon({
      html,
      className: 'custom-badge-container',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  }

  private crearPopupAgregado(titulo: string, items: any[]) {
    let html = `<div class="popup-agregado"><h3>${titulo}</h3><hr>`;
    items.forEach(item => {
      const config = this.configIconos[item.tipo];
      html += `
        <div class="popup-item">
          <i class="fas ${config.icon}" style="color: ${config.color}"></i>
          <span>${config.label}:</span>
          <strong>${item.total.toLocaleString()}</strong>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }
}