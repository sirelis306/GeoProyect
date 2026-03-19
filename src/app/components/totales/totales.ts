import { Component, inject, computed } from '@angular/core';
import { Gis } from '../../services/gis/gisService';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-totales',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './totales.html',
  styleUrl: './totales.css',
})
export class Totales {
  public gis = inject(Gis);

  // Creamos propiedades computadas para los totales
  totalAntenas = computed(() => this.gis.radioBasesSignal().length);
  totalAbonados = computed(() => this.gis.abonadosSignal().length);
  totalOficinas = computed(() => this.gis.oficinasSignal().length);
  totalAgentes = computed(() => this.gis.agentesSignal().length);

  // Solo se muestra si la Capa 2 está activa
  visible = computed(() => this.gis.capasVisibles().operaciones);
}
