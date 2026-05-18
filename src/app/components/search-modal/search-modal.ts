import { Component, Input, Output, EventEmitter, inject, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GisService } from '../../services/gis/gisService';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-modal.html',
  styleUrl: './search-modal.css'
})
export class SearchModal {
  private gis = inject(GisService);

  @Input() visible = false;
  @Input() esAdmin = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onEdit = new EventEmitter<any>();

  @ViewChild('searchInput') searchInput!: ElementRef;

  busqueda = signal('');
  resultados = signal<any[]>([]);

  constructor() {
    effect(() => {
      // Auto-enfoque al abrir
      if (this.visible) {
        setTimeout(() => this.searchInput?.nativeElement?.focus(), 100);
      } else {
        this.busqueda.set('');
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const search = this.busqueda().toLowerCase();
      if (!search || search.length < 2) {
        this.resultados.set([]);
        return;
      }

      const terminos = search.split(' ').filter(t => t.length > 0);

      const todos = [
        ...this.gis.radioBasesSignal().map(i => ({ ...i, tipoReal: 'antenas' })),
        ...this.gis.abonadosSignal().map(i => ({ ...i, tipoReal: 'abonados' })),
        ...this.gis.oficinasSignal().map(i => ({ ...i, tipoReal: 'oficinas' })),
        ...this.gis.agentesSignal().map(i => ({ ...i, tipoReal: 'agentes' }))
      ];

      const filtrados = todos.filter((item: any) => {
        const fullText = `
          ${item.nombre || ''} 
          ${item.direccion || ''} 
          ${item.serial || ''} 
          ${item.codigoDealer || ''} 
          ${item.estado || ''}
        `.toLowerCase();
        return terminos.every(term => fullText.includes(term));
      }).slice(0, 20);

      this.resultados.set(filtrados);
    }, { allowSignalWrites: true });
  }

  close() {
    this.onClose.emit();
  }

  irAlMapa(item: any) {
    console.log('Centrando en mapa:', item);
    // Aquí podrías disparar un evento para que el mapa se mueva
    this.close();
  }

  editar(item: any) {
    if (!this.esAdmin) return;
    this.onEdit.emit(item);
    this.close();
  }

  eliminar(item: any) {
    if (!this.esAdmin) return;
    if (confirm(`¿Estás seguro de eliminar "${item.nombre}"?`)) {
      this.gis.eliminarElemento(item.id).subscribe(() => {
        this.gis.cargarDatos();
        this.busqueda.set(this.busqueda()); // Forzar refresco
      });
    }
  }

  getIcon(item: any): string {
    switch(item.tipoReal) {
      case 'antenas': return 'fas fa-broadcast-tower';
      case 'abonados': return 'fas fa-user-check';
      case 'oficinas': return 'fas fa-building';
      case 'agentes': return 'fas fa-store';
      default: return 'fas fa-map-marker-alt';
    }
  }

  getColor(item: any): string {
    switch(item.tipoReal) {
      case 'antenas': return '#FF1493';
      case 'abonados': return '#00BFFF';
      case 'oficinas': return '#32CD32';
      case 'agentes': return '#FF8C00';
      default: return '#3240A5';
    }
  }
}
