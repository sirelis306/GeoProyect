import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gis } from '../../services/gis/gisService';
import { FormsModule } from '@angular/forms';
import { CapasEstado, TipoElementoCap2 } from '../../models/gis';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router } from '@angular/router';

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

  constructor(private router: Router) {}

  abrirModal(tipo: TipoElementoCap2) {
    console.log('Abriendo modal para:', tipo);
    this.tipoEdicion = tipo;
    this.mostrarForm = true;
    this.nuevoItem = { 
      nombre: '', 
      estado: null,
      latitud: null, 
      longitud: null, 
      direccion: '',
      actividad: 'Operativa' 
    };
  }

  guardar() {
    // Objeto base con la región
    let itemFinal: any = {
      estado: this.nuevoItem.estado,
      region: this.obtenerRegion(this.nuevoItem.estado),
      tipo: this.tipoEdicion,
      direccion: this.nuevoItem.direccion || '',
      cantidad: Number(this.nuevoItem.cantidad) || 0
    };

    if (this.tipoEdicion === 'antenas') {
      itemFinal.nombre = this.nuevoItem.nombre;
      itemFinal.latitud = Number(this.nuevoItem.latitud);
      itemFinal.longitud = Number(this.nuevoItem.longitud);
      itemFinal.tecnologia = this.nuevoItem.tecnologia || '4G';
      itemFinal.actividad = this.nuevoItem.actividad || 'Operativa';
      itemFinal.cantidad = 1; 
    } else {
      const coords = this.COORD_CENTRALES[this.nuevoItem.estado];

      // Si es abonados, guardamos la opción del select en el campo 'segmentacion'
      if (this.tipoEdicion === 'abonados') {
        itemFinal.segmentacion = this.nuevoItem.segmentacion_elegida || '4G';
        itemFinal.nombre = `ABONADOS ${itemFinal.segmentacion} - ${this.nuevoItem.estado}`;
      } else {
        itemFinal.nombre = `${this.tipoEdicion.toUpperCase()} - ${this.nuevoItem.estado}`;
        itemFinal.segmentacion = null; // Oficinas y Agentes no llevan segmentación
      }

      itemFinal.latitud = coords ? coords.lat : 0;
      itemFinal.longitud = coords ? coords.lng : 0;
      itemFinal.tecnologia = null;
      itemFinal.actividad = null;
    }

    // Verificación de seguridad
    if (!itemFinal.estado || (this.tipoEdicion !== 'antenas' && itemFinal.cantidad <= 0)) {
      alert("Por favor, rellene el estado y una cantidad válida.");
      return;
    }

    this.gis.agregarElemento(this.tipoEdicion, itemFinal); 
    this.mostrarForm = false;
    
    // Reseteamos incluyendo el nuevo campo del select
    this.nuevoItem = { 
      nombre: '', 
      estado: null, 
      latitud: null, 
      longitud: null, 
      cantidad: null, 
      tecnologia: '', 
      segmentacion_elegida: '',
      direccion: '' 
    };
  }
  
  salir() {
    localStorage.removeItem('token_geo'); 
    this.router.navigate(['/login']);    
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

  private COORD_CENTRALES: any = {
    'Amazonas': { lat: 3.4167, lng: -65.5000 },
    'Anzoátegui': { lat: 9.3333, lng: -64.3333 },
    'Apure': { lat: 7.0000, lng: -69.0000 },
    'Aragua': { lat: 10.2500, lng: -67.2500 },
    'Barinas': { lat: 8.3333, lng: -70.0000 },
    'Bolívar': { lat: 6.0000, lng: -63.0000 },
    'Carabobo': { lat: 10.1620, lng: -68.0070 },
    'Cojedes': { lat: 9.1667, lng: -68.3333 },
    'Delta Amacuro': { lat: 8.5000, lng: -61.5000 },
    'Distrito Capital': { lat: 10.5000, lng: -66.9167 },
    'Falcón': { lat: 11.0000, lng: -70.0000 },
    'Guárico': { lat: 8.5000, lng: -66.5000 },
    'La Guaira': { lat: 10.6000, lng: -66.9333 },
    'Lara': { lat: 10.1667, lng: -69.6667 },
    'Mérida': { lat: 8.5000, lng: -71.1667 },
    'Miranda': { lat: 10.2500, lng: -66.5000 },
    'Monagas': { lat: 9.3333, lng: -63.0000 },
    'Nueva Esparta': { lat: 10.9833, lng: -63.9167 },
    'Portuguesa': { lat: 9.0000, lng: -69.2500 },
    'Sucre': { lat: 10.4167, lng: -63.5000 },
    'Táchira': { lat: 7.8333, lng: -72.1667 },
    'Trujillo': { lat: 9.4167, lng: -70.5000 },
    'Yaracuy': { lat: 10.3333, lng: -68.7500 },
    'Zulia': { lat: 10.3333, lng: -72.0000 }
  };

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
