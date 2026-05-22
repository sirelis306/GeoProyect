import { Component, inject, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/authService';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, RouterModule],
  templateUrl: './historial.html',
  styleUrl: './historial.css'
})
export class Historial implements OnInit, AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  esAdmin: boolean = false;
  searchTexto: string = '';
  filtroAccion: string = 'todos';
  filtroEntidad: string = 'todos';
  fechaInicio: string = '';
  fechaFin: string = '';

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
    { value: 'eliminar', label: 'Eliminar' }
  ];

  entidadesOptions = [
    { value: 'todos', label: 'Todas las entidades' },
    { value: 'antenas', label: 'Antenas' },
    { value: 'abonados', label: 'Abonados' },
    { value: 'agentes', label: 'Agentes' },
    { value: 'oficinas', label: 'Oficinas' }
  ];

  // Mock data realista para el historial de operaciones
  listaHistorial: any[] = [
    {
      id: 1,
      usuario_nombre: 'Carlos Mendoza',
      usuario_email: 'carlos.mendoza@steria.com',
      accion: 'crear',
      tabla_afectada: 'antenas',
      elemento_id: 125,
      identificador_elemento: 'Antena Principal Centro',
      creado_en: '2026-05-22T09:20:00Z',
      detalles: {
        tipo: 'antenas',
        nombre: 'Antena Principal Centro',
        estado: 'Distrito Capital',
        tecnologia: '4G / 5G',
        direccion: 'Av. Libertador, Edif. Centro, Caracas',
        latitud: 10.4910,
        longitud: -66.8920,
        cantidad: 1,
        activo: 1
      }
    },
    {
      id: 2,
      usuario_nombre: 'María Silva',
      usuario_email: 'maria.silva@steria.com',
      accion: 'editar',
      tabla_afectada: 'abonados',
      elemento_id: 84,
      identificador_elemento: 'Abonados - Estado Zulia',
      creado_en: '2026-05-22T08:45:00Z',
      detalles: {
        antes: {
          cantidad: 12000,
          segmentacion: '3G:5000 | 4G:7000 | 5G:0',
          estado: 'Zulia'
        },
        despues: {
          cantidad: 15500,
          segmentacion: '3G:5000 | 4G:9000 | 5G:1500',
          estado: 'Zulia'
        }
      }
    },
    {
      id: 3,
      usuario_nombre: 'Juan Pérez',
      usuario_email: 'juan.perez@steria.com',
      accion: 'eliminar',
      tabla_afectada: 'agentes',
      elemento_id: 42,
      identificador_elemento: 'Agente Autorizado COD-4912',
      creado_en: '2026-05-22T07:10:00Z',
      detalles: {
        codigo_dealer: 'COD-4912',
        estado: 'Miranda',
        direccion: 'C.C. El Recreo, Nivel PB',
        cantidad: 1,
        activo: 0
      }
    },
    {
      id: 4,
      usuario_nombre: 'Carlos Mendoza',
      usuario_email: 'carlos.mendoza@steria.com',
      accion: 'editar',
      tabla_afectada: 'antenas',
      elemento_id: 110,
      identificador_elemento: 'Antena Cabimas',
      creado_en: '2026-05-21T18:30:00Z',
      detalles: {
        antes: {
          latitud: 10.4000,
          longitud: -71.4500,
          tecnologia: '3G / 4G'
        },
        despues: {
          latitud: 10.4120,
          longitud: -71.4420,
          tecnologia: '4G / 5G'
        }
      }
    },
    {
      id: 5,
      usuario_nombre: 'María Silva',
      usuario_email: 'maria.silva@steria.com',
      accion: 'crear',
      tabla_afectada: 'oficinas',
      elemento_id: 93,
      identificador_elemento: 'Oficina Comercial Chacao',
      creado_en: '2026-05-21T14:15:00Z',
      detalles: {
        tipo: 'oficinas',
        estado: 'Miranda',
        direccion: 'Av. Francisco de Miranda, Torre Chacao',
        actividad: 'Atención al Cliente y Ventas',
        cantidad: 1,
        activo: 1
      }
    }
  ];

  ngOnInit() {
    const rol = this.authService.getUserRol();
    this.esAdmin = rol === 'admin' || rol === 'super_admin';
    if (!this.esAdmin) {
      this.router.navigate(['/mapa']);
    }
  }

  // Filtrado reactivo de acciones de auditoría
  get historialFiltrado() {
    return this.listaHistorial.filter(item => {
      const matchTexto =
        (item.identificador_elemento || '')
          .toLowerCase()
          .includes(this.searchTexto.toLowerCase()) ||
        (item.usuario_nombre || '')
          .toLowerCase()
          .includes(this.searchTexto.toLowerCase());

      const matchAccion = this.filtroAccion === 'todos' || item.accion === this.filtroAccion;
      const matchEntidad = this.filtroEntidad === 'todos' || item.tabla_afectada === this.filtroEntidad;
      const matchFecha = this.evaluarRangoFecha(item.creado_en);

      return matchTexto && matchAccion && matchEntidad && matchFecha;
    });
  }

  // Compara la fecha del registro con el rango seleccionado en el calendario
  evaluarRangoFecha(fechaString: string): boolean {
    if (!this.fechaInicio && !this.fechaFin) {
      return true;
    }

    const fecha = new Date(fechaString);
    // Normalizar a medianoche local para comparar solo el día
    const fechaCero = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();

    let inicioCero: number | null = null;
    if (this.fechaInicio) {
      const parts = this.fechaInicio.split('-');
      inicioCero = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
    }

    let finCero: number | null = null;
    if (this.fechaFin) {
      const parts = this.fechaFin.split('-');
      finCero = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
    }

    if (inicioCero !== null && finCero !== null) {
      // Rango de fechas (inclusivo)
      return fechaCero >= inicioCero && fechaCero <= finCero;
    } else if (inicioCero !== null) {
      // Solo fecha inicio: desde ese día inclusive en adelante
      return fechaCero >= inicioCero;
    } else if (finCero !== null) {
      // Solo fecha fin: hasta ese día inclusive
      return fechaCero <= finCero;
    }

    return true;
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
        } else if (selectedDates.length === 1) {
          this.fechaInicio = this.formatDate(selectedDates[0]);
          this.fechaFin = '';
        } else {
          this.fechaInicio = '';
          this.fechaFin = '';
        }
        this.cdr.markForCheck();
      }
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
    this.cdr.markForCheck();
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
    if (confirm(`¿Estás seguro de que deseas revertir la eliminación de "${item.identificador_elemento}"?`)) {
      alert(`¡Éxito! El elemento "${item.identificador_elemento}" ha sido restaurado al sistema.`);

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
          activo: 1 // vuelve a estar activo
        }
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
      'crear': 'Agregar',
      'editar': 'Editar',
      'eliminar': 'Eliminar'
    };
    return labels[accion] || accion;
  }

  getAccionClass(accion: string): string {
    const classes: any = {
      'crear': 'badge-crear',
      'editar': 'badge-editar',
      'eliminar': 'badge-eliminar'
    };
    return classes[accion] || 'badge-default';
  }

  getAccionIcon(accion: string): string {
    const icons: any = {
      'crear': 'fa-plus-circle',
      'editar': 'fa-pen',
      'eliminar': 'fa-trash-alt'
    };
    return icons[accion] || 'fa-info-circle';
  }

  getEntityIcon(entidad: string): string {
    const icons: any = {
      'antenas': 'fa-broadcast-tower',
      'abonados': 'fa-user-check',
      'agentes': 'fa-store',
      'oficinas': 'fa-building'
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
