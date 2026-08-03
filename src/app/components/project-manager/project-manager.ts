import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { GisService } from '../../services/gis/gisService';
import { ProyectoService } from '../../services/proyecto/proyectoService';
import { Proyecto, ProyectoFigura } from '../../models/gis';
import { ToastService } from '../../services/toast/toastService';

@Component({
  selector: 'app-project-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './project-manager.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './project-manager.css',
})
export class ProjectManager {
  public gis = inject(GisService);
  public proyectoService = inject(ProyectoService);
  private toastService = inject(ToastService);

  mostrarCrearProyecto = signal(false);
  mostrarMenuExportar = signal(false); // Signal para menú de exportación
  mostrarImportar = signal(false); // Signal para mostrar panel de importación
  dragActivo = signal(false); // Estado drag over
  mostrarModalConfirmacion = signal(false); // Modal confirmación
  archivoImportado = signal<any>(null); // Datos del archivo parseado

  nombreNuevoProyecto = '';
  descripcionNuevoProyecto = '';

  // Variables para la asignación dinámica de proyectos al importar
  mostrarSubPanelGuardar = signal(false);
  opcionAsignacion = 'existente';
  proyectoSeleccionadoId: number | null | undefined = null;
  nombreProyectoNuevoImportacion = '';
  filtroProyectosImportacion = '';

  get proyectosFiltrados() {
    const query = this.filtroProyectosImportacion.toLowerCase().trim();
    const proyectos = this.proyectoService.proyectos() || [];
    if (!query) return proyectos;
    return proyectos.filter(
      (p) =>
        (p.nombre && p.nombre.toLowerCase().includes(query)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(query)),
    );
  }

  // Modal genérico para confirmaciones de borrado
  confirmacionModal = {
    abierto: false,
    titulo: '',
    mensaje: '',
    accion: () => {},
  };

  cancelarConfirmacion() {
    this.confirmacionModal.abierto = false;
  }

  ejecutarConfirmacion() {
    this.confirmacionModal.abierto = false;
    this.confirmacionModal.accion();
  }

  // Permite colapsar el panel flotante en la derecha
  colapsado = signal(false);
  cargandoProyectos = signal(true);

  get leyendaVisible(): boolean {
    const capas = this.gis.capasVisibles();
    return (
      (capas.operaciones && this.gis.getEstadosConDatos().length > 0) ||
      (capas.regiones && !capas.operaciones) ||
      capas.poblacion
    );
  }

  constructor() {
    setTimeout(() => {
      this.proyectoService.cargarProyectos();
      this.cargandoProyectos.set(false);
    }, 850);
  }

  crearNuevoProyecto() {
    if (!this.nombreNuevoProyecto.trim()) return;
    this.proyectoService
      .crearProyecto(this.nombreNuevoProyecto, this.descripcionNuevoProyecto)
      .subscribe({
        next: () => {
          this.proyectoService.cargarProyectos();
          this.nombreNuevoProyecto = '';
          this.descripcionNuevoProyecto = '';
          this.mostrarCrearProyecto.set(false);
        },
        error: (err) => console.error('Error al crear proyecto:', err),
      });
  }

  eliminarProyecto(id: number, event: Event) {
    event.stopPropagation();
    this.confirmacionModal = {
      abierto: true,
      titulo: '¿Eliminar Proyecto?',
      mensaje:
        '¿Estás seguro de eliminar este proyecto y todos sus polígonos/rutas guardados? Esta acción es permanente y no se puede revertir.',
      accion: () => {
        this.proyectoService.eliminarProyecto(id).subscribe({
          next: () => {
            this.proyectoService.cargarProyectos();
            if (this.proyectoService.proyectoActivo()?.id === id) {
              this.proyectoService.seleccionarProyecto(null);
            }
            this.toastService.showSuccess('Proyecto eliminado correctamente.');
          },
          error: (err) => console.error('Error al eliminar proyecto:', err),
        });
      },
    };
  }

  seleccionarProyecto(event: any) {
    const id = event?.target?.value ? Number(event.target.value) : null;
    if (id) {
      const proj = this.proyectoService.proyectos().find((p: Proyecto) => p.id === id) || null;
      this.proyectoService.seleccionarProyecto(proj);
    } else {
      this.proyectoService.seleccionarProyecto(null);
    }
  }

  seleccionarProyectoNg(selection: any) {
    if (selection) {
      const id = typeof selection === 'object' ? selection.id : Number(selection);
      const proj = this.proyectoService.proyectos().find((p: Proyecto) => p.id === id) || null;
      this.proyectoService.seleccionarProyecto(proj);
    } else {
      this.proyectoService.seleccionarProyecto(null);
    }
  }

  eliminarFigura(id: number, event: Event) {
    event.stopPropagation();
    if (id < 0) {
      this.confirmacionModal = {
        abierto: true,
        titulo: '¿Eliminar Elemento Temporal?',
        mensaje:
          '¿Estás seguro de eliminar esta figura importada temporal? Se removerá del mapa y la barra lateral.',
        accion: () => {
          this.proyectoService.figurasProyectoActivo.update((figuras) =>
            figuras.filter((f) => f.id !== id),
          );
          this.toastService.showSuccess('Elemento temporal removido.');
        },
      };
      return;
    }

    this.confirmacionModal = {
      abierto: true,
      titulo: '¿Eliminar Figura?',
      mensaje: '¿Estás seguro de eliminar esta figura guardada? Esta acción no se puede deshacer.',
      accion: () => {
        this.proyectoService.eliminarFigura(id).subscribe({
          next: () => {
            const activeProj = this.proyectoService.proyectoActivo();
            if (activeProj?.id) {
              this.proyectoService.cargarFigurasProyecto(activeProj.id);
            }
            this.toastService.showSuccess('Figura eliminada del proyecto.');
          },
          error: (err) => console.error('Error al eliminar figura:', err),
        });
      },
    };
  }

  toggleVisibilidadFigura(figura: any, event: Event) {
    event.stopPropagation();
    if (figura.id) {
      this.proyectoService.toggleVisibilidadFigura(figura.id);
    }
  }

  centrarFigura(figura: any) {
    this.gis.figuraEnfocada.set(figura);
  }

  toggleMenuExportar(event: Event) {
    event.stopPropagation();
    this.mostrarMenuExportar.set(!this.mostrarMenuExportar());
  }

  exportarGeoJson(event: Event) {
    event.stopPropagation();
    this.mostrarMenuExportar.set(false);
    const activo = this.proyectoService.proyectoActivo();
    if (!activo) return;

    const figuras = this.proyectoService.figurasProyectoActivo();
    const features = figuras
      .map((f: ProyectoFigura) => {
        let coordsParsed: any;
        try {
          coordsParsed =
            typeof f.coordenadas === 'string' ? JSON.parse(f.coordenadas) : f.coordenadas;
        } catch (e) {
          coordsParsed = f.coordenadas;
        }

        let geometry: any = null;

        if (f.tipo === 'poligono') {
          const ring = this.formatGeoJsonRing(coordsParsed);
          if (ring.length > 0) {
            if (
              ring[0][0] !== ring[ring.length - 1][0] ||
              ring[0][1] !== ring[ring.length - 1][1]
            ) {
              ring.push([ring[0][0], ring[0][1]]);
            }
            geometry = {
              type: 'Polygon',
              coordinates: [ring],
            };
          }
        } else if (f.tipo === 'ruta') {
          const line = this.formatGeoJsonRing(coordsParsed);
          if (line.length > 0) {
            geometry = {
              type: 'LineString',
              coordinates: line,
            };
          }
        } else if (f.tipo === 'circulo' && f.radio) {
          const centro = coordsParsed;
          const ring = this.generarPoligonoCirculo(centro, f.radio);
          if (ring.length > 0) {
            geometry = {
              type: 'Polygon',
              coordinates: [ring],
            };
          }
        }

        return {
          type: 'Feature',
          properties: {
            id: f.id,
            nombre: f.nombre,
            tipo: f.tipo,
            color: f.color,
            radio: f.radio,
          },
          geometry: geometry,
        };
      })
      .filter((feature) => feature.geometry !== null);

    const featureCollection = {
      type: 'FeatureCollection',
      name: activo.nombre,
      features: features,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(featureCollection, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${activo.nombre.toLowerCase().replace(/\s+/g, '-')}.geojson`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  exportarKml(event: Event) {
    event.stopPropagation();
    this.mostrarMenuExportar.set(false);
    const activo = this.proyectoService.proyectoActivo();
    if (!activo) return;

    const figuras = this.proyectoService.figurasProyectoActivo();

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${activo.nombre}</name>
    <description>Proyecto exportado desde GeoProyect</description>
`;

    figuras.forEach((f: ProyectoFigura) => {
      let coordsParsed: any;
      try {
        coordsParsed =
          typeof f.coordenadas === 'string' ? JSON.parse(f.coordenadas) : f.coordenadas;
      } catch (e) {
        coordsParsed = f.coordenadas;
      }

      // Convertir color HEX (#RRGGBB) a formato KML (AABBGGRR)
      const colorHex = f.color || '#4f46e5';
      const r = colorHex.substring(1, 3);
      const g = colorHex.substring(3, 5);
      const b = colorHex.substring(5, 7);
      const kmlLineColor = `ff${b}${g}${r}`;
      const kmlFillColor = `66${b}${g}${r}`;

      kmlContent += `    <Style id="style_${f.id}">
      <LineStyle>
        <color>${kmlLineColor}</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>${kmlFillColor}</color>
      </PolyStyle>
    </Style>
`;

      kmlContent += `    <Placemark>
      <name>${f.nombre}</name>
      <styleUrl>#style_${f.id}</styleUrl>
      <description>Tipo: ${f.tipo} ${f.radio ? '| Radio: ' + Math.round(f.radio) + 'm' : ''}</description>
`;

      if (f.tipo === 'poligono') {
        const ring = this.formatGeoJsonRing(coordsParsed);
        if (ring.length > 0) {
          if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push([ring[0][0], ring[0][1]]);
          }
          const coordString = ring.map((pt) => `${pt[0]},${pt[1]},0`).join(' ');
          kmlContent += `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordString}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
`;
        }
      } else if (f.tipo === 'ruta') {
        const line = this.formatGeoJsonRing(coordsParsed);
        if (line.length > 0) {
          const coordString = line.map((pt) => `${pt[0]},${pt[1]},0`).join(' ');
          kmlContent += `      <LineString>
        <coordinates>${coordString}</coordinates>
      </LineString>
`;
        }
      } else if (f.tipo === 'circulo' && f.radio) {
        const centro = coordsParsed;
        const ring = this.generarPoligonoCirculo(centro, f.radio);
        if (ring.length > 0) {
          const coordString = ring.map((pt) => `${pt[0]},${pt[1]},0`).join(' ');
          kmlContent += `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordString}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
`;
        }
      }

      kmlContent += `    </Placemark>
`;
    });

    kmlContent += `  </Document>
</kml>`;

    const dataStr =
      'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(kmlContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${activo.nombre.toLowerCase().replace(/\s+/g, '-')}.kml`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  private generarPoligonoCirculo(
    centro: { lat: number; lng: number },
    radioMetros: number,
  ): number[][] {
    const puntos = [];
    const numPuntos = 64; // Cantidad de lados para que el círculo se vea liso/perfecto
    const earthRadius = 6378137; // Radio de la Tierra en metros

    for (let i = 0; i <= numPuntos; i++) {
      const angle = (i * 2 * Math.PI) / numPuntos;

      const dLat = (radioMetros / earthRadius) * (180 / Math.PI);
      const dLng =
        (radioMetros / (earthRadius * Math.cos((centro.lat * Math.PI) / 180))) * (180 / Math.PI);

      const latPunto = centro.lat + dLat * Math.sin(angle);
      const lngPunto = centro.lng + dLng * Math.cos(angle);

      puntos.push([lngPunto, latPunto]);
    }
    return puntos;
  }

  private formatGeoJsonRing(coords: any): number[][] {
    if (!Array.isArray(coords)) return [];

    const actualCoords =
      Array.isArray(coords[0]) &&
      !('lat' in coords[0]) &&
      !('lng' in coords[0]) &&
      coords[0].length > 1
        ? coords[0]
        : coords;

    return actualCoords
      .map((pt: any) => {
        const formatted = this.toLngLatArray(pt);
        return formatted ? formatted : [0, 0];
      })
      .filter((pt) => pt[0] !== 0 || pt[1] !== 0);
  }

  private toLngLatArray(pt: any): number[] | null {
    if (!pt) return null;

    if (typeof pt === 'object' && !Array.isArray(pt)) {
      const lat = pt.lat !== undefined ? pt.lat : pt.latitud;
      const lng = pt.lng !== undefined ? pt.lng : pt.longitud;
      if (lat !== undefined && lng !== undefined) {
        return [Number(lng), Number(lat)];
      }
    }
    if (Array.isArray(pt) && pt.length >= 2) {
      return [Number(pt[1]), Number(pt[0])];
    }
    return null;
  }

  // --- MÉTODOS DE IMPORTACIÓN DE ARCHIVOS (UX HÍBRIDO) ---

  toggleImportar() {
    this.mostrarImportar.set(!this.mostrarImportar());
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragActivo.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragActivo.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragActivo.set(false);

    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.procesarArchivo(file);
    }
  }

  onFileSelected(event: any) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.procesarArchivo(file);
      // Limpiar input para permitir cargar el mismo archivo consecutivamente
      input.value = '';
    }
  }

  private procesarArchivo(file: File) {
    const nombre = file.name;
    const extension = nombre.substring(nombre.lastIndexOf('.')).toLowerCase();

    if (extension !== '.geojson' && extension !== '.kml' && extension !== '.json') {
      this.toastService.showError('Formato no soportado. Suba archivos .geojson o .kml.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      try {
        let geoJsonParsed: any = null;

        if (extension === '.kml') {
          geoJsonParsed = this.parseKmlToGeoJson(text);
        } else {
          // JSON o GeoJSON
          geoJsonParsed = JSON.parse(text);
          if (geoJsonParsed.type !== 'FeatureCollection') {
            // Empaquetar como FeatureCollection si es una única Feature
            if (geoJsonParsed.type === 'Feature') {
              geoJsonParsed = {
                type: 'FeatureCollection',
                features: [geoJsonParsed],
              };
            } else {
              throw new Error('Estructura GeoJSON inválida.');
            }
          }
        }

        if (!geoJsonParsed || !geoJsonParsed.features || geoJsonParsed.features.length === 0) {
          this.toastService.showError('El archivo no contiene elementos espaciales válidos.');
          return;
        }

        // Almacenar datos y abrir modal de confirmación
        this.archivoImportado.set({
          nombre: nombre,
          tipo: extension === '.kml' ? 'Google Earth (.kml)' : 'GeoJSON (.geojson)',
          features: geoJsonParsed.features,
        });

        // Inicializar preselección e integración de subpanel
        const activo = this.proyectoService.proyectoActivo();
        if (activo && activo.id) {
          this.proyectoSeleccionadoId = activo.id;
          this.mostrarSubPanelGuardar.set(false); // cerrado por defecto si ya hay un proyecto activo
        } else {
          this.proyectoSeleccionadoId = null;
          this.mostrarSubPanelGuardar.set(true); // abierto por defecto si no hay proyecto activo
        }
        this.opcionAsignacion = 'existente';
        this.filtroProyectosImportacion = '';

        this.gis.importacionPreliminarActiva.set(true);
        this.mostrarModalConfirmacion.set(true);
        this.mostrarImportar.set(false); // Cierra el mini panel
      } catch (err) {
        console.error('Error parseando el archivo:', err);
        this.toastService.showError(
          'Error al leer el archivo. Compruebe que esté bien formateado.',
        );
      }
    };

    reader.readAsText(file);
  }

  private parseKmlToGeoJson(kmlText: string): any {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const features: any[] = [];

    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i];
      const nameNode = placemark.getElementsByTagName('name')[0];
      const name = nameNode ? nameNode.textContent || `Elemento #${i + 1}` : `Elemento #${i + 1}`;

      let color = '#4f46e5';
      const styleUrlNode = placemark.getElementsByTagName('styleUrl')[0];
      if (styleUrlNode) {
        const styleId = styleUrlNode.textContent?.replace('#', '');
        if (styleId) {
          // Buscar nodo de estilo
          const styleNode = xmlDoc.getElementById(styleId);
          if (styleNode) {
            const lineColorNode = styleNode
              .getElementsByTagName('LineStyle')[0]
              ?.getElementsByTagName('color')[0];
            if (lineColorNode && lineColorNode.textContent) {
              const kmlColor = lineColorNode.textContent.trim();
              if (kmlColor.length === 8) {
                const b = kmlColor.substring(2, 4);
                const g = kmlColor.substring(4, 6);
                const r = kmlColor.substring(6, 8);
                color = `#${r}${g}${b}`;
              }
            }
          }
        }
      }

      // Buscar Geometría
      let geometry: any = null;
      let tipo = 'poligono';
      let radio: number | undefined = undefined;

      // 1. Polygon
      const polygonNode = placemark.getElementsByTagName('Polygon')[0];
      if (polygonNode) {
        const coordinatesNode = polygonNode.getElementsByTagName('coordinates')[0];
        if (coordinatesNode && coordinatesNode.textContent) {
          const coords = this.parseKmlCoordinates(coordinatesNode.textContent);
          geometry = {
            type: 'Polygon',
            coordinates: [coords],
          };
          tipo = 'poligono';

          const descNode = placemark.getElementsByTagName('description')[0];
          if (descNode && descNode.textContent && descNode.textContent.includes('Radio:')) {
            const match = descNode.textContent.match(/Radio:\s*(\d+)m/);
            if (match) {
              tipo = 'circulo';
              radio = Number(match[1]);
            }
          }
        }
      }

      // 2. LineString (Ruta)
      const lineNode = placemark.getElementsByTagName('LineString')[0];
      if (lineNode && !geometry) {
        const coordinatesNode = lineNode.getElementsByTagName('coordinates')[0];
        if (coordinatesNode && coordinatesNode.textContent) {
          const coords = this.parseKmlCoordinates(coordinatesNode.textContent);
          geometry = {
            type: 'LineString',
            coordinates: coords,
          };
          tipo = 'ruta';
        }
      }

      // 3. Point
      const pointNode = placemark.getElementsByTagName('Point')[0];
      if (pointNode && !geometry) {
        const coordinatesNode = pointNode.getElementsByTagName('coordinates')[0];
        if (coordinatesNode && coordinatesNode.textContent) {
          const coords = this.parseKmlCoordinates(coordinatesNode.textContent);
          if (coords.length > 0) {
            geometry = {
              type: 'Point',
              coordinates: coords[0],
            };
            tipo = 'punto';
          }
        }
      }

      if (geometry) {
        features.push({
          type: 'Feature',
          properties: {
            nombre: name,
            tipo: tipo,
            color: color,
            radio: radio,
          },
          geometry: geometry,
        });
      }
    }

    return {
      type: 'FeatureCollection',
      features: features,
    };
  }

  private parseKmlCoordinates(coordsText: string): number[][] {
    const points = coordsText.trim().split(/\s+/);
    const coords: number[][] = [];
    points.forEach((p) => {
      const parts = p.split(',');
      if (parts.length >= 2) {
        const lng = Number(parts[0]);
        const lat = Number(parts[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          coords.push([lng, lat]);
        }
      }
    });
    return coords;
  }

  importarSoloVisualizar() {
    const datos = this.archivoImportado();
    if (!datos) return;

    const figInstancias: ProyectoFigura[] = datos.features.map((feat: any, idx: number) => {
      const prop = feat.properties || {};
      const geom = feat.geometry || {};
      const tipo = prop.tipo || 'poligono';

      let coordenadas: any;
      if (tipo === 'poligono') {
        coordenadas = geom.coordinates[0].map((pt: any) => ({ lat: pt[1], lng: pt[0] }));
      } else if (tipo === 'ruta') {
        coordenadas = geom.coordinates.map((pt: any) => ({ lat: pt[1], lng: pt[0] }));
      } else if (tipo === 'circulo' && prop.radio) {
        const ring = geom.coordinates[0];
        let latSum = 0;
        let lngSum = 0;
        const numPoints = ring.length - 1;
        for (let i = 0; i < numPoints; i++) {
          lngSum += ring[i][0];
          latSum += ring[i][1];
        }
        coordenadas = { lat: latSum / numPoints, lng: lngSum / numPoints };
      } else {
        coordenadas = [];
      }

      return {
        id: -(idx + 1), // ID temporal
        nombre: prop.nombre || `Temporal #${idx + 1}`,
        tipo: tipo,
        coordenadas: JSON.stringify(coordenadas),
        color: prop.color || '#4f46e5',
        radio: prop.radio || null,
        visible: true,
      };
    });

    // Cargar en el servicio del proyecto (remplazando o agregando)
    this.proyectoService.figurasProyectoActivo.set(figInstancias);
    this.toastService.showSuccess(`Cargados ${figInstancias.length} elementos de forma temporal.`);

    // Ajustar límites del mapa
    this.centrarCamaraEnCoordenadas(datos.features);
    this.gis.importacionPreliminarActiva.set(false);
    this.mostrarModalConfirmacion.set(false);
  }

  cancelarImportacion() {
    this.mostrarModalConfirmacion.set(false);
    this.mostrarSubPanelGuardar.set(false);
    this.gis.importacionPreliminarActiva.set(false);
    this.archivoImportado.set(null);
    this.filtroProyectosImportacion = '';
    this.proyectoSeleccionadoId = null;
    this.nombreProyectoNuevoImportacion = '';
  }

  importarGuardarProyecto() {
    const datos = this.archivoImportado();
    if (!datos) return;

    // Si no está abierto el subpanel
    if (!this.mostrarSubPanelGuardar()) {
      if (this.proyectoSeleccionadoId) {
        const proj = this.proyectoService
          .proyectos()
          .find((p) => p.id === this.proyectoSeleccionadoId);
        if (proj && proj.id) {
          this.proyectoService.seleccionarProyecto(proj);
          this.ejecutarGuardadoFiguras(proj.id, proj.nombre, datos.features);
          return;
        }
      }
      this.mostrarSubPanelGuardar.set(true);
      return;
    }

    // Caso 1: Destino en proyecto existente
    if (this.opcionAsignacion === 'existente') {
      if (!this.proyectoSeleccionadoId) {
        this.toastService.showError('Seleccione un proyecto de destino.');
        return;
      }
      const proj = this.proyectoService
        .proyectos()
        .find((p) => p.id === this.proyectoSeleccionadoId);
      if (proj && proj.id) {
        this.proyectoService.seleccionarProyecto(proj);
        this.ejecutarGuardadoFiguras(proj.id, proj.nombre, datos.features);
      }
      return;
    }

    // Caso 2: Destino en proyecto nuevo
    if (this.opcionAsignacion === 'nuevo') {
      if (!this.nombreProyectoNuevoImportacion.trim()) {
        this.toastService.showError('Escriba el nombre del nuevo proyecto.');
        return;
      }

      this.proyectoService
        .crearProyecto(this.nombreProyectoNuevoImportacion, 'Proyecto creado al importar figuras')
        .subscribe({
          next: (res) => {
            this.proyectoService.cargarProyectos();
            const nuevoProjId = res.id;
            const nuevoProjNombre = res.nombre || this.nombreProyectoNuevoImportacion;

            if (nuevoProjId) {
              const nuevoProj = {
                id: nuevoProjId,
                nombre: nuevoProjNombre,
                descripcion: 'Proyecto creado al importar figuras',
              };
              this.proyectoService.seleccionarProyecto(nuevoProj);
              this.ejecutarGuardadoFiguras(nuevoProjId, nuevoProjNombre, datos.features);
            } else {
              setTimeout(() => {
                const proj = this.proyectoService
                  .proyectos()
                  .find((p) => p.nombre === this.nombreProyectoNuevoImportacion);
                if (proj && proj.id) {
                  this.proyectoService.seleccionarProyecto(proj);
                  this.ejecutarGuardadoFiguras(proj.id, proj.nombre, datos.features);
                } else {
                  this.toastService.showError('Error al crear el proyecto de destino.');
                }
              }, 500);
            }
          },
          error: (err) => {
            console.error('Error al crear proyecto en importación:', err);
            this.toastService.showError('Fallo al crear el proyecto.');
          },
        });
    }
  }

  private ejecutarGuardadoFiguras(proyectoId: number, proyectoNombre: string, features: any[]) {
    let guardadosCount = 0;

    const guardarSecuencial = (index: number) => {
      if (index >= features.length) {
        this.toastService.showSuccess(
          `Guardadas ${guardadosCount} figuras en el proyecto '${proyectoNombre}'.`,
        );
        this.proyectoService.cargarFigurasProyecto(proyectoId);
        this.centrarCamaraEnCoordenadas(features);
        this.gis.importacionPreliminarActiva.set(false);
        this.mostrarModalConfirmacion.set(false);
        this.mostrarSubPanelGuardar.set(false);
        this.nombreProyectoNuevoImportacion = '';
        this.proyectoSeleccionadoId = null;
        this.filtroProyectosImportacion = '';
        return;
      }

      const feat = features[index];
      const prop = feat.properties || {};
      const geom = feat.geometry || {};
      const tipo = prop.tipo || 'poligono';

      let coordenadas: any;
      if (tipo === 'poligono') {
        coordenadas = geom.coordinates[0].map((pt: any) => ({ lat: pt[1], lng: pt[0] }));
      } else if (tipo === 'ruta') {
        coordenadas = geom.coordinates.map((pt: any) => ({ lat: pt[1], lng: pt[0] }));
      } else if (tipo === 'circulo' && prop.radio) {
        const ring = geom.coordinates[0];
        let latSum = 0;
        let lngSum = 0;
        const numPoints = ring.length - 1;
        for (let i = 0; i < numPoints; i++) {
          lngSum += ring[i][0];
          latSum += ring[i][1];
        }
        coordenadas = { lat: latSum / numPoints, lng: lngSum / numPoints };
      } else {
        coordenadas = [];
      }

      const figuraAGuardar = {
        nombre: prop.nombre || `Elemento #${index + 1}`,
        tipo: tipo,
        coordenadas: JSON.stringify(coordenadas),
        color: prop.color || '#4f46e5',
        radio: prop.radio || null,
        visible: true,
      };

      this.proyectoService.guardarFigura(proyectoId, figuraAGuardar).subscribe({
        next: () => {
          guardadosCount++;
          guardarSecuencial(index + 1);
        },
        error: (err) => {
          console.error(`Error guardando figura #${index + 1}:`, err);
          guardarSecuencial(index + 1);
        },
      });
    };

    guardarSecuencial(0);
  }

  private centrarCamaraEnCoordenadas(features: any[]) {
    if (features.length === 0) return;

    let lats: number[] = [];
    let lngs: number[] = [];

    features.forEach((feat: any) => {
      const geom = feat.geometry;
      if (!geom) return;

      if (geom.type === 'Polygon') {
        geom.coordinates[0].forEach((pt: any) => {
          lngs.push(pt[0]);
          lats.push(pt[1]);
        });
      } else if (geom.type === 'LineString') {
        geom.coordinates.forEach((pt: any) => {
          lngs.push(pt[0]);
          lats.push(pt[1]);
        });
      } else if (geom.type === 'Point') {
        lngs.push(geom.coordinates[0]);
        lats.push(geom.coordinates[1]);
      }
    });

    if (lats.length > 0 && lngs.length > 0) {
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // Mandar límites del bounding box al servicio
      this.gis.cajaMapaAjustar.set([
        [minLat, minLng],
        [maxLat, maxLng],
      ]);
    }
  }
}
