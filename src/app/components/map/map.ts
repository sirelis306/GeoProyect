import { Component, AfterViewInit, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GisService as Gis } from '../../services/gis/gisService';
import { RadioBase, Oficina, Abonado, Agente, TipoElemento } from '../../models/gis';
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
  private capaEtiquetas = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    zIndex: 1000,
    pane: 'markerPane' // Para que esté por encima de los polígonos
  });
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private map!: L.Map;

  private radioBases = L.layerGroup();
  private abonados = L.layerGroup();
  private oficinas = L.layerGroup();
  private agentes = L.layerGroup();
  private layerAggregated = L.layerGroup();
  private capaCotas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    zIndex: 100,
    opacity: 0.6
  });
  private capaElectricidad = L.layerGroup();
  private datosElectricidadCargados = false;
  private capaElectricidadGeoJson: L.GeoJSON | null = null;

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

      // --- LÓGICA CAPA COTAS (RELIEVE) ---
      if (estado.cotas) {
        this.capaCotas.addTo(this.map);
        this.map.removeLayer(this.capaEtiquetas);
      } else {
        this.map.removeLayer(this.capaCotas);
        this.capaEtiquetas.addTo(this.map);
      }

      // --- LÓGICA CAPA ELECTRICIDAD ---
      if (estado.electricidad) {
        this.capaElectricidad.addTo(this.map);
        if (!this.datosElectricidadCargados) {
          this.cargarCapaElectricidad();
        }
      } else {
        this.map.removeLayer(this.capaElectricidad);
      }

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
          const regionesActivas = this.gis.getRegionesConDatos();

          this.capaGeoJsonRegiones.setStyle((feature: any) => {
            const nombreEstado = feature.properties.estado || feature.properties.name;
            const region = this.gis.obtenerRegion(nombreEstado);

            const tieneDatos = usarColorEstado
              ? estadosConDatos.has(nombreEstado)
              : regionesActivas.includes(region);

            const fillColor = usarColorEstado
              ? this.gis.getColorEstado(nombreEstado)
              : (this.gis.COLORES_REGIONES_SIGNAL()[region] || '#DEE2E6');

            return {
              fillColor: tieneDatos ? fillColor : 'transparent',
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
          this.renderIndividualMarkers(estado.detalleCap2);
        } else {
          this.renderStateTotals(estado.detalleCap2);
        }
      } else if (estado.regiones) {
        this.renderRegionTotals(estado.detalleCap1);
      }
    });
  }

  ngAfterViewInit() {
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
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [7.1291, -66.1818],
      zoom: 7,
      zoomControl: false,
      minZoom: 6,
      maxZoom: 18,
      maxBounds: [
        [-15, -85],
        [20, -55]
      ],
      maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {}).addTo(this.map);
    this.capaEtiquetas.addTo(this.map);

    this.map.on('zoomend', () => {
      this.gis.zoomLevel.set(this.map.getZoom());
    });

    this.layerAggregated.addTo(this.map);
    this.gis.zoomLevel.set(this.map.getZoom());

    this.http.get('assets/geojson/venezuela.json').subscribe((data: any) => {
      this.capaGeoJsonRegiones = L.geoJSON(data, {
        style: (feature: any) => {
          const nombreEstado = feature.properties.estado || feature.properties.name;
          const region = this.gis.obtenerRegion(nombreEstado);
          const regionesActivas = this.gis.getRegionesConDatos();
          const estaActiva = regionesActivas.includes(region);
          const colorRegion = estaActiva ? (this.gis.COLORES_REGIONES_SIGNAL()[region] || '#DEE2E6') : 'transparent';

          return {
            fillColor: colorRegion,
            weight: estaActiva ? 1.5 : 0.5,
            opacity: estaActiva ? 1 : 0.3,
            color: '#FFFFFF',
            fillOpacity: estaActiva ? 0.8 : 0
          };
        }
      });

      if (this.gis.capasVisibles().regiones) {
        this.capaGeoJsonRegiones.addTo(this.map);
      }
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.gis.cargarDatos();
  }

  private renderIndividualMarkers(tipos: TipoElemento[]) {
    const crearPinIcon = (tipo: TipoElemento) => {
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
      const cfg = this.configIconos['antenas'];
      const termino = this.gis.busquedaAntena().toLowerCase();
      this.gis.radioBasesSignal()
        .filter(a => !termino || a.nombre?.toLowerCase().includes(termino) || a.direccion?.toLowerCase().includes(termino))
        .forEach(a => {
          const popup = this.crearPopupDetalle(cfg, [
            { label: 'Nombre', value: a.nombre },
            { label: 'Ubicación', value: `${a.estado} (${a.region})` },
            { label: 'Tecnología', value: a.tecnologia },
            { label: 'Actividad', value: a.actividad, badge: true },
            { label: 'Dirección', value: a.direccion },
            { label: 'Coordenadas', value: fmtCoords(a.latitud, a.longitud), coords: true }
          ]);
          L.marker([a.latitud, a.longitud], { icon })
            .bindPopup(popup, { maxWidth: 290 })
            .addTo(this.radioBases);
        });
      this.radioBases.addTo(this.map);
    }

    if (tipos.includes('oficinas')) {
      const icon = crearPinIcon('oficinas');
      const cfg = this.configIconos['oficinas'];
      this.gis.oficinasSignal().forEach(o => {
        const popup = this.crearPopupDetalle(cfg, [
          { label: 'Nombre', value: o.nombre },
          { label: 'Ubicación', value: `${o.estado} (${o.region})` },
          { label: 'Dirección', value: o.direccion },
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
      const cfg = this.configIconos['agentes'];
      this.gis.agentesSignal().forEach(ag => {
        const popup = this.crearPopupDetalle(cfg, [
          { label: 'Nombre', value: ag.nombre },
          { label: 'Ubicación', value: `${ag.estado} (${ag.region})` },
          { label: 'Cód. Dealer', value: ag.codigoDealer },
          { label: 'Clasificación', value: ag.clasificacion, badge: true },
          { label: 'Dirección', value: ag.direccion },
          { label: 'Coordenadas', value: fmtCoords(ag.latitud, ag.longitud), coords: true }
        ]);
        L.marker([ag.latitud, ag.longitud], { icon })
          .bindPopup(popup, { maxWidth: 310 })
          .addTo(this.agentes);
      });
      this.agentes.addTo(this.map);
    }

    if (tipos.includes('abonados')) {
      const icon = crearPinIcon('abonados');
      const cfg = this.configIconos['abonados'];
      const todos = this.gis.abonadosSignal();

      type GrupoAbonado = {
        nombre: string;
        estado: string;
        region: string;
        lat: number;
        lng: number;
        direccion?: string;
        segs: Record<string, number>
      };
      const grupos: Record<string, GrupoAbonado> = {};

      todos.forEach(ab => {
        const key = `${Number(ab.latitud).toFixed(5)}_${Number(ab.longitud).toFixed(5)}`;
        if (!grupos[key]) {
          const nombreLimpio = ab.nombre.replace(/ 3G| 4G| 5G/gi, '');
          grupos[key] = {
            nombre: nombreLimpio,
            estado: ab.estado,
            region: ab.region,
            lat: Number(ab.latitud),
            lng: Number(ab.longitud),
            direccion: ab.direccion,
            segs: {}
          };
        }
        grupos[key].segs[ab.segmentacion] = (grupos[key].segs[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
      });

      Object.values(grupos).forEach(g => {
        const total = Object.values(g.segs).reduce((a, b) => a + b, 0);
        const popupRows: any[] = [
          { label: 'Nombre', value: g.nombre },
          { label: 'Ubicación', value: `${g.estado} (${g.region})` },
        ];

        const numSegs = Object.keys(g.segs).length;
        if (numSegs > 1) {
          popupRows.push({ label: 'Desglose', breakdown: g.segs });
          popupRows.push({ label: 'Total General', value: total.toLocaleString(), badge: true });
        } else {
          const [seg, cant] = Object.entries(g.segs)[0];
          popupRows.push({ label: 'Segmentación', value: seg, badge: true });
          popupRows.push({ label: 'Cantidad', value: cant.toLocaleString() });
        }

        if (g.direccion) popupRows.push({ label: 'Dirección', value: g.direccion });
        popupRows.push({ label: 'Coordenadas', value: fmtCoords(g.lat, g.lng), coords: true });

        L.marker([g.lat, g.lng], { icon })
          .bindPopup(this.crearPopupDetalle(cfg, popupRows), { maxWidth: 300 })
          .addTo(this.abonados);
      });

      this.abonados.addTo(this.map);
    }
  }

  private crearPopupDetalle(
    cfg: { icon: string; color: string; label: string },
    rows: { label: string; value?: string | number | null; badge?: boolean; coords?: boolean; breakdown?: Record<string, number> }[]
  ) {
    const filas = rows
      .filter(r => r.breakdown !== undefined || (r.value !== undefined && r.value !== null && r.value !== ''))
      .map(r => {
        let cell: string;
        if (r.breakdown) {
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

  private renderStateTotals(tipos: TipoElemento[]) {
    const estados = this.gis.estadosSignal();

    estados.forEach(est => {
      const items: any[] = [];
      tipos.forEach(tipo => {
        const total = this.gis.getTotalesPorEstado(tipo).get(est.nombre) || 0;
        if (total > 0) items.push({ tipo, total });
      });

      if (items.length > 0) {
        const icon = this.crearBadgeGroupIcon(items);
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

  private renderRegionTotals(tipos: TipoElemento[]) {
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
          const segBreakdown = tipos.includes('abonados')
            ? this.gis.abonadosSignal()
              .filter(ab => ab.region === reg.nombre)
              .reduce((acc: Record<string, number>, ab) => {
                acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
                return acc;
              }, {})
            : null;

          const marker = L.marker([centro.lat, centro.lng], { icon, zIndexOffset: 2000 });
          marker.bindPopup(this.crearPopupAgregado(reg.nombre, 'region', items, segBreakdown));
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
        </div>`;
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

  private cargarCapaElectricidad() {
    this.datosElectricidadCargados = true;
    const query = `[out:json][timeout:30];area["name"="Venezuela"]["admin_level"="2"]->.a;(way["power"="line"](area.a);way["power"="cable"](area.a););out body;>;out skel qt;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    this.http.get(url).subscribe({
      next: (data: any) => {
        const nodes: Record<number, [number, number]> = {};
        data.elements.filter((e: any) => e.type === "node").forEach((n: any) => {
          nodes[n.id] = [n.lat, n.lon];
        });
        const ways = data.elements.filter((e: any) => e.type === "way");
        const features = ways.map((w: any) => {
          const coords = w.nodes.map((id: number) => nodes[id]).filter((c: any) => {
            if (!c) return false;
            return c[0] > 0.6 && c[0] < 13.0 && c[1] > -73.5 && c[1] < -59.4;
          });
          if (coords.length < 2) return null;
          return {
            type: "Feature",
            properties: w.tags,
            geometry: { type: "LineString", coordinates: coords.map((c: any) => [c[1], c[0]]) }
          };
        }).filter((f: any) => f !== null);

        this.capaElectricidadGeoJson = L.geoJSON({ type: "FeatureCollection", features: features } as any, {
          style: (feature: any) => {
            const v = feature.properties?.voltage || "";
            const isHigh = v.includes("400") || v.includes("765");
            return {
              color: isHigh ? "#FF4500" : "#FFA500",
              weight: isHigh ? 2.5 : 1.5,
              opacity: 0.8,
              dashArray: isHigh ? "" : "5, 5",
              className: "electric-line-glow"
            };
          },
          onEachFeature: (f: any, l: any) => {
            const t = f.properties;
            l.bindPopup(`<div class="electric-popup"><strong>Infraestructura</strong><br/>${t.voltage ? `V: ${t.voltage} kV<br/>` : ""}${t.name ? `N: ${t.name}<br/>` : ""}</div>`);
          }
        });
        this.capaElectricidad.addLayer(this.capaElectricidadGeoJson);
      },
      error: () => this.datosElectricidadCargados = false
    });
  }
}
