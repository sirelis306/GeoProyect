import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { AuthService } from '../../services/auth/authService';
import { UserService } from '../../services/users/userService';
import { User } from '../../models/user';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgSelectModule],
  templateUrl: './add-user.html',
  styleUrl: './add-user.css'
})
export class AddUser implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  showErrors = false;
  cargando = false;
  cargandoUsuario = false;
  errorMsg = '';
  passwordTemporal = '';
  esSuperAdmin = false;
  esEdicion = false;
  userId: number | null = null;

  user: User = {
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    tipoDocumento: null,
    documento: '',
    fechaNacimiento: '',
    pais: null,
    estado: null,
    ciudad: null,
    direccion: '',
    sexo: null,
    email: '',
    cargo: null,
    roles: {
      rol_super_administrador: false,
      rol_administrador: false,
      rol_analista: false,
      rol_regular: false
    }
  };

  tiposDocumento = ['V', 'E', 'P'];
  paises = ['Venezuela'];

  sexos = [
    { label: 'Masculino', value: 'M' },
    { label: 'Femenino', value: 'F' }
  ];

  cargos = [
    { label: 'Adjunto', value: 'Adjunto' },
    { label: 'Agente comercial', value: 'Agente comercial' },
    { label: 'Almacenista', value: 'Almacenista' },
    { label: 'Analista', value: 'Analista' },
    { label: 'Analista de Atención de Canales', value: 'Analista de Atención de Canales' },
    { label: 'Apoyo Administrativo', value: 'Apoyo Administrativo' },
    { label: 'Apoyo Especializado', value: 'Apoyo Especializado' },
    { label: 'Apoyo Especializado de Operaciones de la Red', value: 'Apoyo Especializado de Operaciones de la Red' },
    { label: 'Apoyo Especializado II', value: 'Apoyo Especializado II' },
    { label: 'Apoyo Técnico', value: 'Apoyo Técnico' },
    { label: 'Apoyo Técnico Comercial', value: 'Apoyo Técnico Comercial' },
    { label: 'Apoyo Técnico de Administración', value: 'Apoyo Técnico de Administración' },
    { label: 'Apoyo Técnico de Servicios Logísticos', value: 'Apoyo Técnico de Servicios Logísticos' },
    { label: 'Asesor', value: 'Asesor' },
    { label: 'Asistente', value: 'Asistente' },
    { label: 'Asistente Administrativo', value: 'Asistente Administrativo' },
    { label: 'Asistente de Operación y Mantenimiento', value: 'Asistente de Operación y Mantenimiento' },
    { label: 'Asistente de Optimización y Desempeño', value: 'Asistente de Optimización y Desempeño' },
    { label: 'Asistente de Tecnología de la Información', value: 'Asistente de Tecnología de la Información' },
    { label: 'Auxiliar de cocina', value: 'Auxiliar de cocina' },
    { label: 'Ayudante', value: 'Ayudante' },
    { label: 'Ayudante de seguridad integral', value: 'Ayudante de seguridad integral' },
    { label: 'Ayudante de Servicio de Logística', value: 'Ayudante de Servicio de Logística' },
    { label: 'Chofer', value: 'Chofer' },
    { label: 'Cocinero', value: 'Cocinero' },
    { label: 'Cocinero jefe', value: 'Cocinero jefe' },
    { label: 'Consultor I', value: 'Consultor I' },
    { label: 'Coordinador', value: 'Coordinador' },
    { label: 'Ejecutivo', value: 'Ejecutivo' },
    { label: 'Enfermero', value: 'Enfermero' },
    { label: 'Especialista soporte servicio en mensajería', value: 'Especialista soporte servicio en mensajería' },
    { label: 'Experto', value: 'Experto' },
    { label: 'Experto I', value: 'Experto I' },
    { label: 'Experto II', value: 'Experto II' },
    { label: 'Externo', value: 'Externo' },
    { label: 'Gerente', value: 'Gerente' },
    { label: 'Gerente de Linea', value: 'Gerente de Linea' },
    { label: 'Gerente General', value: 'Gerente General' },
    { label: 'Ingeniero de Monitoreo y Control', value: 'Ingeniero de Monitoreo y Control' },
    { label: 'Jurista I', value: 'Jurista I' },
    { label: 'Juristas II', value: 'Juristas II' },
    { label: 'Juristas III', value: 'Juristas III' },
    { label: 'Líder', value: 'Líder' },
    { label: 'Médico', value: 'Médico' },
    { label: 'Mensajero', value: 'Mensajero' },
    { label: 'Presidente', value: 'Presidente' },
    { label: 'Supervisor', value: 'Supervisor' },
    { label: 'Teleoperador', value: 'Teleoperador' },
    { label: 'Teleoperador 0800 Activar', value: 'Teleoperador 0800 Activar' },
    { label: 'Vicepresidente', value: 'Vicepresidente' }
  ];

  estados = [
    'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes',
    'Delta Amacuro', 'Falcón', 'Guárico', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta',
    'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'La Guaira', 'Yaracuy', 'Zulia', 'Distrito Capital'
  ].sort((a, b) => a.localeCompare(b));

  ciudadesMap: { [key: string]: string[] } = {
    'Amazonas': ['Puerto Ayacucho', 'San Fernando de Atabapo'],
    'Anzoátegui': ['Barcelona', 'Puerto La Cruz', 'El Tigre', 'Anaco', 'Lechería'],
    'Apure': ['San Fernando de Apure', 'Elorza', 'Guasdualito'],
    'Aragua': ['Maracay', 'Cagua', 'Turmero', 'La Victoria', 'El Limón'],
    'Barinas': ['Barinas', 'Socopó', 'Santa Bárbara'],
    'Bolívar': ['Ciudad Bolívar', 'Puerto Ordaz', 'San Félix', 'Upata', 'El Callao'],
    'Carabobo': ['Valencia', 'Puerto Cabello', 'Guacara', 'San Diego', 'Naguanagua'],
    'Cojedes': ['San Carlos', 'Tinaquillo'],
    'Delta Amacuro': ['Tucupita'],
    'Falcón': ['Coro', 'Punto Fijo', 'Tucacas'],
    'Guárico': ['San Juan de los Morros', 'Valle de la Pascua', 'Calabozo', 'Zaraza'],
    'Lara': ['Barquisimeto', 'Cabudare', 'Carora', 'El Tocuyo'],
    'Mérida': ['Mérida', 'El Vigía', 'Ejido', 'Tovar'],
    'Miranda': ['Los Teques', 'Guarenas', 'Guatire', 'Charallave', 'Petare', 'Baruta', 'Chacao', 'El Hatillo'],
    'Monagas': ['Maturín', 'Punta de Mata'],
    'Nueva Esparta': ['Porlamar', 'Pampatar', 'La Asunción', 'Juan Griego'],
    'Portuguesa': ['Acarigua', 'Guanare', 'Araure'],
    'Sucre': ['Cumaná', 'Carúpano', 'Güiria'],
    'Táchira': ['San Cristóbal', 'Táriba', 'San Antonio del Táchira', 'Rubio'],
    'Trujillo': ['Valera', 'Trujillo', 'Boconó'],
    'La Guaira': ['La Guaira', 'Maiquetía', 'Catia La Mar', 'Macuto'],
    'Yaracuy': ['San Felipe', 'Yaritagua', 'Chivacoa'],
    'Zulia': ['Maracaibo', 'San Francisco', 'Cabimas', 'Ciudad Ojeda', 'Machiques'],
    'Distrito Capital': ['Caracas']
  };

  ciudadesDisponibles: string[] = [];

  modalConfig = {
    show: false,
    type: 'success' as 'success' | 'error' | 'warning',
    title: '',
    message: '',
    buttonText: 'Entendido'
  };

  ngOnInit() {
    const rol = this.auth.getUserRol();
    this.esSuperAdmin = rol === 'super_admin';

    const id = this.route.snapshot.params['id'];
    if (id) {
      this.esEdicion = true;
      this.userId = Number(id);
      this.cargarUsuario(this.userId);
    }
  }

  mostrarModal(type: 'success' | 'error' | 'warning', title: string, message: string, buttonText: string = 'Entendido') {
    this.modalConfig = { show: true, type, title, message, buttonText };
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.modalConfig.show = false;
    if (this.modalConfig.type === 'success' && this.esEdicion) {
      this.router.navigate(['/usuarios']);
    }
  }

  cargarUsuario(id: number) {
    this.cargandoUsuario = true;
    this.userService.obtenerUsuarioPorId(id).subscribe({
      next: (userData) => {
        // Fusión robusta para evitar que campos nulos rompan el formulario
        this.user = {
          ...this.user,
          ...userData,
          roles: userData.roles || this.user.roles
        };
        if (this.user.estado) this.onEstadoChange(false);
        this.cargandoUsuario = false;
        this.cdr.detectChanges(); // Forzar actualización de la vista
      },
      error: (err) => {
        this.cargandoUsuario = false;
        this.mostrarModal('error', 'Error de Carga', 'No se pudo cargar el usuario para editar.');
      }
    });
  }

  onEstadoChange(limpiarCiudad: boolean = true) {
    if (limpiarCiudad) this.user.ciudad = null;
    this.ciudadesDisponibles = this.user.estado ? this.ciudadesMap[this.user.estado] || [] : [];
  }

  guardar(form: NgForm) {
    this.errorMsg = '';
    if (form.invalid) {
      this.showErrors = true;
      this.mostrarModal('warning', 'Campos Incompletos', 'Por favor, rellene todos los campos obligatorios marcados con (*).');
      return;
    }
    const tieneRol = Object.values(this.user.roles).some(rol => rol === true);
    if (!tieneRol) {
      this.mostrarModal('warning', 'Sin Roles', 'Debe seleccionar al menos un rol para el usuario.');
      return;
    }

    this.cargando = true;
    if (this.esEdicion && this.userId) {
      this.userService.actualizarUsuario(this.userId, this.user).subscribe({
        next: () => {
          this.cargando = false;
          this.mostrarModal('success', '¡Actualizado!', 'El usuario ha sido actualizado con éxito.');
        },
        error: (err) => {
          this.cargando = false;
          const msg = err.error?.mensaje || 'Error al actualizar el usuario.';
          this.mostrarModal('error', 'Error', msg);
        }
      });
    } else {
      this.userService.crearUsuario(this.user).subscribe({
        next: (res) => {
          this.cargando = false;
          this.passwordTemporal = res.passwordTemporal;
          // No mostramos modal aquí porque ya tenemos el success-panel que muestra la contraseña
        },
        error: (err) => {
          this.cargando = false;
          const msg = err.error?.mensaje || 'Error al crear el usuario.';
          this.mostrarModal('error', 'Error', msg);
        }
      });
    }
  }

  cerrarYRegresar() {
    this.router.navigate(['/usuarios']);
  }

  regresar() {
    this.router.navigate(['/usuarios']);
  }
}
