import { Component, inject, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GisService } from '../../services/gis/gisService';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CapasEstado, TipoElemento } from '../../models/gis';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/authService';
import { RouterModule } from '@angular/router';
import { AddElementComponent } from '../add-element/add-element';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, RouterModule, AddElementComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  public gis = inject(GisService);
  public auth = inject(AuthService);
  @ViewChild('selectTech') selectTech: any;

  mostrarForm = signal(false);
  tipoEdicion: TipoElemento = 'ninguno';

  get esAdmin(): boolean {
    const rol = this.auth.getUserRol();
    return rol === 'admin' || rol === 'super_admin';
  }

  constructor(public router: Router) { }

  abrirModal(tipo: TipoElemento) {
    this.tipoEdicion = tipo;
    this.mostrarForm.set(true);
  }

  onElementSaved() {
    this.gis.cargarDatos();
  }

  salir() {
    localStorage.removeItem('token_geo');
    this.router.navigate(['/login']);
  }


  toggle(capa: keyof CapasEstado) {
    this.gis.toggleCapa(capa);

    if (capa === 'operaciones' && !this.gis.capasVisibles().operaciones) {
      this.gis.setDetalleOperaciones('ninguno');
    }
  }

  isActive(tipo: TipoElemento): boolean {
    return this.gis.capasVisibles().detalleOperaciones.includes(tipo);
  }

  setDetalle(tipo: TipoElemento) {
    this.gis.setDetalleOperaciones(tipo);
  }

  setDetalleRegiones(tipo: TipoElemento) {
    this.gis.setDetalleRegiones(tipo);
  }
}
