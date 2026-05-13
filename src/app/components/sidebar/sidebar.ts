import { Component, inject, ViewChild, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GisService } from '../../services/gis/gisService';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CapasEstado, TipoElemento } from '../../models/gis';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/authService';
import { RouterModule } from '@angular/router';
import { AddElementComponent } from '../add-element/add-element';
import { SearchModal } from '../search-modal/search-modal';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, RouterModule, AddElementComponent, SearchModal],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  public gis = inject(GisService);
  public auth = inject(AuthService);
  @ViewChild('selectTech') selectTech: any;

  mostrarForm = signal(false);
  mostrarSearchModal = signal(false);
  tipoEdicion: TipoElemento = 'ninguno';
  itemAEditar: any = null;

  get esAdmin(): boolean {
    const rol = this.auth.getUserRol();
    return rol === 'admin' || rol === 'super_admin';
  }

  constructor(public router: Router) { }

  abrirModal(tipo: TipoElemento, item?: any) {
    this.tipoEdicion = tipo;
    this.itemAEditar = item || null;
    this.mostrarForm.set(true);
  }

  onElementSaved() {
    this.gis.cargarDatos();
  }

  abrirBuscador() {
    this.mostrarSearchModal.set(true);
  }

  onEditFromSearch(item: any) {
    this.abrirModal(item.tipoReal, item);
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
