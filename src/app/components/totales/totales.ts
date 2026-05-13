import { Component, inject, computed } from '@angular/core';
import { GisService } from '../../services/gis/gisService';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-totales',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './totales.html',
  styleUrl: './totales.css',
})
export class Totales {
  public gis = inject(GisService);

  totalAntenas = computed(() => this.gis.radioBasesSignal().length);
  totalOficinas = computed(() => this.gis.oficinasSignal().length);
  totalAgentes = computed(() => this.gis.agentesSignal().length);

  totalAbonados3G = computed(() =>
    this.gis.abonadosSignal()
      .filter(a => a.segmentacion === '3G')
      .reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0)
  );

  totalAbonados4G = computed(() =>
    this.gis.abonadosSignal()
      .filter(a => a.segmentacion === '4G')
      .reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0)
  );

  // Suma total general de abonados
  totalAbonados = computed(() =>
    this.gis.abonadosSignal().reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0)
  );
  // Se muestra si la Capa 2 (Operaciones) o la Capa 1 (Regiones) están activas
  visible = computed(() => {
    const capas = this.gis.capasVisibles();
    return capas.operaciones || capas.regiones;
  });

  formatear(valor: number): string {
    return new Intl.NumberFormat('de-DE').format(valor);
  }
}
