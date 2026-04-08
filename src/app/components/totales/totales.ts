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

  totalAntenas = computed(() => this.gis.radioBasesSignal().length);
  totalOficinas = computed(() => this.gis.oficinasSignal().length);
  totalAgentes = computed(() => this.gis.agentesSignal().length);

  totalAbonados3G = computed(() => 
    this.gis.abonadosSignal()
      .filter(a => a.segmentacion === '3G')
      .reduce((acc, curr) => acc + (curr.cantidad || 0), 0)
  );

  totalAbonados4G = computed(() => 
    this.gis.abonadosSignal()
      .filter(a => a.segmentacion === '4G')
      .reduce((acc, curr) => acc + (curr.cantidad || 0), 0)
  );

  // Suma total general de abonados (3G + 4G)
  totalAbonados = computed(() => 
    this.gis.abonadosSignal().reduce((acc, curr) => acc + (curr.cantidad || 0), 0)
  );
  // Solo se muestra si la Capa 2 está activa
  visible = computed(() => this.gis.capasVisibles().operaciones);
}
