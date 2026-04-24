import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { GisService } from '../../services/gis/gisService';
import { TipoElemento } from '../../models/gis';

@Component({
  selector: 'app-add-element',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './add-element.html',
  styleUrl: './add-element.css'
})
export class AddElementComponent {
  private gis = inject(GisService);

  @Input() tipo: TipoElemento = 'ninguno';
  @Input() visible = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onSaved = new EventEmitter<void>();

  enviando = false;
  nuevoItem: any = { 
    nombre: '', 
    estado: null, 
    latitud: null, 
    longitud: null, 
    direccion: '', 
    cantidad: null, 
    actividad: 'Operativa', 
    tecnologia: [],
    segmentacion_elegida: '4G',
    codigoDealer: '',
    clasificacion: null
  };

  opcionesTecnologia = [
    { value: 'GSM', label: 'GSM' },
    { value: 'UMTS', label: 'UMTS' },
    { value: 'LTE', label: 'LTE' },
    { value: 'NR', label: 'NR' }
  ];

  listaActividad = ['Operativa', 'Mantenimiento', 'Vandalizada'];
  clasificaciones = ['AA', 'ACI', 'PYME', 'Compartida'];

  get listaEstados(): string[] {
    return this.gis.estadosSignal().map(e => e.nombre);
  }

  get todasSeleccionadas(): boolean {
    return this.nuevoItem.tecnologia?.length === this.opcionesTecnologia.length;
  }

  get algunasSeleccionadas(): boolean {
    return this.nuevoItem.tecnologia?.length > 0;
  }

  getRegion(estado: string) {
    return this.gis.obtenerRegion(estado);
  }

  toggleAllTecnologias() {
    if (this.todasSeleccionadas) {
      this.nuevoItem.tecnologia = [];
    } else {
      this.nuevoItem.tecnologia = this.opcionesTecnologia.map(t => t.value);
    }
  }

  async guardar() {
    try {
      this.enviando = true;
      
      // Si el usuario ingresó dirección pero no coordenadas, intentamos geocodificar
      if (this.nuevoItem.direccion && (!this.nuevoItem.latitud || !this.nuevoItem.longitud)) {
        const coords = await this.gis.obtenerCoordsDesdeDireccion(this.nuevoItem.direccion);
        if (coords) {
          this.nuevoItem.latitud = coords.lat;
          this.nuevoItem.longitud = coords.lng;
        }
      }

      const itemFinal = await this.gis.construirYValidarElemento(this.tipo, this.nuevoItem);

      this.gis.agregarElemento(this.tipo, itemFinal).subscribe({
        next: () => {
          this.enviando = false;
          this.resetearFormulario();
          this.onSaved.emit();
          this.onClose.emit();
        },
        error: (err) => {
          this.enviando = false;
          alert(err.error?.mensaje || 'Error al guardar');
        }
      });
    } catch (error: any) {
      this.enviando = false;
      alert(error.message);
    }
  }

  resetearFormulario() {
    this.nuevoItem = {
      nombre: '', estado: null, latitud: null, longitud: null, direccion: '',
      cantidad: null, actividad: 'Operativa', tecnologia: [],
      segmentacion_elegida: '4G', codigoDealer: '', clasificacion: null
    };
  }

  cerrar() {
    this.resetearFormulario();
    this.onClose.emit();
  }
}
