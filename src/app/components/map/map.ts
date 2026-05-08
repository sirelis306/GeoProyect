import { Component, AfterViewInit, inject, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GisService as Gis } from '../../services/gis/gisService';
import { TipoElemento } from '../../models/gis';
import * as L from 'leaflet';
import { Totales } from "../totales/totales";
import { ElementRendererService } from '../../services/element/elementRendererService';

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
  private renderer = inject(ElementRendererService);

  private capaGeoJsonRegiones: L.GeoJSON | null = null;
  private capaEtiquetas = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    zIndex: 1000,
    pane: 'markerPane'
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
  private capaBordeVenezuela: L.LayerGroup | null = null;

  // Capa Satelital para vista real en zoom cercano
  private capaSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    zIndex: 405,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  // Tiles base: CartoDB Voyager (Versión completa con calles y detalles)
  private tileBase = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { zIndex: 1 });

  constructor() {
    effect(() => {
      const estado = this.gis.capasVisibles();
      if (!this.map) return;

      // --- LÓGICA CAPA COTAS ---
      if (estado.cotas) {
        this.capaCotas.addTo(this.map);
        this.map.removeLayer(this.capaEtiquetas);
        this.map.removeLayer(this.tileBase); // Ocultar base para evitar duplicados
      } else {
        this.map.removeLayer(this.capaCotas);
        this.capaEtiquetas.addTo(this.map);
        this.tileBase.addTo(this.map); // Restaurar base
      }

      // --- LÓGICA CAPA ELECTRICIDAD ---
      if (estado.electricidad) {
        this.capaElectricidad.addTo(this.map);
        if (!this.datosElectricidadCargados) this.cargarCapaElectricidad();
      } else {
        this.map.removeLayer(this.capaElectricidad);
      }

      // --- LÓGICA CAPA VÍAS HÍBRIDA (ZOOM SATELITAL) ---
      if (estado.vias) {
        const zoom = this.gis.zoomLevel();
        const esVistaSatelite = zoom >= 14;

        if (esVistaSatelite) {
          this.capaSatelite.addTo(this.map);
        } else {
          this.map.removeLayer(this.capaSatelite);
        }

        if (this.capaBordeVenezuela) this.capaBordeVenezuela.addTo(this.map);
      } else {
        this.map.removeLayer(this.capaSatelite);
        if (this.capaBordeVenezuela) this.map.removeLayer(this.capaBordeVenezuela);
      }

      // Limpieza
      [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach(g => g.clearLayers());
      if (this.layerAggregated) this.layerAggregated.clearLayers();

      // --- LÓGICA CAPA 1 (GEOMETRÍA) ---
      if (this.capaGeoJsonRegiones) {
        if (estado.regiones || estado.operaciones) {
          this.capaGeoJsonRegiones.addTo(this.map);
          this.aplicarEstiloRegiones(estado.operaciones);
        } else {
          this.map.removeLayer(this.capaGeoJsonRegiones);
        }
      }

      // --- LÓGICA DE VISUALIZACIÓN SEGÚN ZOOM ---
      const esVistaDetalle = this.gis.zoomLevel() >= 10;
      if (estado.operaciones) {
        if (esVistaDetalle) this.renderIndividualMarkers(estado.detalleOperaciones);
        else this.renderStateTotals(estado.detalleOperaciones);
      } else if (estado.regiones) {
        this.renderRegionTotals(estado.detalleRegiones);
      }
    });
  }

  ngAfterViewInit() {
    if (this.mapContainer && this.mapContainer.nativeElement) this.initMap();
  }

  private initMap() {
    const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
    const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
    const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl, iconUrl, shadowUrl,
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [7.1291, -66.1818], zoom: 7, zoomControl: false, minZoom: 6, maxZoom: 18,
      maxBounds: [[-15, -85], [20, -55]], maxBoundsViscosity: 1.0
    });

    this.tileBase.addTo(this.map);
    this.capaEtiquetas.addTo(this.map);

    // Crear un panel especial para la electricidad para que esté siempre encima de los polígonos
    const electricPane = this.map.createPane('electricPane');
    if (electricPane) {
      electricPane.style.zIndex = '500'; // Por encima de los polígonos (400) pero debajo de marcadores (600)
      electricPane.style.pointerEvents = 'none';
    }

    // Crear un panel para las vías
    const viasPane = this.map.createPane('viasPane');
    if (viasPane) {
      viasPane.style.zIndex = '410';
      viasPane.style.pointerEvents = 'none';
    }

    // Panel para el borde (encima de las vías)
    const borderPane = this.map.createPane('borderPane');
    if (borderPane) {
      borderPane.style.zIndex = '430';
      borderPane.style.pointerEvents = 'none';
    }

    // Panel para elementos (marcadores) para que estén por encima de todo
    const elementsPane = this.map.createPane('elementsPane');
    if (elementsPane) {
      elementsPane.style.zIndex = '610'; // Por encima de markerPane (600) y etiquetas
    }

    this.map.on('zoomend', () => this.gis.zoomLevel.set(this.map.getZoom()));
    this.layerAggregated.addTo(this.map);

    this.http.get('assets/geojson/venezuela.json').subscribe((data: any) => {
      this.capaGeoJsonRegiones = L.geoJSON(data);
      if (this.gis.capasVisibles().regiones) this.capaGeoJsonRegiones.addTo(this.map);

      this.crearMascaraTerritorial(data);
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.gis.cargarDatos();
  }

  private aplicarEstiloRegiones(usarColorEstado: boolean) {
    if (!this.capaGeoJsonRegiones) return;

    const estadosConDatos = new Set(this.gis.getEstadosConDatos().map(e => e.nombre));
    const regionesActivas = this.gis.getRegionesConDatos();
    const capas = this.gis.capasVisibles();
    const hayCapasEspeciales = capas.cotas || capas.electricidad || capas.vias;

    this.capaGeoJsonRegiones.setStyle((f: any) => {
      const nombre = f.properties.estado || f.properties.name;
      const region = this.gis.obtenerRegion(nombre);
      const tieneDatos = usarColorEstado ? estadosConDatos.has(nombre) : regionesActivas.includes(region);
      const color = usarColorEstado ? this.gis.getColorEstado(nombre) : (this.gis.COLORES_REGIONES_SIGNAL()[region] || '#DEE2E6');

      return {
        fillColor: tieneDatos ? color : 'transparent',
        weight: tieneDatos ? 1.5 : 0.5,
        opacity: tieneDatos ? 1 : 0.3,
        color: '#FFFFFF',
        fillOpacity: tieneDatos ? (hayCapasEspeciales ? 0.3 : 0.7) : 0 // Más transparente si hay capas de info extra
      };
    });
  }

  private renderIndividualMarkers(tipos: TipoElemento[]) {
    if (tipos.includes('antenas')) {
      const icon = this.renderer.crearPinIcon('antenas');
      const termino = this.gis.busquedaAntena().toLowerCase();
      this.gis.radioBasesSignal().filter(a => !termino || a.nombre?.toLowerCase().includes(termino) || a.direccion?.toLowerCase().includes(termino))
        .forEach(a => {
          const popup = this.renderer.crearPopupDetalle('antenas', [
            { label: 'Nombre', value: a.nombre },
            { label: 'Ubicación', value: `${a.estado} (${a.region})` },
            { label: 'Tecnología', value: a.tecnologia },
            { label: 'Actividad', value: a.actividad, badge: true },
            { label: 'Dirección', value: a.direccion },
            { label: 'Coordenadas', value: this.renderer.formatCoords(a.latitud, a.longitud), coords: true }
          ]);
          if (a.latitud && a.longitud) {
            L.marker([a.latitud, a.longitud], { icon, pane: 'elementsPane' }).bindPopup(popup, { maxWidth: 400 }).addTo(this.radioBases);
          }
        });
      this.radioBases.addTo(this.map);
    }

    if (tipos.includes('oficinas')) {
      const icon = this.renderer.crearPinIcon('oficinas');
      this.gis.oficinasSignal().forEach(o => {
        const popup = this.renderer.crearPopupDetalle('oficinas', [
          { label: 'Nombre', value: o.nombre },
          { label: 'Ubicación', value: `${o.estado} (${o.region})` },
          { label: 'Dirección', value: o.direccion },
          { label: 'Coordenadas', value: this.renderer.formatCoords(o.latitud, o.longitud), coords: true }
        ]);
        if (o.latitud && o.longitud) {
          L.marker([o.latitud, o.longitud], { icon, pane: 'elementsPane' }).bindPopup(popup, { maxWidth: 400 }).addTo(this.oficinas);
        }
      });
      this.oficinas.addTo(this.map);
    }

    if (tipos.includes('agentes')) {
      const icon = this.renderer.crearPinIcon('agentes');
      this.gis.agentesSignal().forEach(ag => {
        const popup = this.renderer.crearPopupDetalle('agentes', [
          { label: 'Nombre', value: ag.nombre },
          { label: 'Ubicación', value: `${ag.estado} (${ag.region})` },
          { label: 'Cód. Dealer', value: ag.codigoDealer },
          { label: 'Clasificación', value: ag.clasificacion, badge: true },
          { label: 'Dirección', value: ag.direccion },
          { label: 'Coordenadas', value: this.renderer.formatCoords(ag.latitud, ag.longitud), coords: true }
        ]);
        if (ag.latitud && ag.longitud) {
          L.marker([ag.latitud, ag.longitud], { icon, pane: 'elementsPane' }).bindPopup(popup, { maxWidth: 400 }).addTo(this.agentes);
        }
      });
      this.agentes.addTo(this.map);
    }

    if (tipos.includes('abonados')) {
      const icon = this.renderer.crearPinIcon('abonados');
      const grupos: Record<string, any> = {};
      this.gis.abonadosSignal().forEach(ab => {
        const key = `${Number(ab.latitud).toFixed(5)}_${Number(ab.longitud).toFixed(5)}`;
        if (!grupos[key]) grupos[key] = { ...ab, nombre: ab.nombre.replace(/ 3G| 4G| 5G/gi, ''), segs: {} };
        grupos[key].segs[ab.segmentacion] = (grupos[key].segs[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
      });

      Object.values(grupos).forEach(g => {
        const total = Object.values(g.segs).reduce((a: any, b: any) => a + b, 0) as number;
        const rows: any[] = [{ label: 'Nombre', value: g.nombre }, { label: 'Ubicación', value: `${g.estado} (${g.region})` }];
        if (Object.keys(g.segs).length > 1) {
          rows.push({ label: 'Desglose', breakdown: g.segs }, { label: 'Total General', value: total.toLocaleString(), badge: true });
        } else {
          const [s, c] = Object.entries(g.segs)[0];
          rows.push({ label: 'Segmentación', value: s, badge: true }, { label: 'Cantidad', value: (c as number).toLocaleString() });
        }
        if (g.direccion) rows.push({ label: 'Dirección', value: g.direccion });
        rows.push({ label: 'Coordenadas', value: this.renderer.formatCoords(g.latitud, g.longitud), coords: true });

        if (g.latitud && g.longitud) {
          L.marker([g.latitud, g.longitud], { icon, pane: 'elementsPane' }).bindPopup(this.renderer.crearPopupDetalle('abonados', rows), { maxWidth: 400 }).addTo(this.abonados);
        }
      });
      this.abonados.addTo(this.map);
    }
  }

  private renderStateTotals(tipos: TipoElemento[]) {
    this.gis.estadosSignal().forEach(est => {
      const items = tipos.map(t => ({ tipo: t, total: this.gis.getTotalesPorEstado(t).get(est.nombre) || 0 })).filter(i => i.total > 0);
      if (items.length > 0) {
        const segBreakdown = tipos.includes('abonados') ? this.gis.abonadosSignal().filter(ab => ab.estado === est.nombre)
          .reduce((acc: any, ab) => { acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0); return acc; }, {}) : null;
        L.marker([est.latitud, est.longitud], { icon: this.renderer.crearBadgeGroupIcon(items), zIndexOffset: 1000, pane: 'elementsPane' })
          .bindPopup(this.renderer.crearPopupAgregado(est.nombre, 'estado', items, segBreakdown)).addTo(this.layerAggregated);
      }
    });
  }

  private renderRegionTotals(tipos: TipoElemento[]) {
    this.gis.regionesSignal().forEach(reg => {
      const items = tipos.map(t => ({ tipo: t, total: this.gis.getTotalesPorRegion(t).get(reg.nombre) || 0 })).filter(i => i.total > 0);
      const centro = this.gis.getCentroRegion(reg.nombre);
      if (items.length > 0 && centro) {
        const segBreakdown = tipos.includes('abonados') ? this.gis.abonadosSignal().filter(ab => ab.region === reg.nombre)
          .reduce((acc: any, ab) => { acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0); return acc; }, {}) : null;
        L.marker([centro.lat, centro.lng], { icon: this.renderer.crearBadgeGroupIcon(items, true), zIndexOffset: 2000, pane: 'elementsPane' })
          .bindPopup(this.renderer.crearPopupAgregado(reg.nombre, 'region', items, segBreakdown)).addTo(this.layerAggregated);
      }
    });
  }

  private cargarCapaElectricidad() {
    this.datosElectricidadCargados = true;
    this.http.get('assets/geojson/electricidad.json').subscribe({
      next: (data: any) => {
        this.capaElectricidadGeoJson = L.geoJSON(data, {
          pane: 'electricPane',
          style: (f) => this.renderer.getEstiloElectricidad(f),
          pointToLayer: (f, latlng) => L.marker(latlng, {
            icon: this.renderer.crearIconoSubestacion(),
            pane: 'elementsPane'
          }),
          onEachFeature: (f, l) => l.bindPopup(this.renderer.crearPopupElectricidad(f.properties))
        });
        this.capaElectricidad.addLayer(this.capaElectricidadGeoJson);
      },
      error: () => this.datosElectricidadCargados = false
    });
  }

  private crearMascaraTerritorial(geoJson: any) {
    // Usamos un objeto simple para evitar colisión con el nombre de la clase 'Map'
    const segmentos: Record<string, { p1: [number, number], p2: [number, number], count: number }> = {};

    geoJson.features.forEach((feature: any) => {
      const coords = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;

      coords.forEach((polygon: any) => {
        const ring = polygon[0]; // Solo el anillo exterior de cada estado
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];
          // Crear una clave única para el segmento 
          const key = [p1[0], p1[1], p2[0], p2[1]].sort((a, b) => a - b).join('|');

          if (!segmentos[key]) {
            segmentos[key] = { p1: [p1[1], p1[0]], p2: [p2[1], p2[0]], count: 0 };
          }
          segmentos[key].count++;
        }
      });
    });

    // Crear polilíneas solo con los segmentos que aparecen una sola vez
    const outlineSegments: L.Polyline[] = [];
    Object.values(segmentos).forEach(info => {
      if (info.count === 1) {
        outlineSegments.push(L.polyline([info.p1, info.p2], {
          color: '#e2e2e2ff',
          weight: 2,
          interactive: false,
          pane: 'borderPane'
        }));
      }
    });

    this.capaBordeVenezuela = L.layerGroup(outlineSegments) as any;

    // Si la capa de vías ya está activa, añadir el borde
    if (this.gis.capasVisibles().vias) {
      this.capaBordeVenezuela?.addTo(this.map);
    }
  }

}
