import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProyectoService } from '../../services/proyecto/proyectoService';
import { ToastService } from '../../services/toast/toastService';

@Component({
  selector: 'app-polygons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './polygons.html',
  styleUrl: './polygons.css'
})
export class Polygons {
  @Input() analisis: any = null;
  @Output() onClose = new EventEmitter<void>();

  public proyectoService = inject(ProyectoService);
  private toastService = inject(ToastService);
  nombreFigura = '';
  colorFigura = '#4f46e5';

  mostrarFormGuardar = signal(false);

  toggleFormGuardar() {
    this.mostrarFormGuardar.set(!this.mostrarFormGuardar());
  }

  cerrar() {
    this.mostrarFormGuardar.set(false);
    this.onClose.emit();
  }

  guardarFigura() {
    if (!this.nombreFigura.trim()) {
      this.toastService.showError('Por favor ingresa un nombre para la figura.');
      return;
    }
    const activo = this.proyectoService.proyectoActivo();
    if (!activo || !activo.id) return;

    const payload = {
      nombre: this.nombreFigura,
      tipo: this.analisis.tipo,
      coordenadas: this.analisis.coordenadas,
      radio: this.analisis.radio,
      color: this.colorFigura
    };

    this.proyectoService.guardarFigura(activo.id, payload).subscribe({
      next: () => {
        this.toastService.showSuccess('Figura guardada exitosamente en el proyecto.');
        this.nombreFigura = '';
        this.mostrarFormGuardar.set(false);
        this.proyectoService.cargarFigurasProyecto(activo.id!);
        this.cerrar();
      },
      error: (err) => {
        console.error('Error al guardar figura:', err);
        this.toastService.showError('Error al guardar la figura en el proyecto.');
      }
    });
  }
}
