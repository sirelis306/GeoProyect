import {
  Component,
  inject,
  OnInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/authService';
import { HistorialService } from '../../services/historial/historialService';
import { ToastService } from '../../services/toast/toastService';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, RouterModule],
  templateUrl: './historial.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './historial.css',
})
export class Historial implements OnInit, AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private historialService = inject(HistorialService);
  private toastService = inject(ToastService);

  esAdmin: boolean = false;
  searchTexto: string = '';
  filtroAccion: string = 'todos';
  filtroEntidad: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';

  // Propiedades del Paginador (Emeria Style)
  paginaActual = 1;
  limiteActual = 10;
  totalRegistros = 0;
  totalPaginas = 1;
  rangoInicio = 0;
  rangoFin = 0;

  @ViewChild('dateRangeInput', { static: false }) dateRangeInput!: ElementRef;
  flatpickrInstance: any;

  // Control del Modal de Detalles
  mostrarModalDetalles: boolean = false;
  itemSeleccionado: any = null;

  // Opciones para los filtros dropdown
  accionesOptions = [
    { value: 'todos', label: 'Todas las operaciones' },
    { value: 'crear', label: 'Agregar' },
    { value: 'editar', label: 'Editar' },
    { value: 'eliminar', label: 'Eliminar' },
  ];

  entidadesOptions = [
    { value: 'todos', label: 'Todas las entidades' },
    { value: 'antenas', label: 'Radiobases' },
    { value: 'abonados', label: 'Abonados' },
    { value: 'agentes', label: 'Agentes' },
    { value: 'oficinas', label: 'Oficinas' },
  ];

  // Lista del historial de operaciones
  listaHistorial: any[] = [];

  ngOnInit() {
    const rol = this.authService.getUserRol();
    this.esAdmin = rol === 'admin' || rol === 'super_admin';
    if (!this.esAdmin) {
      this.router.navigate(['/mapa']);
      return;
    }
    this.cargarHistorial();
  }

  cargarHistorial() {
    this.historialService
      .obtenerHistorial(
        this.paginaActual,
        this.limiteActual,
        this.filtroAccion,
        this.filtroEntidad,
        this.searchTexto,
        this.fechaInicio,
        this.fechaFin,
      )
      .subscribe({
        next: (res: any) => {
          this.listaHistorial = res.data.map((item: any) => ({
            ...item,
            creado_en: item.created_at,
          }));
          this.totalRegistros = res.total;
          this.totalPaginas = res.pages;
          this.paginaActual = res.page;
          this.limiteActual = res.limit;

          this.rangoInicio =
            this.totalRegistros > 0 ? (this.paginaActual - 1) * this.limiteActual + 1 : 0;
          this.rangoFin = Math.min(this.paginaActual * this.limiteActual, this.totalRegistros);

          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando historial:', err);
        },
      });
  }

  // Retorna los registros directamente ya que el backend realiza la paginación y filtrado
  get historialFiltrado() {
    return this.listaHistorial;
  }

  ngAfterViewInit() {
    this.flatpickrInstance = flatpickr(this.dateRangeInput.nativeElement, {
      mode: 'range',
      dateFormat: 'Y-m-d',
      locale: Spanish,
      altInput: true,
      altFormat: 'd/m/Y',
      onChange: (selectedDates: Date[]) => {
        if (selectedDates.length === 2) {
          this.fechaInicio = this.formatDate(selectedDates[0]);
          this.fechaFin = this.formatDate(selectedDates[1]);
          this.paginaActual = 1;
          this.cargarHistorial();
        } else if (selectedDates.length === 0) {
          this.fechaInicio = '';
          this.fechaFin = '';
          this.paginaActual = 1;
          this.cargarHistorial();
        }
        this.cdr.markForCheck();
      },
    });
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  limpiarFechas() {
    this.fechaInicio = '';
    this.fechaFin = '';
    if (this.flatpickrInstance) {
      this.flatpickrInstance.clear();
    }
    this.paginaActual = 1;
    this.cargarHistorial();
    this.cdr.markForCheck();
  }

  // Métodos de control para el Buscador y Paginador
  searchTimeout: any;
  onSearchChange() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.paginaActual = 1;
      this.cargarHistorial();
    }, 400);
  }

  onFilterChange() {
    this.paginaActual = 1;
    this.cargarHistorial();
  }

  onNextPage() {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
      this.cargarHistorial();
    }
  }

  onPrevPage() {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.cargarHistorial();
    }
  }

  onLimiteChange() {
    this.paginaActual = 1;
    this.cargarHistorial();
  }

  abrirModalDetalles(item: any) {
    this.itemSeleccionado = item;
    this.mostrarModalDetalles = true;
    this.cdr.markForCheck();
  }

  cerrarModalDetalles() {
    this.mostrarModalDetalles = false;
    this.itemSeleccionado = null;
    this.cdr.markForCheck();
  }

  // Simulación interactiva de Revertir una Eliminación
  revertirEliminacion(item: any) {
    if (
      confirm(
        `¿Estás seguro de que deseas revertir la eliminación de "${item.identificador_elemento}"?`,
      )
    ) {
      this.toastService.showSuccess(
        `¡Éxito! El elemento "${item.identificador_elemento}" ha sido restaurado al sistema.`,
      );

      // Añadimos un registro de "creación" simulado para mostrar que se restauró
      const nuevoRegistro = {
        id: Date.now(),
        usuario_nombre: this.authService.currentUser()?.nombre || 'Administrador Actual',
        usuario_email: this.authService.currentUser()?.email || 'admin@steria.com',
        accion: 'crear',
        tabla_afectada: item.tabla_afectada,
        elemento_id: item.elemento_id,
        identificador_elemento: `${item.identificador_elemento} (Restaurado)`,
        creado_en: new Date().toISOString(),
        detalles: {
          ...item.detalles,
          activo: 1, // vuelve a estar activo
        },
      };

      // Modificamos el registro original en el historial para mostrar que fue revertido
      item.revertido = true;

      // Colocamos el nuevo registro al inicio de la lista
      this.listaHistorial = [nuevoRegistro, ...this.listaHistorial];
      this.cdr.markForCheck();
    }
  }

  getAccionLabel(accion: string): string {
    const labels: any = {
      crear: 'Agregar',
      editar: 'Editar',
      actualizar: 'Editar',
      eliminar: 'Eliminar',
      desactivar: 'Eliminar',
    };
    return labels[accion] || accion;
  }

  getAccionClass(accion: string): string {
    const classes: any = {
      crear: 'badge-crear',
      editar: 'badge-editar',
      actualizar: 'badge-editar',
      eliminar: 'badge-eliminar',
      desactivar: 'badge-eliminar',
    };
    return classes[accion] || 'badge-default';
  }

  getAccionIcon(accion: string): string {
    const icons: any = {
      crear: 'fa-plus-circle',
      editar: 'fa-pen',
      actualizar: 'fa-pen',
      eliminar: 'fa-trash-alt',
      desactivar: 'fa-trash-alt',
    };
    return icons[accion] || 'fa-info-circle';
  }

  getEntityLabel(tipo: string, tablaAfectada: string): string {
    const labels: any = {
      antenas: 'Radiobase',
      abonados: 'Abonado',
      agentes: 'Agente',
      oficinas: 'Oficina',
    };
    return labels[tipo] || labels[tablaAfectada] || tablaAfectada || 'Elemento';
  }

  getEntityIcon(entidad: string): string {
    const icons: any = {
      antenas: 'fa-broadcast-tower',
      abonados: 'fa-user-check',
      agentes: 'fa-store',
      oficinas: 'fa-building',
    };
    return icons[entidad] || 'fa-cube';
  }

  // Devuelve las claves de un objeto para poder iterarlas en el Diff Viewer
  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  isObject(val: any): boolean {
    return val !== null && typeof val === 'object';
  }
}
