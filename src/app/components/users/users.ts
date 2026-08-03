import {
  Component,
  inject,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { UserService } from '../../services/users/userService';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './users.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './users.css',
})
export class Users implements OnInit {
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  listaUsuarios: any[] = [];
  searchTexto: string = '';
  filtroRol: string = 'todos';
  rolesOptions: any[] = [{ value: 'todos', label: 'Todos los roles' }];
  currentUser: any = null;

  mostrarConfirmarDesactivar: boolean = false;
  usuarioADesactivarId: number | null = null;
  modalConfig = {
    show: false,
    type: 'success' as 'success' | 'error' | 'warning',
    title: '',
    message: '',
    buttonText: 'Entendido',
  };

  paginaActual = 1;
  limiteActual = 10;
  totalRegistros = 0;
  totalPaginas = 1;
  rangoInicio = 0;
  rangoFin = 0;

  ngOnInit() {
    this.obtenerUsuarios();
    this.cargarRoles();
    this.loadCurrentUser();
  }

  loadCurrentUser() {
    const userJson = localStorage.getItem('user_geo');
    if (userJson) {
      this.currentUser = JSON.parse(userJson);
    }
  }

  canDeactivate(): boolean {
    if (!this.currentUser || !this.currentUser.roles) return false;
    return (
      this.currentUser.roles.rol_super_administrador || this.currentUser.roles.rol_administrador
    );
  }

  cargarRoles() {
    this.userService.obtenerRoles().subscribe({
      next: (roles) => {
        const uniqueRoles = new Map<string, string>();
        roles.forEach((r) => {
          const cleanValue = r.nombre_rol.replace(/^rol_/, '');
          const cleanKey = 'rol_' + cleanValue;
          const label = this.formatRolLabel(cleanKey);
          uniqueRoles.set(cleanValue, label);
        });

        const rolesMapeados = Array.from(uniqueRoles.entries()).map(([value, label]) => ({
          value,
          label,
        }));

        setTimeout(() => {
          this.rolesOptions = [{ value: 'todos', label: 'Todos los roles' }, ...rolesMapeados];
          this.cdr.markForCheck();
        });
      },
    });
  }

  formatRolLabel(rol: string): string {
    const cleanRol = rol.startsWith('rol_') ? rol : 'rol_' + rol;
    const labels: any = {
      rol_super_administrador: 'Súper Administrador',
      rol_administrador: 'Administrador',
      rol_analista: 'Analista',
      rol_regular: 'Regular',
    };
    return labels[cleanRol] || rol;
  }

  /* Retorna la lista filtrada basándose en el texto de búsqueda y el rol seleccionado */
  get usuariosFiltrados() {
    return this.listaUsuarios.filter((user) => {
      const matchTexto = (user.primerNombre + ' ' + user.primerApellido + ' ' + user.email)
        .toLowerCase()
        .includes(this.searchTexto.toLowerCase());

      const matchRol = this.filtroRol === 'todos' || user.roles?.['rol_' + this.filtroRol] === true;

      return matchTexto && matchRol;
    });
  }

  get usuariosPaginados() {
    const list = this.usuariosFiltrados;
    this.totalRegistros = list.length;
    this.totalPaginas = Math.ceil(this.totalRegistros / this.limiteActual) || 1;
    if (this.paginaActual > this.totalPaginas) {
      this.paginaActual = 1;
    }
    this.rangoInicio =
      this.totalRegistros > 0 ? (this.paginaActual - 1) * this.limiteActual + 1 : 0;
    this.rangoFin = Math.min(this.paginaActual * this.limiteActual, this.totalRegistros);
    const start = (this.paginaActual - 1) * this.limiteActual;
    const end = start + this.limiteActual;
    return list.slice(start, end);
  }

  onNextPage() {
    if (this.paginaActual < this.totalPaginas) {
      this.paginaActual++;
      this.cdr.markForCheck();
    }
  }

  onPrevPage() {
    if (this.paginaActual > 1) {
      this.paginaActual--;
      this.cdr.markForCheck();
    }
  }

  onLimiteChange() {
    this.paginaActual = 1;
    this.cdr.markForCheck();
  }

  obtenerUsuarios() {
    this.userService.obtenerUsuarios().subscribe({
      next: (data) => {
        this.listaUsuarios = data.map((u) => {
          const rolesObj: any = {
            rol_super_administrador: false,
            rol_administrador: false,
            rol_analista: false,
            rol_regular: false,
          };
          if (Array.isArray(u.roles)) {
            u.roles.forEach((r: string) => {
              rolesObj[r] = true;
            });
          } else if (u.roles && typeof u.roles === 'object') {
            Object.assign(rolesObj, u.roles);
          }
          return {
            ...u,
            roles: rolesObj,
          };
        });
        // No es estrictamente necesario llamar a detectChanges() aquí si usamos HttpClient
        // y el componente está en la zona de Angular, pero markForCheck es más seguro.
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al obtener usuarios:', err);
        // Fallback en caso de error masivo o para QA
        const currentUserJson = localStorage.getItem('user_geo');
        if (currentUserJson && this.listaUsuarios.length === 0) {
          const currentUser = JSON.parse(currentUserJson);
          this.listaUsuarios = [
            {
              ...currentUser,
              primerNombre: currentUser.nombre?.split(' ')[0] || 'Usuario',
              primerApellido: currentUser.nombre?.split(' ')[1] || 'QA',
              cargo: 'QA',
              roles: currentUser.roles || { rol_regular: true },
            },
          ];
        }
      },
    });
  }

  irCrearUsuario() {
    this.router.navigate(['/usuarios/nuevo']);
  }

  irEditarUsuario(id: number) {
    this.router.navigate(['/usuarios/editar', id]);
  }

  desactivar(id: number) {
    this.usuarioADesactivarId = id;
    this.mostrarConfirmarDesactivar = true;
    this.cdr.markForCheck();
  }

  confirmarDesactivar() {
    if (this.usuarioADesactivarId !== null) {
      const id = this.usuarioADesactivarId;
      this.mostrarConfirmarDesactivar = false;
      this.usuarioADesactivarId = null;
      this.cdr.markForCheck();

      this.userService.desactivarUsuario(id).subscribe({
        next: () => {
          this.mostrarModal(
            'success',
            '¡Desactivado!',
            'El usuario ha sido desactivado con éxito.',
          );
          this.obtenerUsuarios();
        },
        error: (err) => {
          const msg = err.error?.mensaje || 'Error al desactivar el usuario.';
          this.mostrarModal('error', 'Error', msg);
        },
      });
    }
  }

  cancelarDesactivar() {
    this.mostrarConfirmarDesactivar = false;
    this.usuarioADesactivarId = null;
    this.cdr.markForCheck();
  }

  mostrarModal(
    type: 'success' | 'error' | 'warning',
    title: string,
    message: string,
    buttonText: string = 'Entendido',
  ) {
    this.modalConfig = { show: true, type, title, message, buttonText };
    this.cdr.markForCheck();
  }

  cerrarModal() {
    this.modalConfig.show = false;
    this.cdr.markForCheck();
  }

  getPrincipalRole(roles: any): string {
    if (!roles) return 'Regular';
    if (roles.rol_super_administrador) return 'Super Admin';
    if (roles.rol_administrador) return 'Administrador';
    if (roles.rol_analista) return 'Analista';
    return 'Regular';
  }

  getRoleClass(roles: any): string {
    if (!roles) return 'badge-viewer';
    if (roles.rol_super_administrador || roles.rol_administrador) return 'badge-admin';
    if (roles.rol_analista) return 'badge-editor';
    return 'badge-viewer';
  }

  getRoleIcon(roles: any): string {
    if (!roles) return 'fa-user';
    if (roles.rol_super_administrador) return 'fa-crown';
    if (roles.rol_administrador) return 'fa-shield-alt';
    if (roles.rol_analista) return 'fa-chart-line';
    return 'fa-user';
  }
}
