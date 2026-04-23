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
        if (estado.regiones || estado.operaciones) {
          this.capaGeoJsonRegiones.addTo(this.map);

          // Operaciones → color por estado específico; Regiones → color por región
          const usarColorEstado = estado.operaciones;
          const estadosConDatos = new Set(this.gis.getEstadosConDatos().map(e => e.nombre));
          const regionesActivas  = this.gis.getRegionesConDatos();

          this.capaGeoJsonRegiones.setStyle((feature: any) => {
            const nombreEstado = feature.properties.estado || feature.properties.name;
            const region       = this.gis.obtenerRegion(nombreEstado);

            const tieneDatos = usarColorEstado
              ? estadosConDatos.has(nombreEstado)
              : regionesActivas.includes(region);

            const fillColor = usarColorEstado
              ? this.gis.getColorEstado(nombreEstado)
              : (this.gis.COLORES_REGIONES_SIGNAL()[region] || '#DEE2E6');

            return {
              fillColor: tieneDatos ? fillColor : 'transparent',
              weight:      tieneDatos ? 1.5 : 0,
              opacity:     tieneDatos ? 1   : 0,
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
          // Zoom alto (≥8): pines individuales por elemento
          this.renderIndividualMarkers(estado.detalleCap2);
        } else {
          // Zoom bajo (<8): badges de totales por estado
          this.renderStateTotals(estado.detalleCap2);
        }
      } else if (estado.regiones) {
        // Solo regiones activa: badges por región a cualquier zoom (multi-tipo)
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

    const fmtCoords = (lat: number, lng: number) =>
      `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;

    if (tipos.includes('antenas')) {
      const icon = crearPinIcon('antenas');
      const cfg  = this.configIconos['antenas'];
      const termino = this.gis.busquedaAntena().toLowerCase();
      this.gis.radioBasesSignal()
        .filter(a => !termino || a.nombre?.toLowerCase().includes(termino) || a.direccion?.toLowerCase().includes(termino))
        .forEach(a => {
          const popup = this.crearPopupDetalle(cfg, [
            { label: 'Nombre',       value: a.nombre },
            { label: 'Estado',       value: a.estado },
            { label: 'Región',       value: a.region },
            { label: 'Tecnología',   value: a.tecnologia },
            { label: 'Actividad',    value: a.actividad, badge: true },
            { label: 'Dirección',    value: a.direccion },
            { label: 'Coordenadas',  value: fmtCoords(a.latitud, a.longitud), coords: true }
          ]);
          L.marker([a.latitud, a.longitud], { icon })
            .bindPopup(popup, { maxWidth: 290 })
            .addTo(this.radioBases);
        });
      this.radioBases.addTo(this.map);
    }

    if (tipos.includes('oficinas')) {
      const icon = crearPinIcon('oficinas');
      const cfg  = this.configIconos['oficinas'];
      this.gis.oficinasSignal().forEach(o => {
        const popup = this.crearPopupDetalle(cfg, [
          { label: 'Nombre',      value: o.nombre },
          { label: 'Estado',      value: o.estado },
          { label: 'Región',      value: o.region },
          { label: 'Dirección',   value: o.direccion },
          { label: 'Coordenadas', value: fmtCoords(o.latitud, o.longitud), coords: true }
        ]);
        L.marker([o.latitud, o.longitud], { icon })
          .bindPopup(popup, { maxWidth: 270 })
          .addTo(this.oficinas);
      });
      this.oficinas.addTo(this.map);
    }

    if (tipos.includes('agentes')) {
      const icon = crearPinIcon('agentes');
      const cfg  = this.configIconos['agentes'];
      this.gis.agentesSignal().forEach(ag => {
        const popup = this.crearPopupDetalle(cfg, [
          { label: 'Nombre',        value: ag.nombre },
          { label: 'Estado',        value: ag.estado },
          { label: 'Región',        value: ag.region },
          { label: 'Cód. Dealer',   value: ag.codigoDealer },
          { label: 'Clasificación', value: ag.clasificacion, badge: true },
          { label: 'Dirección',     value: ag.direccion },
          { label: 'Coordenadas',   value: fmtCoords(ag.latitud, ag.longitud), coords: true }
        ]);
        L.marker([ag.latitud, ag.longitud], { icon })
          .bindPopup(popup, { maxWidth: 310 })
          .addTo(this.agentes);
      });
      this.agentes.addTo(this.map);
    }

    if (tipos.includes('abonados')) {
      const icon = crearPinIcon('abonados');
      const cfg  = this.configIconos['abonados'];

      const todos = this.gis.abonadosSignal();

      // --- Flujo 1: abonados CON dirección → pin individual con ubicación específica ---
      todos.filter(ab => !!ab.direccion).forEach(ab => {
        const popup = this.crearPopupDetalle(cfg, [
          { label: 'Nombre',       value: ab.nombre },
          { label: 'Estado',       value: ab.estado },
          { label: 'Región',       value: ab.region },
          { label: 'Segmentación', value: ab.segmentacion, badge: true },
          { label: 'Cantidad',     value: (ab.cantidad ?? 0).toLocaleString() },
          { label: 'Dirección',    value: ab.direccion },
          { label: 'Coordenadas',  value: fmtCoords(ab.latitud, ab.longitud), coords: true }
        ]);
        L.marker([Number(ab.latitud), Number(ab.longitud)], { icon })
          .bindPopup(popup, { maxWidth: 290 })
          .addTo(this.abonados);
      });

      // --- Flujo 2: abonados SIN dirección → agrupados por estado (desglose por segmentación) ---
      type GrupoAbonado = { estado: string; region: string; lat: number; lng: number; segs: Record<string, number> };
      const grupos: Record<string, GrupoAbonado> = {};

      todos.filter(ab => !ab.direccion).forEach(ab => {
        if (!grupos[ab.estado]) {
          grupos[ab.estado] = {
            estado: ab.estado,
            region: ab.region,
            lat: Number(ab.latitud),
            lng: Number(ab.longitud),
            segs: {}
          };
        }
        const g = grupos[ab.estado];
        g.segs[ab.segmentacion] = (g.segs[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
      });

      Object.values(grupos).forEach((g: GrupoAbonado) => {
        const total = Object.values(g.segs).reduce((a: number, b: number) => a + b, 0);
        const popup = this.crearPopupDetalle(cfg, [
          { label: 'Estado',      value: g.estado },
          { label: 'Región',      value: g.region },
          { label: 'Total',       value: total.toLocaleString() },
          { label: 'Desglose',    breakdown: g.segs },
          { label: 'Coordenadas', value: fmtCoords(g.lat, g.lng), coords: true }
        ]);
        L.marker([g.lat, g.lng], { icon })
          .bindPopup(popup, { maxWidth: 270 })
          .addTo(this.abonados);
      });

      this.abonados.addTo(this.map);
    }
  }

  /** Construye el HTML de un popup detallado con cabecera de color e ícono */
  private crearPopupDetalle(
    cfg: { icon: string; color: string; label: string },
    rows: { label: string; value?: string | number | null; badge?: boolean; coords?: boolean; breakdown?: Record<string, number> }[]
  ) {
    const filas = rows
      .filter(r => r.breakdown !== undefined || (r.value !== undefined && r.value !== null && r.value !== ''))
      .map(r => {
        let cell: string;
        if (r.breakdown) {
          // Bloque de desglose por segmentación (inline en la tabla)
          const segs = Object.entries(r.breakdown).sort()
            .map(([seg, cnt]) =>
              `<span class="popup-seg-pill"><b>${seg}</b> ${(cnt as number).toLocaleString()}</span>`
            ).join('');
          cell = `<span class="popup-seg-pills">${segs}</span>`;
        } else if (r.coords) {
          cell = `<span class="popup-coords"><i class="fas fa-map-pin"></i>${r.value}</span>`;
        } else if (r.badge) {
          cell = `<span class="popup-badge" style="--bdg-color:${cfg.color}">${r.value}</span>`;
        } else {
          cell = `<span class="popup-val">${r.value}</span>`;
        }
        return `<tr><td class="popup-lbl">${r.label}</td><td>${cell}</td></tr>`;
      }).join('');

    return `
      <div class="popup-detalle">
        <div class="popup-header" style="background: linear-gradient(135deg, ${cfg.color} 0%, ${cfg.color}cc 100%)">
          <div class="popup-header-icon"><i class="fas ${cfg.icon}"></i></div>
          <span>${cfg.label}</span>
        </div>
        <table class="popup-table">${filas}</table>
      </div>`;
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
        // Para abonados calculamos el desglose por segmentación en este estado
        const segBreakdown = tipos.includes('abonados')
          ? this.gis.abonadosSignal()
              .filter(ab => ab.estado === est.nombre)
              .reduce((acc: Record<string, number>, ab) => {
                acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
                return acc;
              }, {})
          : null;
        L.marker([est.latitud, est.longitud], { icon, zIndexOffset: 1000 })
          .bindPopup(this.crearPopupAgregado(est.nombre, 'estado', items, segBreakdown))
          .addTo(this.layerAggregated);
      }
    });
  }

  private renderRegionTotals(tipos: TipoElementoCap2[]) {
    const regiones = this.gis.regionesSignal();
    regiones.forEach(reg => {
      const items: any[] = [];
      tipos.forEach(tipo => {
        const total = this.gis.getTotalesPorRegion(tipo).get(reg.nombre) || 0;
        if (total > 0) items.push({ tipo, total });
      });

      if (items.length > 0) {
        const centro = this.gis.getCentroRegion(reg.nombre);
        if (centro) {
          const icon = this.crearBadgeGroupIcon(items, true);
          const marker = L.marker([centro.lat, centro.lng], { icon, zIndexOffset: 2000 });
          marker.bindPopup(this.crearPopupAgregado(reg.nombre, 'region', items));
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

  private crearPopupAgregado(
    titulo: string,
    tipo: 'estado' | 'region',
    items: any[],
    segBreakdown: Record<string, number> | null = null
  ) {
    const mainColor = items.length > 0 ? this.configIconos[items[0].tipo].color : '#3240A5';
    const icono = tipo === 'estado' ? 'fa-map-marker-alt' : 'fa-globe-americas';

    let rows = '';
    items.forEach(item => {
      const config = this.configIconos[item.tipo];
      rows += `
        <div class="pagg-row">
          <span class="pagg-dot" style="background:${config.color}"></span>
          <span class="pagg-label">${config.label}</span>
          <strong class="pagg-val">${item.total.toLocaleString()}</strong>
        </div>`;

      if (item.tipo === 'abonados' && segBreakdown && Object.keys(segBreakdown).length > 0) {
        rows += `<div class="popup-seg-breakdown">`;
        Object.entries(segBreakdown).sort().forEach(([seg, cnt]) => {
          rows += `<div class="popup-seg-row"><span class="popup-seg-label">${seg}</span><span class="popup-seg-val">${(cnt as number).toLocaleString()}</span></div>`;
        });
        rows += `</div>`;
      }
    });

    return `
      <div class="pagg">
        <div class="pagg-header" style="background: linear-gradient(135deg, ${mainColor} 0%, ${mainColor}cc 100%)">
          <i class="fas ${icono}"></i>
          <span>${titulo}</span>
        </div>
        <div class="pagg-body">${rows}</div>
      </div>`;
  }
}