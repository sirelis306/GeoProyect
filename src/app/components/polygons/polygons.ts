import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-polygons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './polygons.html',
  styleUrl: './polygons.css'
})
export class Polygons {
  @Input() analisis: any = null;
  @Output() onClose = new EventEmitter<void>();

  cerrar() {
    this.onClose.emit();
  }
}
