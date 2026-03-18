import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gis } from '../../services/gis/gisService';
import { CapasEstado, TipoElementoCap2 } from '../../models/gis';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  public gis = inject(Gis);

  // Lista de regiones con sus colores
  get regionesFiltradas() {
    // Obtenemos los nombres de las regiones que tienen datos según el tipo seleccionado
    const nombresActivos = this.gis.getRegionesConDatos(); 
    
    // Lista maestra de colores para mapear
    const colores: any = {
      'Zuliana': '#007bff', 'Andina': '#6610f2', 'Central': '#fd7e14',
      'Capital': '#dc3545', 'Los Llanos': '#ffc107', 'Centro Occidental': '#e83e8c',
      'Nororiental': '#20c997', 'Guayana': '#28a745', 'Insular': '#17a2b8'
    };

    return nombresActivos.map(nombre => ({
      nombre: nombre,
      color: colores[nombre] || '#DEE2E6'
    }));
  }

  toggle(capa: keyof CapasEstado) {
    this.gis.toggleCapa(capa);
    
    // Si estamos desactivando la Capa 2, también reseteamos el detalle
    if (capa === 'operaciones' && !this.gis.capasVisibles().operaciones) {
      this.gis.setDetalleCap2('ninguno');
    }
  }

  setDetalle(tipo: TipoElementoCap2) {
    // Si ya está activo, lo desactivamos (opcional)
    if (this.gis.capasVisibles().detalleCap2 === tipo) {
      this.gis.setDetalleCap2('ninguno');
    } else {
      this.gis.setDetalleCap2(tipo);
    }
  }
}
