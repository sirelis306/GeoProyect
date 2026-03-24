import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gis } from '../../services/gis/gisService';
import { FormsModule } from '@angular/forms';
import { CapasEstado, TipoElementoCap2 } from '../../models/gis';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  public gis = inject(Gis);
  mostrarForm = false;
  tipoEdicion: TipoElementoCap2 = 'ninguno';
  nuevoItem: any = { nombre: '', estado: '', region: '', latitud: null, longitud: null };
  listaEstados = ['Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 
  'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 
  'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia', 'Dependencias Federales'];

  abrirModal(tipo: TipoElementoCap2) {
    console.log('Abriendo modal para:', tipo);
    this.tipoEdicion = tipo;
    this.mostrarForm = true;
    this.nuevoItem = { 
      nombre: '', 
      estado: null,
      latitud: null, 
      longitud: null, 
      detalle: '',
      actividad: 'Operativa' 
    };
  }

  guardar() {
    const itemConRegion = {
      ...this.nuevoItem,
      latitud: Number(this.nuevoItem.latitud),
      longitud: Number(this.nuevoItem.longitud),
      region: this.obtenerRegion(this.nuevoItem.estado)
    };
    // Asegúrate de que este método exista en tu gisService.ts
    this.gis.agregarElemento(this.tipoEdicion, itemConRegion); 
    this.mostrarForm = false;
  }

  // Lista de regiones con sus colores
  get regionesFiltradas() {
    // Obtenemos los nombres de las regiones que tienen datos según el tipo seleccionado
    const nombresActivos = this.gis.getRegionesConDatos(); 
    
    // Lista maestra de colores para mapear
    const colores: any = {
      'Zuliana': '#007bff', 'Los Andes': '#6610f2', 'Central': '#fd7e14',
      'Capital': '#dc3545', 'Los Llanos': '#ffc107', 'Centro Occidental': '#e83e8c',
      'Nororiental': '#20c997', 'Guayana': '#28a745', 'Insular': '#17a2b8',
    };

    return nombresActivos.map(nombre => ({
      nombre: nombre,
      color: colores[nombre] || '#DEE2E6'
    }));
  }

  public obtenerRegion(estado: string): string {
    const mapeo: any = {
    // Región Capital
    'Distrito Capital': 'Capital','Miranda': 'Capital','La Guaira': 'Capital',
    // Región Central
    'Carabobo': 'Central', 'Aragua': 'Central', 'Cojedes': 'Central',
    // Región de los Llanos
    'Guárico': 'Los Llanos', 'Apure': 'Los Llanos',
    // Región Centro Occidental
    'Falcón': 'Centro Occidental', 'Lara': 'Centro Occidental', 'Portuguesa': 'Centro Occidental', 'Yaracuy': 'Centro Occidental',
    // Región Zuliana
    'Zulia': 'Zuliana',
    // Región de los Andes
    'Mérida': 'Los Andes', 'Táchira': 'Los Andes', 'Trujillo': 'Los Andes', 'Barinas': 'Los Andes',
    // Región Nororiental
    'Anzoátegui': 'Nororiental', 'Monagas': 'Nororiental', 'Sucre': 'Nororiental',
    // Región Insular
    'Nueva Esparta': 'Insular', 'Dependencias Federales': 'Insular',
    // Región Guayana
    'Bolívar': 'Guayana', 'Amazonas': 'Guayana', 'Delta Amacuro': 'Guayana'
  };
    return mapeo[estado] || '';
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
