import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { GisService } from '../../services/gis/gisService';
import { ProyectoService } from '../../services/proyecto/proyectoService';
import { Proyecto, ProyectoFigura } from '../../models/gis';

@Component({
  selector: 'app-project-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './project-manager.html',
  styleUrl: './project-manager.css'
})
export class ProjectManager {
  public gis = inject(GisService);
  public proyectoService = inject(ProyectoService);

  mostrarCrearProyecto = signal(false);
  mostrarMenuExportar = signal(false); // Signal para menú de exportación
  nombreNuevoProyecto = '';
  descripcionNuevoProyecto = '';

  // Permite colapsar el panel flotante en la derecha
  colapsado = signal(false);
  cargandoProyectos = signal(true);

  get leyendaVisible(): boolean {
    const capas = this.gis.capasVisibles();
    return (capas.operaciones && this.gis.getEstadosConDatos().length > 0) ||
           (capas.regiones && !capas.operaciones) ||
           capas.poblacion;
  }

  constructor() {
    setTimeout(() => {
      this.proyectoService.cargarProyectos();
      this.cargandoProyectos.set(false);
    }, 850);
  }

  crearNuevoProyecto() {
    if (!this.nombreNuevoProyecto.trim()) return;
    this.proyectoService.crearProyecto(this.nombreNuevoProyecto, this.descripcionNuevoProyecto).subscribe({
      next: () => {
        this.proyectoService.cargarProyectos();
        this.nombreNuevoProyecto = '';
        this.descripcionNuevoProyecto = '';
        this.mostrarCrearProyecto.set(false);
      },
      error: (err) => console.error('Error al crear proyecto:', err)
    });
  }

  eliminarProyecto(id: number, event: Event) {
    event.stopPropagation();
    if (confirm('¿Estás seguro de eliminar este proyecto y todos sus polígonos/rutas guardados?')) {
      this.proyectoService.eliminarProyecto(id).subscribe({
        next: () => {
          this.proyectoService.cargarProyectos();
          if (this.proyectoService.proyectoActivo()?.id === id) {
            this.proyectoService.seleccionarProyecto(null);
          }
        },
        error: (err) => console.error('Error al eliminar proyecto:', err)
      });
    }
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
    if (confirm('¿Estás seguro de eliminar esta figura?')) {
      this.proyectoService.eliminarFigura(id).subscribe({
        next: () => {
          const activeProj = this.proyectoService.proyectoActivo();
          if (activeProj?.id) {
            this.proyectoService.cargarFigurasProyecto(activeProj.id);
          }
        },
        error: (err) => console.error('Error al eliminar figura:', err)
      });
    }
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
    const features = figuras.map((f: ProyectoFigura) => {
      let coordsParsed: any;
      try {
        coordsParsed = typeof f.coordenadas === 'string' ? JSON.parse(f.coordenadas) : f.coordenadas;
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
            coordinates: [ring]
          };
        }
      } else if (f.tipo === 'ruta') {
        const line = this.formatGeoJsonRing(coordsParsed);
        if (line.length > 0) {
          geometry = {
            type: 'LineString',
            coordinates: line
          };
        }
      } else if (f.tipo === 'circulo' && f.radio) {
        const centro = coordsParsed;
        const ring = this.generarPoligonoCirculo(centro, f.radio);
        if (ring.length > 0) {
          geometry = {
            type: 'Polygon',
            coordinates: [ring]
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
          radio: f.radio
        },
        geometry: geometry
      };
    }).filter(feature => feature.geometry !== null);

    const featureCollection = {
      type: 'FeatureCollection',
      name: activo.nombre,
      features: features
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(featureCollection, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activo.nombre.toLowerCase().replace(/\s+/g, '-')}.geojson`);
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
        coordsParsed = typeof f.coordenadas === 'string' ? JSON.parse(f.coordenadas) : f.coordenadas;
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
          if (
            ring[0][0] !== ring[ring.length - 1][0] ||
            ring[0][1] !== ring[ring.length - 1][1]
          ) {
            ring.push([ring[0][0], ring[0][1]]);
          }
          const coordString = ring.map(pt => `${pt[0]},${pt[1]},0`).join(' ');
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
          const coordString = line.map(pt => `${pt[0]},${pt[1]},0`).join(' ');
          kmlContent += `      <LineString>
        <coordinates>${coordString}</coordinates>
      </LineString>
`;
        }
      } else if (f.tipo === 'circulo' && f.radio) {
        const centro = coordsParsed;
        const ring = this.generarPoligonoCirculo(centro, f.radio);
        if (ring.length > 0) {
          const coordString = ring.map(pt => `${pt[0]},${pt[1]},0`).join(' ');
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

    const dataStr = 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(kmlContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activo.nombre.toLowerCase().replace(/\s+/g, '-')}.kml`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  private generarPoligonoCirculo(centro: { lat: number, lng: number }, radioMetros: number): number[][] {
    const puntos = [];
    const numPuntos = 64; // Cantidad de lados para que el círculo se vea liso/perfecto
    const earthRadius = 6378137; // Radio de la Tierra en metros

    for (let i = 0; i <= numPuntos; i++) {
      const angle = (i * 2 * Math.PI) / numPuntos;
      
      const dLat = (radioMetros / earthRadius) * (180 / Math.PI);
      const dLng = (radioMetros / (earthRadius * Math.cos(centro.lat * Math.PI / 180))) * (180 / Math.PI);
      
      const latPunto = centro.lat + dLat * Math.sin(angle);
      const lngPunto = centro.lng + dLng * Math.cos(angle);
      
      puntos.push([lngPunto, latPunto]);
    }
    return puntos;
  }

  private formatGeoJsonRing(coords: any): number[][] {
    if (!Array.isArray(coords)) return [];
    
    const actualCoords = Array.isArray(coords[0]) && !('lat' in coords[0]) && !('lng' in coords[0]) && coords[0].length > 1
      ? coords[0] 
      : coords;

    return actualCoords.map((pt: any) => {
      const formatted = this.toLngLatArray(pt);
      return formatted ? formatted : [0, 0];
    }).filter(pt => pt[0] !== 0 || pt[1] !== 0);
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
}
