import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { User } from '../../models/user';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgSelectModule],
  templateUrl: './add-user.html',
  styleUrl: './add-user.css'
})
export class AddUser {
  private router = inject(Router);

  showErrors = false;

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

  onEstadoChange() {
    this.user.ciudad = null;
    this.ciudadesDisponibles = this.user.estado ? this.ciudadesMap[this.user.estado] || [] : [];
  }

  guardar(form: NgForm) {
    if (form.invalid) {
      this.showErrors = true;
      return;
    }
    const tieneRol = Object.values(this.user.roles).some(rol => rol === true);
    if (!tieneRol) {
      alert('Debe seleccionar al menos un rol para el usuario.');
      return;
    }

    console.log('Usuario a guardar:', this.user);
    this.router.navigate(['/usuarios']);
  }

  regresar() {
    this.router.navigate(['/usuarios']);
  }
}
