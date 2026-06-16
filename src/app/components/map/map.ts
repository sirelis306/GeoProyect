import { Component, AfterViewInit, inject, ElementRef, ViewChild, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GisService as Gis } from '../../services/gis/gisService';
import { TipoElemento } from '../../models/gis';
import * as L from 'leaflet';
import { Totales } from "../totales/totales";
import { ElementRendererService } from '../../services/element/elementRendererService';
import { GisMathService } from '../../services/gis/gisMathService';
import { Polygons } from '../polygons/polygons';
import '@geoman-io/leaflet-geoman-free';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, Totales, Polygons],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit {
  public gis = inject(Gis);
  private http = inject(HttpClient);
  private renderer = inject(ElementRendererService);
  private mathService = inject(GisMathService);
  
  public leyendaAbierta = signal(true);
  public analisisFigura = signal<any | null>(null);
  private activeDrawnLayer: L.Layer | null = null;

  private capaGeoJsonRegiones: L.GeoJSON | null = null;
  private geoJsonData: any = null;
  private capaEtiquetas = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    zIndex: 1000,
    pane: 'markerPane'
  });
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private map!: L.Map;
  private poblacionData: Record<string, number> = {};

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
        if (estado.regiones || estado.operaciones || estado.poblacion) {
          this.capaGeoJsonRegiones.addTo(this.map);
          if (estado.poblacion) {
            this.aplicarEstiloPoblacion();
          } else {
            this.aplicarEstiloRegiones(estado.operaciones);
          }
        } else {
          this.map.removeLayer(this.capaGeoJsonRegiones);
        }
      }

      if (!estado.poblacion && this.capaGeoJsonRegiones) {
        this.capaGeoJsonRegiones.closePopup();
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

    // Efecto reactivo para controlar controles de dibujo de Geoman en el mapa
    effect(() => {
      const activo = this.gis.moduloPoligonosActivo();
      if (!this.map) return;

      if (!activo) {
        // Desactivar herramientas de Geoman si el módulo no está activo
        this.map.pm.disableDraw();
        if (this.map.pm.globalEditModeEnabled()) this.map.pm.disableGlobalEditMode();
        if (this.map.pm.globalRemovalModeEnabled()) this.map.pm.disableGlobalRemovalMode();
        
        // Quitar la barra de herramientas del mapa
        this.map.pm.removeControls();

        // Limpiar figura activa y panel de análisis
        if (this.activeDrawnLayer) {
          this.map.removeLayer(this.activeDrawnLayer);
          this.activeDrawnLayer = null;
        }
        this.analisisFigura.set(null);
      } else {
        // Habilitar y mostrar la barra de herramientas de Geoman en el mapa
        this.map.pm.addControls({
          position: 'topleft',
          drawMarker: false,
          drawCircleMarker: false,
          drawPolyline: true,
          drawRectangle: true,
          drawPolygon: true,
          editMode: true,
          dragMode: true,
          cutPolygon: false,
          removalMode: true
        });
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
      center: [7.5, -66.1818], zoom: 6.3, zoomControl: false, minZoom: 5, maxZoom: 18,
      maxBounds: [[-15, -95], [25, -45]], maxBoundsViscosity: 1.0,
      preferCanvas: true // Renderizado por hardware mucho más rápido
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

    const cachedVenezuela = this.gis.getVenezuelaGeoJson();
    const procesarVenezuela = (data: any) => {
      this.geoJsonData = data;
      this.capaGeoJsonRegiones = L.geoJSON(data, {
        onEachFeature: (feature, layer) => {
          layer.on('click', (e) => {
            if (this.gis.capasVisibles().poblacion) {
              const nombre = feature.properties.estado || feature.properties.name;
              const pob = this.poblacionData[nombre] || 0;
              const popupHtml = this.renderer.crearPopupPoblacion(nombre, pob);
              layer.bindPopup(popupHtml, { maxWidth: 300 }).openPopup();
            } else {
              layer.unbindPopup();
            }
          });
        }
      });
      
      const estado = this.gis.capasVisibles();
      if (estado.regiones || estado.operaciones || estado.poblacion) {
        this.capaGeoJsonRegiones.addTo(this.map);
        if (estado.poblacion) {
          this.aplicarEstiloPoblacion();
        } else {
          this.aplicarEstiloRegiones(estado.operaciones);
        }
      }

      this.crearMascaraTerritorial(data);
    };

    if (cachedVenezuela) {
      procesarVenezuela(cachedVenezuela);
    } else {
      this.http.get('assets/geojson/venezuela.json').subscribe((data: any) => {
        this.gis.setVenezuelaGeoJson(data);
        procesarVenezuela(data);
      });
    }

    const cachedPoblacion = this.gis.getPoblacionData();
    const procesarPoblacion = (pob: any) => {
      this.poblacionData = pob;
      if (this.gis.capasVisibles().poblacion) {
        this.aplicarEstiloPoblacion();
      }
    };

    if (cachedPoblacion) {
      procesarPoblacion(cachedPoblacion);
    } else {
      this.http.get('assets/geojson/poblacion.json').subscribe({
        next: (pob: any) => {
          this.gis.setPoblacionData(pob);
          procesarPoblacion(pob);
        },
        error: (err) => console.error('Error cargando poblacion.json', err)
      });
    }

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Configurar idioma español para Leaflet Geoman
    this.map.pm.setLang('es');

    // Escuchar la creación de nuevas figuras
    this.map.on('pm:create', (e: any) => {
      const layer = e.layer;
      
      // Reemplazar la figura anterior por la nueva
      if (this.activeDrawnLayer) {
        this.map.removeLayer(this.activeDrawnLayer);
      }
      this.activeDrawnLayer = layer;

      // Realizar análisis inicial
      this.procesarFigura(layer);

      // Escuchar modificaciones de la figura
      layer.on('pm:edit', () => {
        this.procesarFigura(layer);
      });

      // Escuchar eliminación de la figura
      layer.on('pm:remove', () => {
        if (this.activeDrawnLayer === layer) {
          this.activeDrawnLayer = null;
        }
        this.analisisFigura.set(null);
      });
    });

    // Sincronizar estados del mapa hacia el signal de modo de dibujo
    this.map.on('pm:drawend', () => {
      this.gis.modoDibujo.set(null);
    });
    this.map.on('pm:globaleditmodetoggled', (e: any) => {
      if (!e.enabled && this.gis.modoDibujo() === 'Edit') {
        this.gis.modoDibujo.set(null);
      }
    });
    this.map.on('pm:globalremovalmodetoggled', (e: any) => {
      if (!e.enabled && this.gis.modoDibujo() === 'Removal') {
        this.gis.modoDibujo.set(null);
      }
    });

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

  private aplicarEstiloPoblacion() {
    if (!this.capaGeoJsonRegiones) return;

    const capas = this.gis.capasVisibles();
    const hayCapasEspeciales = capas.cotas || capas.electricidad || capas.vias;

    this.capaGeoJsonRegiones.setStyle((f: any) => {
      const nombre = f.properties.estado || f.properties.name;
      const pob = this.poblacionData[nombre] || 0;
      return this.renderer.getEstiloPoblacion(pob, hayCapasEspeciales);
    });
  }

  private renderIndividualMarkers(tipos: TipoElemento[]) {
    if (tipos.includes('antenas')) {
      const icon = this.renderer.crearPinIcon('antenas');
      const termino = this.gis.busquedaAntena().toLowerCase();
      this.gis.radioBasesSignal().filter(a => !termino || a.nombre?.toLowerCase().includes(termino) || a.direccion?.toLowerCase().includes(termino))
        .forEach(a => {
          if (a.latitud && a.longitud) {
            L.marker([a.latitud, a.longitud], { icon, pane: 'elementsPane' })
              .bindPopup(() => this.renderer.crearPopupDetalle('antenas', [
                { label: 'Nombre', value: a.nombre },
                { label: 'Ubicación', value: `${a.estado} (${a.region})` },
                { label: 'Tecnología', value: a.tecnologia },
                { label: 'Actividad', value: a.actividad, badge: true, badgeColor: this.renderer.getColorActividad(a.actividad) },
                { label: 'Dirección', value: a.direccion },
                { label: 'Coordenadas', value: this.renderer.formatCoords(a.latitud, a.longitud), coords: true }
              ]), { maxWidth: 400 })
              .addTo(this.radioBases);
          }
        });
      this.radioBases.addTo(this.map);
    }

    if (tipos.includes('oficinas')) {
      const icon = this.renderer.crearPinIcon('oficinas');
      this.gis.oficinasSignal().forEach(o => {
        if (o.latitud && o.longitud) {
          L.marker([o.latitud, o.longitud], { icon, pane: 'elementsPane' })
            .bindPopup(() => this.renderer.crearPopupDetalle('oficinas', [
              { label: 'Nombre', value: o.nombre },
              { label: 'Ubicación', value: `${o.estado} (${o.region})` },
              { label: 'Dirección', value: o.direccion },
              { label: 'Coordenadas', value: this.renderer.formatCoords(o.latitud, o.longitud), coords: true }
            ]), { maxWidth: 400 })
            .addTo(this.oficinas);
        }
      });
      this.oficinas.addTo(this.map);
    }

    if (tipos.includes('agentes')) {
      const icon = this.renderer.crearPinIcon('agentes');
      this.gis.agentesSignal().forEach(ag => {
        if (ag.latitud && ag.longitud) {
          L.marker([ag.latitud, ag.longitud], { icon, pane: 'elementsPane' })
            .bindPopup(() => this.renderer.crearPopupDetalle('agentes', [
              { label: 'Nombre', value: ag.nombre },
              { label: 'Ubicación', value: `${ag.estado} (${ag.region})` },
              { label: 'Cód. Dealer', value: ag.codigoDealer },
              { label: 'Clasificación', value: ag.clasificacion, badge: true },
              { label: 'Dirección', value: ag.direccion },
              { label: 'Coordenadas', value: this.renderer.formatCoords(ag.latitud, ag.longitud), coords: true }
            ]), { maxWidth: 400 })
            .addTo(this.agentes);
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
        if (g.latitud && g.longitud) {
          L.marker([g.latitud, g.longitud], { icon, pane: 'elementsPane' })
            .bindPopup(() => {
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
              return this.renderer.crearPopupDetalle('abonados', rows);
            }, { maxWidth: 400 })
            .addTo(this.abonados);
        }
      });
      this.abonados.addTo(this.map);
    }
  }

  private renderStateTotals(tipos: TipoElemento[]) {
    const renderedPoints: L.Point[] = [];
    const minDistance = 45; // Distancia mínima en píxeles para evitar solapamiento

    this.gis.estadosSignal().forEach(est => {
      const items = tipos.map(t => ({ tipo: t, total: this.gis.getTotalesPorEstado(t).get(est.nombre) || 0 })).filter(i => i.total > 0);
      if (items.length > 0) {
        const segBreakdown = tipos.includes('abonados') ? this.gis.abonadosSignal().filter(ab => ab.estado === est.nombre)
          .reduce((acc: any, ab) => { acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0); return acc; }, {}) : null;

        // --- LÓGICA DE EVITACIÓN DE COLISIONES ---
        const originalPoint = this.map.latLngToLayerPoint([est.latitud, est.longitud]);
        let adjustedPoint = originalPoint;
        let attempts = 0;
        let angle = 0;
        let radius = 0;
        let collision = true;

        while (collision && attempts < 15) {
          collision = renderedPoints.some(p => p.distanceTo(adjustedPoint) < minDistance);
          if (collision) {
            attempts++;
            angle += 1.1; // Ángulo de la espiral
            radius = 12 + (attempts * 3);
            adjustedPoint = L.point(
              originalPoint.x + radius * Math.cos(angle),
              originalPoint.y + radius * Math.sin(angle)
            );
          }
        }

        renderedPoints.push(adjustedPoint);
        const finalLatLng = this.map.layerPointToLatLng(adjustedPoint);

        L.marker(finalLatLng, {
          icon: this.renderer.crearBadgeGroupIcon(items),
          zIndexOffset: 1000 + attempts,
          pane: 'elementsPane'
        })
          .bindPopup(this.renderer.crearPopupAgregado(est.nombre, 'estado', items, segBreakdown)).addTo(this.layerAggregated);
      }
    });
  }

  private renderRegionTotals(tipos: TipoElemento[]) {
    const renderedPoints: L.Point[] = [];
    const minDistance = 50;

    this.gis.regionesSignal().forEach(reg => {
      const items = tipos.map(t => ({ tipo: t, total: this.gis.getTotalesPorRegion(t).get(reg.nombre) || 0 })).filter(i => i.total > 0);
      const centro = this.gis.getCentroRegion(reg.nombre);
      if (items.length > 0 && centro) {
        const segBreakdown = tipos.includes('abonados') ? this.gis.abonadosSignal().filter(ab => ab.region === reg.nombre)
          .reduce((acc: any, ab) => { acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0); return acc; }, {}) : null;

        // --- LÓGICA DE EVITACIÓN DE COLISIONES ---
        const originalPoint = this.map.latLngToLayerPoint([centro.lat, centro.lng]);
        let adjustedPoint = originalPoint;
        let attempts = 0;
        let angle = 0;
        let radius = 0;
        let collision = true;

        while (collision && attempts < 15) {
          collision = renderedPoints.some(p => p.distanceTo(adjustedPoint) < minDistance);
          if (collision) {
            attempts++;
            angle += 1.1;
            radius = 15 + (attempts * 4);
            adjustedPoint = L.point(
              originalPoint.x + radius * Math.cos(angle),
              originalPoint.y + radius * Math.sin(angle)
            );
          }
        }

        renderedPoints.push(adjustedPoint);
        const finalLatLng = this.map.layerPointToLatLng(adjustedPoint);

        L.marker(finalLatLng, {
          icon: this.renderer.crearBadgeGroupIcon(items, true),
          zIndexOffset: 2000 + attempts,
          pane: 'elementsPane'
        })
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
          onEachFeature: (f, l) => {
            l.bindPopup(this.renderer.crearPopupElectricidad(f.properties));
            
            // Si es una subestación, estación o generador y está representado como un polígono,
            // calculamos su centro geográfico para posicionar el icono de rayo
            const isStation = f.properties && (
              f.properties.power === 'substation' ||
              f.properties.power === 'station' ||
              f.properties.power === 'generator' ||
              f.properties.substation
            );
            
            if (isStation && typeof (l as any).getBounds === 'function') {
              const center = (l as any).getBounds().getCenter();
              const marker = L.marker(center, {
                icon: this.renderer.crearIconoSubestacion(),
                pane: 'elementsPane'
              });
              marker.bindPopup(this.renderer.crearPopupElectricidad(f.properties));
              this.capaElectricidad.addLayer(marker);
            }
          }
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

  private obtenerEstadoPorCoordenada(lat: number, lng: number): string | null {
    if (!this.geoJsonData) return null;
    for (const feature of this.geoJsonData.features) {
      const type = feature.geometry.type;
      const coords = feature.geometry.coordinates;
      const nombre = feature.properties.estado || feature.properties.name;

      const puntoEnGeoJsonPoligono = (ring: number[][]) => {
        const polyVertices = ring.map(p => L.latLng(p[1], p[0]));
        return this.mathService.puntoEnPoligono(lat, lng, polyVertices);
      };

      if (type === 'Polygon') {
        if (puntoEnGeoJsonPoligono(coords[0])) return nombre;
      } else if (type === 'MultiPolygon') {
        for (const poly of coords) {
          if (puntoEnGeoJsonPoligono(poly[0])) return nombre;
        }
      }
    }
    return null;
  }

  private obtenerEstadosIntersectados(layer: any, tipo: string, centro: L.LatLng | null, radio: number): string[] {
    const estados = new Set<string>();
    
    // Always add the centroid state just in case
    if (centro) {
      const estCentro = this.obtenerEstadoPorCoordenada(centro.lat, centro.lng);
      if (estCentro) estados.add(estCentro);
    }

    if (typeof layer.getBounds !== 'function') return Array.from(estados);
    const bounds = layer.getBounds();
    if (!bounds || !bounds.isValid()) return Array.from(estados);

    // Muestreo de 5x5 puntos dentro del bounding box
    const latStep = (bounds.getNorth() - bounds.getSouth()) / 4;
    const lngStep = (bounds.getEast() - bounds.getWest()) / 4;

    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const lat = bounds.getSouth() + (i * latStep);
        const lng = bounds.getWest() + (j * lngStep);

        let pointInside = false;
        if (tipo === 'circulo' && centro) {
           pointInside = this.mathService.puntoEnCirculo(lat, lng, centro, radio);
        } else if (tipo === 'poligono') {
           const latlngs = layer.getLatLngs();
           const vertices = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs) as L.LatLng[];
           pointInside = this.mathService.puntoEnPoligono(lat, lng, vertices);
        } else if (tipo === 'ruta') {
           const vertices = layer.getLatLngs() as L.LatLng[];
           pointInside = this.mathService.puntoCercaDeRuta(lat, lng, vertices, 500);
        }

        if (pointInside) {
          const est = this.obtenerEstadoPorCoordenada(lat, lng);
          if (est) estados.add(est);
        }
      }
    }

    return Array.from(estados);
  }

  /**
   * Procesa la figura dibujada para calcular métricas físicas y evaluar elementos internos/cercanos.
   */
  private procesarFigura(layer: L.Layer) {
    let tipo: 'poligono' | 'ruta' | 'circulo' = 'poligono';
    let vertices: L.LatLng[] = [];
    let area = 0;
    let perimetro = 0;
    let longitud = 0;
    let rumbo = 0;
    let cardinal = '';
    let centroCirculo: L.LatLng | null = null;
    let radioCirculo = 0;

    if (layer instanceof L.Circle) {
      tipo = 'circulo';
      centroCirculo = layer.getLatLng();
      radioCirculo = layer.getRadius();
      area = Math.PI * Math.pow(radioCirculo, 2);
      perimetro = 2 * Math.PI * radioCirculo;
    } else if (layer instanceof L.Polygon) {
      tipo = 'poligono';
      const latlngs = layer.getLatLngs();
      vertices = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs) as L.LatLng[];
      area = this.mathService.calcularAreaPoligono(vertices);
      perimetro = this.mathService.calcularPerimetroPoligono(vertices);
    } else if (layer instanceof L.Polyline) {
      tipo = 'ruta';
      vertices = layer.getLatLngs() as L.LatLng[];
      longitud = this.mathService.calcularLongitudRuta(vertices);
      if (vertices.length >= 2) {
        rumbo = this.mathService.calcularRumboInicial(vertices[0], vertices[vertices.length - 1]);
        cardinal = this.mathService.obtenerDireccionCardinal(rumbo);
      }
    }

    // Filtrar elementos (Radiobases, Agentes, Oficinas, Abonados)
    let radioBases = [];
    let agentes = [];
    let oficinas = [];
    let abonados = [];

    let centroide: L.LatLng | null = null;
    if (tipo === 'circulo' && centroCirculo) {
      centroide = centroCirculo;
    } else if (vertices.length > 0) {
      // Calcular centroide aproximado (promedio de vértices)
      const latSum = vertices.reduce((sum, v) => sum + v.lat, 0);
      const lngSum = vertices.reduce((sum, v) => sum + v.lng, 0);
      centroide = L.latLng(latSum / vertices.length, lngSum / vertices.length);
    }

    const estadosFigura = this.obtenerEstadosIntersectados(layer, tipo, centroide, radioCirculo);

    if (tipo === 'circulo' && centroCirculo) {
      radioBases = this.gis.radioBasesSignal().filter(rb => this.mathService.puntoEnCirculo(rb.latitud, rb.longitud, centroCirculo!, radioCirculo));
      agentes = this.gis.agentesSignal().filter(ag => this.mathService.puntoEnCirculo(ag.latitud, ag.longitud, centroCirculo!, radioCirculo));
      oficinas = this.gis.oficinasSignal().filter(of => this.mathService.puntoEnCirculo(of.latitud, of.longitud, centroCirculo!, radioCirculo));
      abonados = estadosFigura.length > 0 ? this.gis.abonadosSignal().filter(ab => estadosFigura.includes(ab.estado)) : [];
    } else if (tipo === 'poligono') {
      radioBases = this.gis.radioBasesSignal().filter(rb => this.mathService.puntoEnPoligono(rb.latitud, rb.longitud, vertices));
      agentes = this.gis.agentesSignal().filter(ag => this.mathService.puntoEnPoligono(ag.latitud, ag.longitud, vertices));
      oficinas = this.gis.oficinasSignal().filter(of => this.mathService.puntoEnPoligono(of.latitud, of.longitud, vertices));
      abonados = estadosFigura.length > 0 ? this.gis.abonadosSignal().filter(ab => estadosFigura.includes(ab.estado)) : [];
    } else {
      const bufferMetros = 500; // Radio de búsqueda alrededor de la ruta
      radioBases = this.gis.radioBasesSignal().filter(rb => this.mathService.puntoCercaDeRuta(rb.latitud, rb.longitud, vertices, bufferMetros));
      agentes = this.gis.agentesSignal().filter(ag => this.mathService.puntoCercaDeRuta(ag.latitud, ag.longitud, vertices, bufferMetros));
      oficinas = this.gis.oficinasSignal().filter(of => this.mathService.puntoCercaDeRuta(of.latitud, of.longitud, vertices, bufferMetros));
      abonados = estadosFigura.length > 0 ? this.gis.abonadosSignal().filter(ab => estadosFigura.includes(ab.estado)) : [];
    }

    const totalAbonados = abonados.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
    const recomendaciones = this.calcularRecomendacionesAnalisis(
      radioBases.length, 
      agentes.length, 
      oficinas.length, 
      totalAbonados,
      tipo,
      estadosFigura
    );

    this.analisisFigura.set({
      tipo,
      mediciones: {
        area,
        perimetro,
        longitud,
        rumbo,
        cardinal
      },
      conteos: {
        radioBases: radioBases.length,
        agentes: agentes.length,
        oficinas: oficinas.length,
        abonados: totalAbonados
      },
      recomendaciones
    });
  }

  /**
   * Genera recomendaciones de expansión basadas en los elementos encontrados.
   */
  private calcularRecomendacionesAnalisis(radiobasesLocales: number, agentes: number, oficinas: number, abonados: number, tipo: 'poligono' | 'ruta' | 'circulo', estadosFigura: string[]): any {
    const estadalSugerencias: string[] = [];
    const localSugerencias: string[] = [];
    const sufijo = (tipo === 'poligono' || tipo === 'circulo') ? 'dentro del área' : 'en la proximidad de la ruta';
    
    // --- Métrica Estadal (Abonados vs Antenas) ---
    if (estadosFigura && estadosFigura.length > 0) {
      const nombresEstados = estadosFigura.join(', ');
      if (abonados === 0) {
        estadalSugerencias.push(`El área abarca ${nombresEstados}, pero no posee abonados registrados en este momento. Considere campañas comerciales.`);
      } else {
        const radiobasesEvaluadas = this.gis.radioBasesSignal().filter(rb => estadosFigura.includes(rb.estado)).length;
        if (radiobasesEvaluadas === 0) {
          estadalSugerencias.push(`📡 Alerta crítica: El área abarca ${nombresEstados} y cuenta con ${abonados.toLocaleString()} abonados totales sin cobertura de radiobases. Sugerencia: Instalar al menos 1 Radiobase prioritaria.`);
        } else {
          const ratioRB = abonados / radiobasesEvaluadas;
          if (ratioRB > 350) {
            const necesarias = Math.ceil(abonados / 300) - radiobasesEvaluadas;
            estadalSugerencias.push(`📡 Saturación: La zona abarca ${nombresEstados} con ${abonados.toLocaleString()} abonados totales. Promedio de ${Math.round(ratioRB).toLocaleString()} clientes por antena. Sugerencia: Desplegar ${necesarias} nuevas radiobases en total para aliviar la carga general de los estados involucrados.`);
          } else {
            estadalSugerencias.push(`📡 Cobertura Óptima: La zona abarca ${nombresEstados} con ${abonados.toLocaleString()} abonados y ${radiobasesEvaluadas} antenas. Promedio de ${Math.round(ratioRB).toLocaleString()} clientes por antena.`);
          }
        }
      }
    }

    // --- Métrica Local (Oficinas y Agentes dentro del polígono) ---
    if (oficinas === 0) {
      localSugerencias.push(`🏢 Atención Comercial: Se detectaron 0 oficinas ${sufijo}. Sugerencia: Instalar 1 Oficina de Atención en esta zona.`);
    } else {
      localSugerencias.push(`🏢 Atención Comercial: Se detectaron ${oficinas} oficinas ${sufijo}, cubriendo la atención al cliente de la zona.`);
    }

    if (agentes === 0) {
      localSugerencias.push(`🛍️ Red de Ventas: Se detectaron 0 agentes autorizados en los límites del dibujo. Sugerencia: Certificar 2 nuevos agentes comerciales en este sector.`);
    } else if (agentes < 3) {
      localSugerencias.push(`🛍️ Red de Ventas: Se detectaron ${agentes} agentes autorizados. Sugerencia: Certificar al menos ${3 - agentes} nuevos agentes comerciales para fortalecer el sector.`);
    } else {
      localSugerencias.push(`🛍️ Red de Ventas: Presencia comercial sólida con ${agentes} agentes autorizados en los límites del dibujo.`);
    }

    return {
      estadal: (estadosFigura && estadosFigura.length > 0) ? {
        titulo: `Métrica Estadal (Datos Macroscópicos de ${estadosFigura.join(', ')})`,
        sugerencias: estadalSugerencias
      } : null,
      local: {
        titulo: 'Métrica Local (Dentro del Polígono Dibujado)',
        sugerencias: localSugerencias
      }
    };
  }

}
