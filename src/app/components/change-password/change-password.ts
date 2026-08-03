import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/authService';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './change-password.css',
})
export class ChangePassword {
  private auth = inject(AuthService);
  private router = inject(Router);

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  cargando = false;
  error = '';
  success = '';
  verPassword1 = false;
  verPassword2 = false;
  verPassword3 = false;
  requiereCambio = false;

  ngOnInit() {
    const user = this.auth.currentUser();
    this.requiereCambio = user && (user.cambiar_password === true || user.cambiar_password === 1);
  }

  cancelar() {
    this.router.navigate(['/mapa']);
  }

  onSubmit() {
    this.error = '';
    this.success = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.error = 'Por favor, rellene todos los campos.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.error = 'La nueva contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;

    this.auth
      .cambiarPassword({
        current_password: this.currentPassword,
        new_password: this.newPassword,
      })
      .subscribe({
        next: (res) => {
          this.cargando = false;
          this.success = 'Contraseña cambiada con éxito. Redirigiendo...';
          setTimeout(() => {
            this.router.navigate(['/mapa']);
          }, 2000);
        },
        error: (err) => {
          this.cargando = false;
          this.error = err.error?.error || 'Error al cambiar la contraseña. Verifique sus datos.';
        },
      });
  }

  logout() {
    this.auth.logout();
  }
}
