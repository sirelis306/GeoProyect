import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
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
  styleUrl: './users.css'
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
    return this.currentUser.roles.rol_super_administrador || this.currentUser.roles.rol_administrador;
  }

  cargarRoles() {
    this.userService.obtenerRoles().subscribe({
      next: (roles) => {
        const rolesMapeados = roles.map(r => ({
          value: r.nombre_rol.replace('rol_', ''), // quitamos el prefijo para el filtro
          label: this.formatRolLabel(r.nombre_rol)
        }));

        setTimeout(() => {
          this.rolesOptions = [{ value: 'todos', label: 'Todos los roles' }, ...rolesMapeados];
          this.cdr.markForCheck();
        });
      }
    });
  }

  formatRolLabel(rol: string): string {
    const labels: any = {
      'rol_super_administrador': 'Súper Administrador',
      'rol_administrador': 'Administrador',
      'rol_analista': 'Analista',
      'rol_regular': 'Regular'
    };
    return labels[rol] || rol;
  }

  /* Retorna la lista filtrada basándose en el texto de búsqueda y el rol seleccionado */
  get usuariosFiltrados() {
    return this.listaUsuarios.filter(user => {
      const matchTexto =
        (user.primerNombre + ' ' + user.primerApellido + ' ' + user.email)
          .toLowerCase()
          .includes(this.searchTexto.toLowerCase());

      const matchRol = this.filtroRol === 'todos' ||
        user.roles?.['rol_' + this.filtroRol] === true;

      return matchTexto && matchRol;
    });
  }

  obtenerUsuarios() {
    this.userService.obtenerUsuarios().subscribe({
      next: (data) => {
        this.listaUsuarios = data;
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
          this.listaUsuarios = [{
            ...currentUser,
            primerNombre: currentUser.nombre?.split(' ')[0] || 'Usuario',
            primerApellido: currentUser.nombre?.split(' ')[1] || 'QA',
            cargo: 'QA',
            roles: currentUser.roles || { rol_regular: true }
          }];
        }
      }
    });
  }

  irCrearUsuario() {
    this.router.navigate(['/usuarios/nuevo']);
  }

  irEditarUsuario(id: number) {
    this.router.navigate(['/usuarios/editar', id]);
  }

  desactivar(id: number) {
    if (confirm('¿Estás seguro de que deseas desactivar este usuario? Perderá acceso al sistema.')) {
      this.userService.desactivarUsuario(id).subscribe({
        next: () => {
          alert('Usuario desactivado con éxito');
          this.obtenerUsuarios();
        },
        error: (err) => alert(err.error?.mensaje || 'Error al desactivar el usuario')
      });
    }
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
