import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth/authService';
import { ToastService } from '../../services/toast/toastService';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);

  creds = { email: '', password: '' };
  error = '';
  cargando = false;
  verPassword = false;

  ngOnInit() {
    // Escuchar si la sesión expiró para mostrar una alerta amigable (Toast)
    this.route.queryParams.subscribe(params => {
      if (params['expired'] === 'true') {
        this.toastService.showError('Su sesión ha expirado por inactividad. Por favor, ingrese de nuevo.');
      }
    });

    // Si ya está logueado, lo mandamos al mapa o a cambiar contraseña según corresponda
    if (this.auth.estaLogueado()) {
      const user = this.auth.currentUser();
      if (user && (user.cambiar_password === true || user.cambiar_password === 1)) {
        this.router.navigate(['/cambiar-contrasena']);
      } else {
        this.router.navigate(['/mapa']);
      }
    }
  }

  ingresar() {
    this.cargando = true;
    this.error = '';

    this.auth.login(this.creds).subscribe({
      next: (res) => {
        this.cargando = false;
        console.log('Login exitoso', res);
        
        const user = this.auth.currentUser();
        if (user && (user.cambiar_password === true || user.cambiar_password === 1)) {
          this.router.navigate(['/cambiar-contrasena']);
        } else {
          this.router.navigate(['/mapa']);
        }
      },
      error: (err) => {
        this.cargando = false;
        this.error = 'Usuario o contraseña incorrectos';
      }
    });
  }
}