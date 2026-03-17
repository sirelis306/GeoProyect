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
  regiones = [
    { nombre: 'Zuliana', color: '#007bff' },
    { nombre: 'Andina', color: '#6610f2' },
    { nombre: 'Central', color: '#fd7e14' },
    { nombre: 'Capital', color: '#dc3545' },
    { nombre: 'Los Llanos', color: '#ffc107' },
    { nombre: 'Centro Occidental', color: '#e83e8c' },
    { nombre: 'Nororiental', color: '#20c997' },
    { nombre: 'Guayana', color: '#28a745' },
    { nombre: 'Insular', color: '#17a2b8' }
  ];

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
