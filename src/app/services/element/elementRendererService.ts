import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { TipoElemento, RadioBase, Oficina, Agente, Abonado } from '../../models/gis';

@Injectable({ providedIn: 'root' })
export class ElementRendererService {

  public configIconos: any = {
    antenas: { icon: 'fa-broadcast-tower', color: '#FF1493', label: 'Radio Bases' },
    abonados: { icon: 'fa-user-check', color: '#00BFFF', label: 'Abonados' },
    oficinas: { icon: 'fa-building', color: '#32CD32', label: 'Oficinas' },
    agentes: { icon: 'fa-store', color: '#FF8C00', label: 'Agentes' }
  };

  /* Crea un icono de pin personalizado usando FontAwesome */
  crearPinIcon(tipo: TipoElemento) {
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
  }

  /* Genera el HTML para el popup de un elemento individual */
  crearPopupDetalle(
    tipo: TipoElemento,
    rows: { label: string; value?: string | number | null; badge?: boolean; badgeColor?: string; coords?: boolean; breakdown?: Record<string, number> }[]
  ) {
    const cfg = this.configIconos[tipo];
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
          const color = r.badgeColor || cfg.color;
          cell = `<span class="popup-badge" style="--bdg-color:${color}">${r.value}</span>`;
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

  /* Crea un icono de grupo (badge) para totales por estado o región */
  crearBadgeGroupIcon(items: { tipo: TipoElemento, total: number }[], esRegion = false) {
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

  /* Genera el HTML para el popup agregado (totales) */
  crearPopupAgregado(
    titulo: string,
    tipo: 'estado' | 'region',
    items: { tipo: TipoElemento, total: number }[],
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

  /* Estilos para la capa de electricidad */
  getEstiloElectricidad(feature: any) {
    const v = feature.properties?.voltage || "";
    const isHigh = v.includes("400") || v.includes("765");
    return {
      color: isHigh ? "#FF4500" : "#FFA500",
      weight: isHigh ? 2.5 : 1.5,
      opacity: 0.8,
      dashArray: isHigh ? "" : "5, 5",
      className: "electric-line-glow"
    };
  }

  /* Icono personalizado para subestaciones eléctricas */
  crearIconoSubestacion() {
    return L.divIcon({
      html: `<div class="substation-marker"><i class="fas fa-bolt"></i></div>`,
      className: 'substation-icon-container',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  /* Estilos para la capa de vías y calles */
  getEstiloVias(feature: any) {
    const type = feature.properties?.highway || "";
    const isMain = ["motorway", "trunk", "primary"].includes(type);
    return {
      color: "#c3d2f8ff",
      weight: isMain ? 2 : 1,
      opacity: 0.6,
      className: "vias-line-highlight"
    };
  }

  /* Popup para infraestructura eléctrica mejorado */
  crearPopupElectricidad(properties: any) {
    const t = properties;
    // Priorizamos el nombre de la estructura para el título
    const titulo = t.name || (t.substation ? 'Subestación Eléctrica' : 'Infraestructura Eléctrica');

    return `
      <div class="electric-popup">
        <strong>${titulo}</strong>
        <div style="margin-top: 5px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 5px;">
          ${t.voltage ? `<b>Voltaje:</b> ${t.voltage} V<br/>` : ""}
          ${t.operator ? `<b>Operador:</b> ${t.operator}<br/>` : ""}
          ${t.substation ? `<b>Tipo:</b> ${t.substation}<br/>` : ""}
          ${!t.name ? "" : `<small style="opacity: 0.7; font-size: 10px; display: block; margin-top: 4px;">Infraestructura Eléctrica</small>`}
        </div>
      </div>
    `;
  }

  /* Formateador de coordenadas para popups */
  formatCoords(lat: number, lng: number): string {
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }

  /* Retorna el color según el estado de actividad */
  getColorActividad(actividad: string): string {
    const act = (actividad || '').toLowerCase();
    if (act.includes('inoperativa')) return '#ef4444'; // Rojo
    if (act.includes('operativa')) return '#22c55e';   // Verde
    if (act.includes('mantenimiento')) return '#eab308'; // Amarillo/Oro
    if (act.includes('vandalizada')) return '#f97316';  // Naranja

    return this.configIconos.antenas.color; // Color por defecto (Rosa)
  }
}

