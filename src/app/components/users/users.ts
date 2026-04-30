import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../services/users/userService';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  listaUsuarios: any[] = [];

  ngOnInit() {
    this.obtenerUsuarios();
  }

  obtenerUsuarios() {
    this.userService.obtenerUsuarios().subscribe({
      next: (data) => {
        this.listaUsuarios = data;
        this.cdr.detectChanges();
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
