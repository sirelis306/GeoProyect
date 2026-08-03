import {
  Component,
  AfterViewInit,
  inject,
  ElementRef,
  ViewChild,
  effect,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GisService as Gis } from '../../services/gis/gisService';
import { TipoElemento, ProyectoFigura } from '../../models/gis';
import * as L from 'leaflet';
import { ProyectoService } from '../../services/proyecto/proyectoService';
import { Totales } from '../totales/totales';
import { ElementRendererService } from '../../services/element/elementRendererService';
import { GisMathService } from '../../services/gis/gisMathService';
import { Polygons } from '../polygons/polygons';
import { ProjectManager } from '../project-manager/project-manager';
import '@geoman-io/leaflet-geoman-free';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, Totales, Polygons, ProjectManager],
  templateUrl: './map.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './map.css',
})
export class Map implements AfterViewInit {
  public gis = inject(Gis);
  private http = inject(HttpClient);
  private renderer = inject(ElementRendererService);
  private mathService = inject(GisMathService);
  public proyectoService = inject(ProyectoService);

  public leyendaAbierta = signal(true);
  public analisisFigura = signal<any | null>(null);
  private activeDrawnLayer: L.Layer | null = null;
  private projectShapesLayer = L.layerGroup();
  private pmEditDebounceTimer: any = null;

  public hoverInfo = signal<{ nombre: string; sub: string; x: number; y: number } | null>(null);

  mostrarHoverInfo(nombre: string, sub: string, containerPoint: L.Point) {
    this.hoverInfo.set({
      nombre,
      sub,
      x: containerPoint.x + 15,
      y: containerPoint.y + 15,
    });
  }

  ocultarHoverInfo() {
    this.hoverInfo.set(null);
  }

  private capaGeoJsonRegiones: L.GeoJSON | null = null;
  private capaGeoJsonParroquias: L.GeoJSON | null = null;
  private geoJsonData: any = null;
  private parroquiasGeoJsonData: any = null;
  private parroquiaCentros: Record<string, L.LatLng> = {};
  private areaPorEstado: Record<string, number> = {};
  private capaEtiquetas = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    {
      zIndex: 1000,
      pane: 'markerPane',
    },
  );
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private map!: L.Map;
  private poblacionData: Record<string, number> = {};

  private radioBases = L.layerGroup();
  private abonados = L.layerGroup();
  private oficinas = L.layerGroup();
  private agentes = L.layerGroup();
  private layerAggregated = L.layerGroup();
  private capaCotas = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    {
      zIndex: 100,
      opacity: 0.6,
    },
  );
  private capaElectricidad = L.layerGroup();
  private datosElectricidadCargados = false;
  private capaElectricidadGeoJson: L.GeoJSON | null = null;
  private capaBordeVenezuela: L.LayerGroup | null = null;
  private viasActivoAnterior = false;

  // Capa Satelital para vista real en zoom cercano
  private capaSatelite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      zIndex: 405,
    },
  );

  // Tiles base: CartoDB Voyager (Versión completa con calles y detalles)
  private tileBase = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { zIndex: 1 },
  );

  constructor() {
    // Escuchar figuras del proyecto activo para renderizarlas (sólo si el módulo está activo y no hay previsualización activa)
    effect(() => {
      const figuras = this.proyectoService.figurasProyectoActivo();
      const activo = this.gis.moduloPoligonosActivo();
      const importacionActiva = this.gis.importacionPreliminarActiva();

      if (activo && !importacionActiva) {
        this.actualizarFigurasProyectoEnMapa(figuras);
      } else {
        this.projectShapesLayer.clearLayers();
      }
    });

    // Escuchar figura enfocada para centrar la cámara del mapa
    effect(() => {
      const figura = this.gis.figuraEnfocada();
      if (figura) {
        this.centrarCamaraEnFigura(figura);
        setTimeout(() => this.gis.figuraEnfocada.set(null), 100);
      }
    });

    // Escuchar caja de mapa para ajustar límites (fitBounds)
    effect(() => {
      const bounds = this.gis.cajaMapaAjustar();
      if (bounds && this.map) {
        this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
        setTimeout(() => this.gis.cajaMapaAjustar.set(null), 100);
      }
    });

    effect(() => {
      const estado = this.gis.capasVisibles();
      const analisis = this.analisisFigura(); // Hace que este efecto reaccione cuando se enfoca/desenfoca un polígono
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
      const viasActivado = estado.vias;
      if (viasActivado) {
        // Si se acaba de activar (transición false -> true) y el zoom actual es menor a 14, hacemos zoom automático
        if (!this.viasActivoAnterior) {
          const currentZoom = this.map.getZoom();
          if (currentZoom < 14) {
            this.map.setView([10.4806, -66.9036], 14, { animate: true });
          }
        }

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
      this.viasActivoAnterior = viasActivado;

      // Limpieza
      [this.radioBases, this.oficinas, this.abonados, this.agentes].forEach((g) => g.clearLayers());
      if (this.layerAggregated) this.layerAggregated.clearLayers();

      // --- LÓGICA CAPA 1 (GEOMETRÍA) ---
      if (estado.regiones || estado.operaciones || estado.poblacion) {
        if (estado.poblacion) {
          this.aplicarEstiloPoblacion();
        } else {
          if (this.capaGeoJsonRegiones) this.capaGeoJsonRegiones.addTo(this.map);
          if (this.capaGeoJsonParroquias) this.map.removeLayer(this.capaGeoJsonParroquias);
          this.aplicarEstiloRegiones(estado.operaciones);
        }
      } else {
        if (this.capaGeoJsonRegiones) this.map.removeLayer(this.capaGeoJsonRegiones);
        if (this.capaGeoJsonParroquias) this.map.removeLayer(this.capaGeoJsonParroquias);
      }

      if (!estado.poblacion) {
        if (this.capaGeoJsonRegiones) this.capaGeoJsonRegiones.closePopup();
        if (this.capaGeoJsonParroquias) this.capaGeoJsonParroquias.closePopup();
      }

      // --- LÓGICA DE VISUALIZACIÓN SEGÚN ZOOM ---
      const zoom = this.gis.zoomLevel();
      
      if (analisis && (analisis.tipo === 'poligono' || analisis.tipo === 'circulo' || analisis.tipo === 'ruta')) {
        // Mostrar siempre los elementos del polígono como pines individuales,
        // ocultando cualquier total o pin del resto del país.
        this.renderIndividualMarkers(['antenas', 'oficinas', 'agentes']);
      } else if (estado.operaciones) {
        if (zoom >= 11.5) {
          this.renderIndividualMarkers(estado.detalleOperaciones);
        } else if (zoom >= 8.5) {
          this.renderParroquiaTotals(estado.detalleOperaciones);
        } else {
          this.renderStateTotals(estado.detalleOperaciones);
        }
      } else if (estado.regiones) {
        if (zoom >= 8.5) {
          this.renderParroquiaTotals(estado.detalleRegiones);
        } else {
          this.renderRegionTotals(estado.detalleRegiones);
        }
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
        if (this.map.pm.globalDragModeEnabled && this.map.pm.globalDragModeEnabled()) this.map.pm.disableGlobalDragMode();

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
          removalMode: true,
        });
      }
    });
  }

  ngAfterViewInit() {
    if (this.mapContainer && this.mapContainer.nativeElement) this.initMap();
  }

  private initMap() {
    const iconRetinaUrl =
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
    const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
    const shadowUrl =
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';
    L.Marker.prototype.options.icon = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [7.5, -66.1818],
      zoom: 6.3,
      zoomControl: false,
      minZoom: 5,
      maxZoom: 18,
      maxBounds: [
        [-15, -95],
        [25, -45],
      ],
      maxBoundsViscosity: 1.0,
      // preferCanvas removido: el uso de Canvas con múltiples paneles superpuestos bloquea los eventos del mouse. SVG es óptimo aquí.
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

    // Crear un panel para figuras dibujadas por el usuario (Geoman) para que estén por encima de la capa base de regiones/parroquias
    const drawnPane = this.map.createPane('drawnPane');
    if (drawnPane) {
      drawnPane.style.zIndex = '450';
      drawnPane.style.pointerEvents = 'none'; // Permite clics a las capas inferiores, Leaflet maneja los clics de las figuras en SVG
    }

    this.map.on('zoomend', () => this.gis.zoomLevel.set(this.map.getZoom()));
    this.layerAggregated.addTo(this.map);

    // Configurar el panel de dibujado para usar la capa superior
    this.map.pm.setPathOptions({ pane: 'drawnPane' });

    const cachedVenezuela = this.gis.getVenezuelaGeoJson();
    const procesarVenezuela = (data: any) => {
      this.geoJsonData = data;
      this.capaGeoJsonRegiones = L.geoJSON(data, {
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', (e: any) => {
            const capas = this.gis.capasVisibles();
            if (capas.regiones || capas.operaciones || capas.poblacion) {
              (layer as L.Path).setStyle({
                weight: 3,
                color: '#ffffff',
                fillOpacity: 0.8,
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                (layer as any).bringToFront();
              }
              const nombre = feature.properties.estado || feature.properties.name || '';
              const regionText = feature.properties.region
                ? `Región: ${feature.properties.region}`
                : '';
              this.mostrarHoverInfo(nombre, regionText, e.containerPoint);
            }
          });

          layer.on('mousemove', (e: any) => {
            if (this.hoverInfo()) {
              this.hoverInfo.update((h) =>
                h ? { ...h, x: e.containerPoint.x + 15, y: e.containerPoint.y + 15 } : null,
              );
            }
          });

          layer.on('mouseout', () => {
            if (this.capaGeoJsonRegiones) {
              const estado = this.gis.capasVisibles();
              if (estado.poblacion) {
                this.aplicarEstiloPoblacion();
              } else {
                this.aplicarEstiloRegiones(estado.operaciones);
              }
            }
            this.ocultarHoverInfo();
          });

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
        },
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
        error: (err) => console.error('Error cargando poblacion.json', err),
      });
    }

    const procesarParroquias = (data: any) => {
      this.parroquiasGeoJsonData = data;
      this.parroquiaCentros = {};
      this.areaPorEstado = {};

      // Calcular áreas totales por estado
      data.features.forEach((f: any) => {
        const estado = f.properties.adm1_name;
        const area = f.properties.area_sqkm || 0;
        if (estado) {
          this.areaPorEstado[estado] = (this.areaPorEstado[estado] || 0) + area;
        }
      });

      data.features.forEach((f: any) => {
        const pName = f.properties.adm3_name;
        const estado = f.properties.adm1_name;
        const uniqueKey = `${pName}_${estado}`;

        const cLat = f.properties.center_lat;
        const cLon = f.properties.center_lon;
        if (cLat !== undefined && cLon !== undefined) {
          this.parroquiaCentros[uniqueKey] = L.latLng(cLat, cLon);
        }
      });

      this.capaGeoJsonParroquias = L.geoJSON(data, {
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', (e: any) => {
            if (this.gis.capasVisibles().poblacion && this.gis.zoomLevel() >= 8.5) {
              (layer as L.Path).setStyle({
                weight: 3,
                color: '#ffffff',
                fillOpacity: 0.8,
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                (layer as any).bringToFront();
              }
              const name = feature.properties.adm3_name || '';
              const municipio = feature.properties.adm2_name || '';
              const estado = feature.properties.adm1_name || '';
              this.mostrarHoverInfo(name, `Municipio: ${municipio} - ${estado}`, e.containerPoint);
            }
          });

          layer.on('mousemove', (e: any) => {
            if (this.hoverInfo()) {
              this.hoverInfo.update((h) =>
                h ? { ...h, x: e.containerPoint.x + 15, y: e.containerPoint.y + 15 } : null,
              );
            }
          });

          layer.on('mouseout', () => {
            if (this.capaGeoJsonParroquias) {
              this.aplicarEstiloPoblacion();
            }
            this.ocultarHoverInfo();
          });

          layer.on('click', (e) => {
            if (this.gis.capasVisibles().poblacion) {
              const name = feature.properties.adm3_name;
              const municipio = feature.properties.adm2_name;
              const estado = feature.properties.adm1_name;
              const area = feature.properties.area_sqkm || 0;
              const totalArea = this.areaPorEstado[estado] || 1;
              const pobEstado = this.poblacionData[estado] || 0;
              const pob = (area / totalArea) * pobEstado;
              const popupHtml = this.renderer.crearPopupPoblacion(
                name,
                Math.round(pob),
                municipio,
                estado,
              );
              layer.bindPopup(popupHtml, { maxWidth: 300 }).openPopup();
            } else {
              layer.unbindPopup();
            }
          });
        },
      });

      const estado = this.gis.capasVisibles();
      if (estado.poblacion) {
        this.aplicarEstiloPoblacion();
      }
    };

    const cachedParroquias = this.gis.parroquiasData;
    if (cachedParroquias) {
      procesarParroquias(cachedParroquias);
    } else {
      this.http.get('assets/geojson/parroquias.json').subscribe({
        next: (data: any) => {
          procesarParroquias(data);
        },
        error: (err) => console.error('Error cargando parroquias.json en initMap:', err),
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

      // Forzar que la figura esté en el pane superior 'drawnPane'
      if (layer && layer.options) {
        this.map.removeLayer(layer);
        layer.options.pane = 'drawnPane';
        layer.addTo(this.map);
      }

      this.activeDrawnLayer = layer;

      // Realizar análisis inicial (se activa el panel flotante derecho)
      this.procesarFigura(layer);

      // Escuchar clic en la figura para volver a abrir el panel si se cerró
      layer.on('click', (ev: any) => {
        L.DomEvent.stopPropagation(ev); // Evitar que el clic se propague al mapa
        this.procesarFigura(layer);
      });

      // Escuchar modificaciones de la figura con Debounce
      layer.on('pm:edit', () => {
        if (this.pmEditDebounceTimer) clearTimeout(this.pmEditDebounceTimer);
        this.pmEditDebounceTimer = setTimeout(() => {
          this.procesarFigura(layer);
        }, 300);
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

  private actualizarFigurasProyectoEnMapa(figuras: ProyectoFigura[]) {
    if (!this.map) return;
    this.projectShapesLayer.clearLayers();

    figuras.forEach((f) => {
      if (f.visible === false) return;

      let layer: L.Layer | null = null;
      const color = f.color || '#4f46e5';
      const options = {
        color: color,
        fillColor: color,
        fillOpacity: 0.25,
        weight: 3,
        pane: 'drawnPane',
      };

      let coords: any;
      try {
        coords = typeof f.coordenadas === 'string' ? JSON.parse(f.coordenadas) : f.coordenadas;
      } catch (e) {
        console.error('Error al parsear coordenadas de figura:', f, e);
        coords = f.coordenadas;
      }

      if (f.tipo === 'poligono') {
        layer = L.polygon(coords, options);
      } else if (f.tipo === 'ruta') {
        layer = L.polyline(coords, options);
      } else if (f.tipo === 'circulo' && f.radio) {
        const centro = coords;
        if (centro) {
          const lat =
            centro.lat !== undefined ? centro.lat : Array.isArray(centro) ? centro[0] : undefined;
          const lng =
            centro.lng !== undefined ? centro.lng : Array.isArray(centro) ? centro[1] : undefined;
          if (lat !== undefined && lng !== undefined) {
            layer = L.circle([lat, lng], { ...options, radius: f.radio });
          }
        }
      }

      if (layer) {
        (layer as any).dbFigura = f;
        layer.on('click', (ev: any) => {
          L.DomEvent.stopPropagation(ev);
          this.procesarFigura(ev.target, false);
        });

        layer.bindTooltip(f.nombre, { permanent: false, direction: 'center' });
        this.projectShapesLayer.addLayer(layer);
      }
    });

    this.projectShapesLayer.addTo(this.map);
  }

  private centrarCamaraEnFigura(f: ProyectoFigura) {
    if (!this.map) return;

    if (f.tipo === 'poligono' || f.tipo === 'ruta') {
      const poly = f.tipo === 'poligono' ? L.polygon(f.coordenadas) : L.polyline(f.coordenadas);
      const bounds = poly.getBounds();
      if (bounds.isValid()) {
        // Reducimos maxZoom a 11 e incrementamos padding para ver el contexto a altura moderada
        this.map.fitBounds(bounds, { padding: [120, 120], maxZoom: 11 });
      }
    } else if (f.tipo === 'circulo' && f.radio) {
      const centro = f.coordenadas;
      // Cálculo manual del Bounding Box (límites) del círculo usando trigonometría simple
      const earthRadius = 6378137; // en metros
      const dLat = (f.radio / earthRadius) * (180 / Math.PI);
      const dLng =
        (f.radio / (earthRadius * Math.cos((centro.lat * Math.PI) / 180))) * (180 / Math.PI);

      const bounds = L.latLngBounds(
        [centro.lat - dLat, centro.lng - dLng],
        [centro.lat + dLat, centro.lng + dLng],
      );

      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [120, 120], maxZoom: 11 });
      }
    }
  }

  private aplicarEstiloRegiones(usarColorEstado: boolean) {
    if (!this.capaGeoJsonRegiones) return;

    const estadosConDatos = new Set(this.gis.getEstadosConDatos().map((e) => e.nombre));
    const regionesActivas = this.gis.getRegionesConDatos();
    const capas = this.gis.capasVisibles();
    const hayCapasEspeciales = capas.cotas || capas.electricidad || capas.vias;

    this.capaGeoJsonRegiones.setStyle((f: any) => {
      const nombre = f.properties.estado || f.properties.name;
      const region = this.gis.obtenerRegion(nombre);
      const tieneDatos = usarColorEstado
        ? estadosConDatos.has(nombre)
        : regionesActivas.includes(region);
      const color = usarColorEstado
        ? this.gis.getColorEstado(nombre)
        : this.gis.COLORES_REGIONES_SIGNAL()[region] || '#DEE2E6';

      return {
        fillColor: tieneDatos ? color : 'transparent',
        weight: tieneDatos ? 1.5 : 0.5,
        opacity: tieneDatos ? 1 : 0.3,
        color: '#FFFFFF',
        fillOpacity: tieneDatos ? (hayCapasEspeciales ? 0.3 : 0.7) : 0, // Más transparente si hay capas de info extra
      };
    });
  }

  private aplicarEstiloPoblacion() {
    const zoom = this.gis.zoomLevel();
    const mostrarPars = zoom >= 8.5;
    const capas = this.gis.capasVisibles();
    const hayCapasEspeciales = capas.cotas || capas.electricidad || capas.vias;

    if (mostrarPars && this.capaGeoJsonParroquias) {
      if (this.capaGeoJsonRegiones) this.map.removeLayer(this.capaGeoJsonRegiones);
      this.capaGeoJsonParroquias.addTo(this.map);

      this.capaGeoJsonParroquias.setStyle((f: any) => {
        const estado = f.properties.adm1_name;
        const area = f.properties.area_sqkm || 0;
        const totalArea = this.areaPorEstado[estado] || 1;
        const pobEstado = this.poblacionData[estado] || 0;
        const pob = (area / totalArea) * pobEstado;
        return this.renderer.getEstiloPoblacion(pob, hayCapasEspeciales, true);
      });
    } else {
      if (this.capaGeoJsonParroquias) this.map.removeLayer(this.capaGeoJsonParroquias);
      if (this.capaGeoJsonRegiones) this.capaGeoJsonRegiones.addTo(this.map);

      if (this.capaGeoJsonRegiones) {
        this.capaGeoJsonRegiones.setStyle((f: any) => {
          const nombre = f.properties.estado || f.properties.name;
          const pob = this.poblacionData[nombre] || 0;
          return this.renderer.getEstiloPoblacion(pob, hayCapasEspeciales, false);
        });
      }
    }
  }

  private renderParroquiaTotals(tipos: TipoElemento[]) {
    const renderedPoints: L.Point[] = [];
    const minDistance = 35; // Distancia mínima para evitar solapamientos entre parroquias cercanas
    const renderedKeys = new Set<string>();

    if (!this.parroquiasGeoJsonData) return;

    this.parroquiasGeoJsonData.features.forEach((f: any) => {
      const pName = f.properties.adm3_name;
      const estado = f.properties.adm1_name;
      const uniqueKey = `${pName}_${estado}`;

      if (renderedKeys.has(uniqueKey)) return;
      renderedKeys.add(uniqueKey);

      const centro = this.parroquiaCentros[uniqueKey];
      if (!centro) return;

      const items = tipos
        .map((t) => ({
          tipo: t,
          total: this.gis.getTotalesPorParroquia(t).get(uniqueKey) || 0,
        }))
        .filter((i) => i.total > 0);

      if (items.length > 0) {
        const segBreakdown = tipos.includes('abonados')
          ? this.gis
              .abonadosSignal()
              .filter((ab) => ab.parroquia === pName && ab.estado === estado)
              .reduce((acc: any, ab) => {
                acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
                return acc;
              }, {})
          : null;

        const agenteBreakdown = tipos.includes('agentes')
          ? this.gis
              .agentesSignal()
              .filter((ag) => ag.parroquia === pName && ag.estado === estado)
              .reduce((acc: any, ag) => {
                acc[ag.clasificacion || 'AA'] =
                  (acc[ag.clasificacion || 'AA'] || 0) + (Number(ag.cantidad) || 1);
                return acc;
              }, {})
          : null;

        const originalPoint = this.map.latLngToLayerPoint(centro);
        let adjustedPoint = originalPoint;
        let attempts = 0;
        let angle = 0;
        let radius = 0;
        let collision = true;

        while (collision && attempts < 10) {
          collision = renderedPoints.some((p) => p.distanceTo(adjustedPoint) < minDistance);
          if (collision) {
            attempts++;
            angle += 1.1;
            radius = 10 + attempts * 3;
            adjustedPoint = L.point(
              originalPoint.x + radius * Math.cos(angle),
              originalPoint.y + radius * Math.sin(angle),
            );
          }
        }

        renderedPoints.push(adjustedPoint);
        const finalLatLng = this.map.layerPointToLatLng(adjustedPoint);

        L.marker(finalLatLng, {
          icon: this.renderer.crearBadgeGroupIcon(items, 'parroquia'),
          zIndexOffset: 1500 + attempts,
          pane: 'elementsPane',
        })
          .bindPopup(
            this.renderer.crearPopupAgregado(
              `${pName} (${estado})`,
              'estado',
              items,
              segBreakdown,
              agenteBreakdown,
            ),
          )
          .addTo(this.layerAggregated);
      }
    });
  }

  private renderIndividualMarkers(tipos: TipoElemento[]) {
    const analisis = this.analisisFigura();
    const isFiltered = !!analisis && (analisis.tipo === 'poligono' || analisis.tipo === 'circulo' || analisis.tipo === 'ruta');

    if (tipos.includes('antenas')) {
      const icon = this.renderer.crearPinIcon('antenas');
      const termino = this.gis.busquedaAntena().toLowerCase();
      
      const dataSource = isFiltered && analisis.elementos ? analisis.elementos.radioBases : this.gis.radioBasesSignal();
      
      dataSource
        .filter(
          (a: any) =>
            !termino ||
            a.nombre?.toLowerCase().includes(termino) ||
            a.direccion?.toLowerCase().includes(termino),
        )
        .forEach((a: any) => {
          if (a.latitud && a.longitud) {
            L.marker([a.latitud, a.longitud], { icon, pane: 'elementsPane' })
              .bindPopup(
                () =>
                  this.renderer.crearPopupDetalle('antenas', [
                    { label: 'Nombre', value: a.nombre },
                    { label: 'Ubicación', value: `${a.estado} (${a.region})` },
                    { label: 'Tecnología', value: a.tecnologia },
                    {
                      label: 'Actividad',
                      value: a.actividad,
                      badge: true,
                      badgeColor: this.renderer.getColorActividad(a.actividad),
                    },
                    { label: 'Dirección', value: a.direccion },
                    {
                      label: 'Coordenadas',
                      value: this.renderer.formatCoords(a.latitud, a.longitud),
                      coords: true,
                    },
                  ]),
                { maxWidth: 400 },
              )
              .addTo(this.radioBases);
          }
        });
      this.radioBases.addTo(this.map);
    }

    if (tipos.includes('oficinas')) {
      const icon = this.renderer.crearPinIcon('oficinas');
      const dataSource = isFiltered && analisis.elementos ? analisis.elementos.oficinas : this.gis.oficinasSignal();
      dataSource.forEach((o: any) => {
        if (o.latitud && o.longitud) {
          L.marker([o.latitud, o.longitud], { icon, pane: 'elementsPane' })
            .bindPopup(
              () =>
                this.renderer.crearPopupDetalle('oficinas', [
                  { label: 'Nombre', value: o.nombre },
                  { label: 'Ubicación', value: `${o.estado} (${o.region})` },
                  { label: 'Dirección', value: o.direccion },
                  {
                    label: 'Coordenadas',
                    value: this.renderer.formatCoords(o.latitud, o.longitud),
                    coords: true,
                  },
                ]),
              { maxWidth: 400 },
            )
            .addTo(this.oficinas);
        }
      });
      this.oficinas.addTo(this.map);
    }

    if (tipos.includes('agentes')) {
      const icon = this.renderer.crearPinIcon('agentes');
      const dataSource = isFiltered && analisis.elementos ? analisis.elementos.agentes : this.gis.agentesSignal();
      dataSource.forEach((ag: any) => {
        if (ag.latitud && ag.longitud) {
          L.marker([ag.latitud, ag.longitud], { icon, pane: 'elementsPane' })
            .bindPopup(
              () =>
                this.renderer.crearPopupDetalle('agentes', [
                  { label: 'Nombre', value: ag.nombre },
                  { label: 'Ubicación', value: `${ag.estado} (${ag.region})` },
                  { label: 'Cód. Dealer', value: ag.codigoDealer },
                  { label: 'Clasificación', value: ag.clasificacion, badge: true },
                  { label: 'Dirección', value: ag.direccion },
                  {
                    label: 'Coordenadas',
                    value: this.renderer.formatCoords(ag.latitud, ag.longitud),
                    coords: true,
                  },
                ]),
              { maxWidth: 400 },
            )
            .addTo(this.agentes);
        }
      });
      this.agentes.addTo(this.map);
    }

    if (tipos.includes('abonados')) {
      const icon = this.renderer.crearPinIcon('abonados');
      const grupos: Record<string, any> = {};
      const dataSource = isFiltered && analisis.elementos ? analisis.elementos.abonados : this.gis.abonadosSignal();
      dataSource.forEach((ab: any) => {
        const key = `${Number(ab.latitud).toFixed(5)}_${Number(ab.longitud).toFixed(5)}`;
        if (!grupos[key])
          grupos[key] = { ...ab, nombre: ab.nombre.replace(/ 3G| 4G| 5G/gi, ''), segs: {} };
        grupos[key].segs[ab.segmentacion] =
          (grupos[key].segs[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
      });

      Object.values(grupos).forEach((g) => {
        if (g.latitud && g.longitud) {
          L.marker([g.latitud, g.longitud], { icon, pane: 'elementsPane' })
            .bindPopup(
              () => {
                const total = Object.values(g.segs).reduce((a: any, b: any) => a + b, 0) as number;
                const rows: any[] = [
                  { label: 'Nombre', value: g.nombre },
                  { label: 'Ubicación', value: `${g.estado} (${g.region})` },
                ];
                if (Object.keys(g.segs).length > 1) {
                  rows.push(
                    { label: 'Desglose', breakdown: g.segs },
                    { label: 'Total General', value: total.toLocaleString(), badge: true },
                  );
                } else {
                  const [s, c] = Object.entries(g.segs)[0];
                  rows.push(
                    { label: 'Segmentación', value: s, badge: true },
                    { label: 'Cantidad', value: (c as number).toLocaleString() },
                  );
                }
                if (g.direccion) rows.push({ label: 'Dirección', value: g.direccion });
                rows.push({
                  label: 'Coordenadas',
                  value: this.renderer.formatCoords(g.latitud, g.longitud),
                  coords: true,
                });
                return this.renderer.crearPopupDetalle('abonados', rows);
              },
              { maxWidth: 400 },
            )
            .addTo(this.abonados);
        }
      });
      this.abonados.addTo(this.map);
    }
  }

  private renderStateTotals(tipos: TipoElemento[]) {
    const renderedPoints: L.Point[] = [];
    const minDistance = 45; // Distancia mínima en píxeles para evitar solapamiento

    this.gis.estadosSignal().forEach((est) => {
      const items = tipos
        .map((t) => ({ tipo: t, total: this.gis.getTotalesPorEstado(t).get(est.nombre) || 0 }))
        .filter((i) => i.total > 0);
      if (items.length > 0) {
        const segBreakdown = tipos.includes('abonados')
          ? this.gis
              .abonadosSignal()
              .filter((ab) => ab.estado === est.nombre)
              .reduce((acc: any, ab) => {
                acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
                return acc;
              }, {})
          : null;

        const agenteBreakdown = tipos.includes('agentes')
          ? this.gis
              .agentesSignal()
              .filter((ag) => ag.estado === est.nombre)
              .reduce((acc: any, ag) => {
                acc[ag.clasificacion || 'AA'] =
                  (acc[ag.clasificacion || 'AA'] || 0) + (Number(ag.cantidad) || 1);
                return acc;
              }, {})
          : null;

        // --- LÓGICA DE EVITACIÓN DE COLISIONES ---
        const originalPoint = this.map.latLngToLayerPoint([est.latitud, est.longitud]);
        let adjustedPoint = originalPoint;
        let attempts = 0;
        let angle = 0;
        let radius = 0;
        let collision = true;

        while (collision && attempts < 15) {
          collision = renderedPoints.some((p) => p.distanceTo(adjustedPoint) < minDistance);
          if (collision) {
            attempts++;
            angle += 1.1; // Ángulo de la espiral
            radius = 12 + attempts * 3;
            adjustedPoint = L.point(
              originalPoint.x + radius * Math.cos(angle),
              originalPoint.y + radius * Math.sin(angle),
            );
          }
        }

        renderedPoints.push(adjustedPoint);
        const finalLatLng = this.map.layerPointToLatLng(adjustedPoint);

        L.marker(finalLatLng, {
          icon: this.renderer.crearBadgeGroupIcon(items, 'estado'),
          zIndexOffset: 1000 + attempts,
          pane: 'elementsPane',
        })
          .bindPopup(
            this.renderer.crearPopupAgregado(
              est.nombre,
              'estado',
              items,
              segBreakdown,
              agenteBreakdown,
            ),
          )
          .addTo(this.layerAggregated);
      }
    });
  }

  private renderRegionTotals(tipos: TipoElemento[]) {
    const renderedPoints: L.Point[] = [];
    const minDistance = 50;

    this.gis.regionesSignal().forEach((reg) => {
      const items = tipos
        .map((t) => ({ tipo: t, total: this.gis.getTotalesPorRegion(t).get(reg.nombre) || 0 }))
        .filter((i) => i.total > 0);
      const centro = this.gis.getCentroRegion(reg.nombre);
      if (items.length > 0 && centro) {
        const segBreakdown = tipos.includes('abonados')
          ? this.gis
              .abonadosSignal()
              .filter((ab) => ab.region === reg.nombre)
              .reduce((acc: any, ab) => {
                acc[ab.segmentacion] = (acc[ab.segmentacion] || 0) + (Number(ab.cantidad) || 0);
                return acc;
              }, {})
          : null;

        const agenteBreakdown = tipos.includes('agentes')
          ? this.gis
              .agentesSignal()
              .filter((ag) => ag.region === reg.nombre)
              .reduce((acc: any, ag) => {
                acc[ag.clasificacion || 'AA'] =
                  (acc[ag.clasificacion || 'AA'] || 0) + (Number(ag.cantidad) || 1);
                return acc;
              }, {})
          : null;

        // --- LÓGICA DE EVITACIÓN DE COLISIONES ---
        const originalPoint = this.map.latLngToLayerPoint([centro.lat, centro.lng]);
        let adjustedPoint = originalPoint;
        let attempts = 0;
        let angle = 0;
        let radius = 0;
        let collision = true;

        while (collision && attempts < 15) {
          collision = renderedPoints.some((p) => p.distanceTo(adjustedPoint) < minDistance);
          if (collision) {
            attempts++;
            angle += 1.1;
            radius = 15 + attempts * 4;
            adjustedPoint = L.point(
              originalPoint.x + radius * Math.cos(angle),
              originalPoint.y + radius * Math.sin(angle),
            );
          }
        }

        renderedPoints.push(adjustedPoint);
        const finalLatLng = this.map.layerPointToLatLng(adjustedPoint);

        L.marker(finalLatLng, {
          icon: this.renderer.crearBadgeGroupIcon(items, 'region'),
          zIndexOffset: 2000 + attempts,
          pane: 'elementsPane',
        })
          .bindPopup(
            this.renderer.crearPopupAgregado(
              reg.nombre,
              'region',
              items,
              segBreakdown,
              agenteBreakdown,
            ),
          )
          .addTo(this.layerAggregated);
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
          pointToLayer: (f, latlng) =>
            L.marker(latlng, {
              icon: this.renderer.crearIconoSubestacion(),
              pane: 'elementsPane',
            }),
          onEachFeature: (f, l) => {
            l.bindPopup(this.renderer.crearPopupElectricidad(f.properties));

            // Si es una subestación, estación o generador y está representado como un polígono,
            // calculamos su centro geográfico para posicionar el icono de rayo
            const isStation =
              f.properties &&
              (f.properties.power === 'substation' ||
                f.properties.power === 'station' ||
                f.properties.power === 'generator' ||
                f.properties.substation);

            if (isStation && typeof (l as any).getBounds === 'function') {
              const center = (l as any).getBounds().getCenter();
              const marker = L.marker(center, {
                icon: this.renderer.crearIconoSubestacion(),
                pane: 'elementsPane',
              });
              marker.bindPopup(this.renderer.crearPopupElectricidad(f.properties));
              this.capaElectricidad.addLayer(marker);
            }
          },
        });
        this.capaElectricidad.addLayer(this.capaElectricidadGeoJson);
      },
      error: () => (this.datosElectricidadCargados = false),
    });
  }

  private crearMascaraTerritorial(geoJson: any) {
    // Usamos un objeto simple para evitar colisión con el nombre de la clase 'Map'
    const segmentos: Record<string, { p1: [number, number]; p2: [number, number]; count: number }> =
      {};

    geoJson.features.forEach((feature: any) => {
      const coords =
        feature.geometry.type === 'Polygon'
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
    Object.values(segmentos).forEach((info) => {
      if (info.count === 1) {
        outlineSegments.push(
          L.polyline([info.p1, info.p2], {
            color: '#e2e2e2ff',
            weight: 2,
            interactive: false,
            pane: 'borderPane',
          }),
        );
      }
    });

    this.capaBordeVenezuela = L.layerGroup(outlineSegments) as any;

    // Si la capa de vías ya está activa, añadir el borde
    if (this.gis.capasVisibles().vias) {
      this.capaBordeVenezuela?.addTo(this.map);
    }
  }

  private obtenerParroquiaPorCoordenada(
    lat: number,
    lng: number,
  ): { name: string; municipio: string; estado: string } | null {
    if (!this.parroquiasGeoJsonData) return null;
    for (const feature of this.parroquiasGeoJsonData.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      const type = geom.type;
      const coords = geom.coordinates;
      const name = feature.properties.adm3_name;
      const municipio = feature.properties.adm2_name;
      const estado = feature.properties.adm1_name;

      const puntoEnGeoJsonPoligono = (ring: number[][]) => {
        const polyVertices = ring.map((p) => L.latLng(p[1], p[0]));
        return this.mathService.puntoEnPoligono(lat, lng, polyVertices);
      };

      try {
        if (type === 'Polygon') {
          if (puntoEnGeoJsonPoligono(coords[0])) return { name, municipio, estado };
        } else if (type === 'MultiPolygon') {
          for (const poly of coords) {
            if (puntoEnGeoJsonPoligono(poly[0])) return { name, municipio, estado };
          }
        }
      } catch (e) {}
    }
    return null;
  }

  private obtenerParroquiasIntersectadas(
    layer: any,
    tipo: string,
    centro: L.LatLng | null,
    radio: number,
  ): { name: string; municipio: string; estado: string }[] {
    const keySet = new Set<string>();
    const parroquias: { name: string; municipio: string; estado: string }[] = [];

    const addPar = (par: { name: string; municipio: string; estado: string } | null) => {
      if (!par) return;
      const key = `${par.name}_${par.estado}`;
      if (!keySet.has(key)) {
        keySet.add(key);
        parroquias.push(par);
      }
    };

    if (centro) {
      addPar(this.obtenerParroquiaPorCoordenada(centro.lat, centro.lng));
    }

    if (typeof layer.getBounds !== 'function') return parroquias;
    const bounds = layer.getBounds();
    if (!bounds || !bounds.isValid()) return parroquias;

    const latStep = (bounds.getNorth() - bounds.getSouth()) / 4;
    const lngStep = (bounds.getEast() - bounds.getWest()) / 4;

    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const lat = bounds.getSouth() + i * latStep;
        const lng = bounds.getWest() + j * lngStep;

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
          addPar(this.obtenerParroquiaPorCoordenada(lat, lng));
        }
      }
    }

    return parroquias;
  }

  /**
   * Verifica si un punto (lat, lng) pertenece a alguna otra figura previamente guardada en el proyecto activo.
   * Útil para evitar duplicidad de conteo cuando los polígonos se superponen.
   */
  private elementoEnOtrasFiguras(lat: number, lng: number, layerActual: L.Layer): boolean {
    const figuras = this.proyectoService.figurasProyectoActivo();
    const idActual = (layerActual as any).dbFigura?.id;
    
    // Ignoramos la figura actual (si ya está guardada)
    const otrasFiguras = figuras.filter(f => f.id !== idActual);

    for (const f of otrasFiguras) {
      if (!f.coordenadas) continue;
      let coords: any;
      try {
        coords = typeof f.coordenadas === 'string' ? JSON.parse(f.coordenadas) : f.coordenadas;
      } catch (e) {
        continue;
      }

      if (f.tipo === 'circulo' && f.radio) {
        const centro = coords;
        if (centro) {
          const cLat = centro.lat !== undefined ? centro.lat : Array.isArray(centro) ? centro[0] : undefined;
          const cLng = centro.lng !== undefined ? centro.lng : Array.isArray(centro) ? centro[1] : undefined;
          if (cLat !== undefined && cLng !== undefined) {
            if (this.mathService.puntoEnCirculo(lat, lng, L.latLng(cLat, cLng), f.radio)) return true;
          }
        }
      } else if (f.tipo === 'poligono') {
        const verticesRaw = Array.isArray(coords[0]) && Array.isArray(coords[0][0]) ? coords[0] : coords;
        if (Array.isArray(verticesRaw)) {
          const vertices = verticesRaw.map((v: any) => L.latLng(v.lat !== undefined ? v.lat : v[0], v.lng !== undefined ? v.lng : v[1]));
          if (this.mathService.puntoEnPoligono(lat, lng, vertices)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Procesa la figura dibujada para calcular métricas físicas y evaluar elementos internos/cercanos.
   */
  private procesarFigura(layer: L.Layer, esNueva: boolean = true) {
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

    // Filtrar elementos (Radiobases, Agentes, Oficinas)
    let radioBases = [];
    let agentes = [];
    let oficinas = [];

    let centroide: L.LatLng | null = null;
    if (tipo === 'circulo' && centroCirculo) {
      centroide = centroCirculo;
    } else if (vertices.length > 0) {
      const latSum = vertices.reduce((sum, v) => sum + v.lat, 0);
      const lngSum = vertices.reduce((sum, v) => sum + v.lng, 0);
      centroide = L.latLng(latSum / vertices.length, lngSum / vertices.length);
    }

    const parroquiasFigura = this.obtenerParroquiasIntersectadas(
      layer,
      tipo,
      centroide,
      radioCirculo,
    );
    const estadosFigura = Array.from(new Set(parroquiasFigura.map((p) => p.estado)));

    let bounds: L.LatLngBounds | null = null;
    if (typeof (layer as any).getBounds === 'function') {
      bounds = (layer as any).getBounds();
    }

    if (tipo === 'circulo' && centroCirculo) {
      radioBases = this.gis
        .radioBasesSignal()
        .filter((rb) =>
          (!bounds || bounds.contains([rb.latitud, rb.longitud])) &&
          this.mathService.puntoEnCirculo(rb.latitud, rb.longitud, centroCirculo!, radioCirculo) &&
          !this.elementoEnOtrasFiguras(rb.latitud, rb.longitud, layer)
        );
      agentes = this.gis
        .agentesSignal()
        .filter((ag) =>
          (!bounds || bounds.contains([ag.latitud, ag.longitud])) &&
          this.mathService.puntoEnCirculo(ag.latitud, ag.longitud, centroCirculo!, radioCirculo) &&
          !this.elementoEnOtrasFiguras(ag.latitud, ag.longitud, layer)
        );
      oficinas = this.gis
        .oficinasSignal()
        .filter((of) =>
          (!bounds || bounds.contains([of.latitud, of.longitud])) &&
          this.mathService.puntoEnCirculo(of.latitud, of.longitud, centroCirculo!, radioCirculo) &&
          !this.elementoEnOtrasFiguras(of.latitud, of.longitud, layer)
        );
    } else if (tipo === 'poligono') {
      radioBases = this.gis
        .radioBasesSignal()
        .filter((rb) => (!bounds || bounds.contains([rb.latitud, rb.longitud])) && this.mathService.puntoEnPoligono(rb.latitud, rb.longitud, vertices) && !this.elementoEnOtrasFiguras(rb.latitud, rb.longitud, layer));
      agentes = this.gis
        .agentesSignal()
        .filter((ag) => (!bounds || bounds.contains([ag.latitud, ag.longitud])) && this.mathService.puntoEnPoligono(ag.latitud, ag.longitud, vertices) && !this.elementoEnOtrasFiguras(ag.latitud, ag.longitud, layer));
      oficinas = this.gis
        .oficinasSignal()
        .filter((of) => (!bounds || bounds.contains([of.latitud, of.longitud])) && this.mathService.puntoEnPoligono(of.latitud, of.longitud, vertices) && !this.elementoEnOtrasFiguras(of.latitud, of.longitud, layer));
    } else {
      const bufferMetros = 500;
      radioBases = this.gis
        .radioBasesSignal()
        .filter((rb) =>
          this.mathService.puntoCercaDeRuta(rb.latitud, rb.longitud, vertices, bufferMetros),
        );
      agentes = this.gis
        .agentesSignal()
        .filter((ag) =>
          this.mathService.puntoCercaDeRuta(ag.latitud, ag.longitud, vertices, bufferMetros),
        );
      oficinas = this.gis
        .oficinasSignal()
        .filter((of) =>
          this.mathService.puntoCercaDeRuta(of.latitud, of.longitud, vertices, bufferMetros),
        );
    }

    // Calcular el total de abonados a nivel de estado(s) intersectado(s)
    const totalAbonados = this.gis
      .abonadosSignal()
      .filter((ab) => estadosFigura.includes(ab.estado))
      .reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);

    const recomendaciones = this.calcularRecomendacionesAnalisis(
      radioBases.length,
      agentes.length,
      oficinas.length,
      totalAbonados,
      tipo,
      parroquiasFigura,
    );

    this.analisisFigura.set({
      tipo,
      coordenadas: tipo === 'circulo' ? centroCirculo : vertices,
      radio: tipo === 'circulo' ? radioCirculo : null,
      esNueva,
      nombreExistente: (layer as any).dbFigura?.nombre || '',
      mediciones: {
        area,
        perimetro,
        longitud,
        rumbo,
        cardinal,
      },
      conteos: {
        radioBases: radioBases.length,
        agentes: agentes.length,
        oficinas: oficinas.length,
        abonados: totalAbonados,
      },
      elementos: { 
        radioBases, 
        agentes, 
        oficinas, 
        abonados: this.gis.abonadosSignal().filter(ab => estadosFigura.includes(ab.estado)) 
      },
      recomendaciones,
    });
  }

  /**
   * Genera recomendaciones de expansión basadas en los elementos encontrados.
   */
  private calcularRecomendacionesAnalisis(
    radiobasesLocales: number,
    agentes: number,
    oficinas: number,
    abonados: number,
    tipo: 'poligono' | 'ruta' | 'circulo',
    parroquiasFigura: { name: string; municipio: string; estado: string }[],
  ): any {
    const localSugerencias: string[] = [];
    const sufijo =
      tipo === 'poligono' || tipo === 'circulo' ? 'dentro del área' : 'en la proximidad de la ruta';

    // --- Métrica Inteligente de Carga Comercial (Radiobases vs Oficinas/Agentes) ---
    const radiobasesRequeridas = oficinas + Math.ceil(agentes / 3);

    if (radiobasesRequeridas === 0) {
      if (radiobasesLocales === 0) {
        localSugerencias.push(
          `📡 Cobertura de Radiobases: Se detectaron 0 radiobases ${sufijo}. Sugerencia: Evaluar el despliegue de una nueva antena si la zona presenta baja cobertura.`,
        );
      } else if (radiobasesLocales === 1) {
        localSugerencias.push(
          `📡 Cobertura de Radiobases: Se detectó 1 radiobase ${sufijo}, brindando cobertura directa a este sector.`,
        );
      } else {
        localSugerencias.push(
          `📡 Cobertura de Radiobases: Se detectaron ${radiobasesLocales} radiobases ${sufijo}, asegurando cobertura local.`,
        );
      }
    } else {
      if (radiobasesLocales === 0) {
        localSugerencias.push(
          `🚨 Alerta de Capacidad: Se detectó alta actividad comercial (${oficinas} oficina(s) / ${agentes} agente(s)) pero 0 radiobases locales. Sugerencia: Instalar de forma prioritaria al menos ${radiobasesRequeridas} radiobase(s) para dar soporte al canal de ventas y atención.`,
        );
      } else if (radiobasesLocales < radiobasesRequeridas) {
        localSugerencias.push(
          `⚠️ Insuficiencia de Red: Se cuenta con ${radiobasesLocales} radiobase(s) para una demanda comercial estimada de ${radiobasesRequeridas} antenas. Sugerencia: Desplegar ${radiobasesRequeridas - radiobasesLocales} nueva(s) radiobase(s) para evitar congestión en los puntos de venta y oficinas.`,
        );
      } else {
        localSugerencias.push(
          `📡 Cobertura de Radiobases: Se detectaron ${radiobasesLocales} radiobases locales, lo cual es óptimo para soportar la carga de la infraestructura comercial del área (${radiobasesRequeridas} recomendada(s)).`,
        );
      }
    }

    // --- Métrica Local (Oficinas dentro del polígono) ---
    if (oficinas === 0) {
      localSugerencias.push(
        `🏢 Atención Comercial: Se detectaron 0 oficinas ${sufijo}. Sugerencia: Instalar 1 Oficina de Atención en esta zona.`,
      );
    } else {
      localSugerencias.push(
        `🏢 Atención Comercial: Se detectaron ${oficinas} oficinas ${sufijo}, cubriendo la atención al cliente de la zona.`,
      );
    }

    // --- Métrica Local (Agentes dentro de la figura) ---
    if (agentes === 0) {
      localSugerencias.push(
        `🛍️ Red de Ventas: Se detectaron 0 agentes autorizados en los límites del dibujo. Sugerencia: Certificar 2 nuevos agentes comerciales en este sector.`,
      );
    } else if (agentes < 3) {
      localSugerencias.push(
        `🛍️ Red de Ventas: Se detectaron ${agentes} agentes autorizados. Sugerencia: Certificar al menos ${3 - agentes} nuevos agentes comerciales para fortalecer la presencia.`,
      );
    } else {
      localSugerencias.push(
        `🛍️ Red de Ventas: Presencia comercial sólida con ${agentes} agentes autorizados en los límites del dibujo.`,
      );
    }

    return {
      estadal: null, // Desactivado para no mezclar datos macro con recomendaciones locales directas
      local: {
        titulo: 'Métrica Local (Dentro del Polígono Dibujado)',
        sugerencias: localSugerencias,
      },
    };
  }
}
