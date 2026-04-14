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
    tipoDocumento: '',
    documento: '',
    fechaNacimiento: '',
    pais: '',
    estado: '',
    ciudad: '',
    direccion: '',
    sexo: '',
    email: '',
    cargo: '',
    roles: {
      ROLE_ADMINISTRADOR: false,
      ROLE_ANALISTA: false,
      ROLE_REGULAR: false,
      ROLE_SUPER_ADMINISTRADOR: false
    }
  };

  tiposDocumento = ['V', 'E', 'P'];
  paises = ['Venezuela'];

  sexos = [
    { label: 'Masculino', value: 'M' },
    { label: 'Femenino', value: 'F' }
  ];

  cargos = [
    { label: 'Gerente', value: 'gerente' },
    { label: 'Analista', value: 'analista' },
    { label: 'Especialista', value: 'especialista' }
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
    this.user.ciudad = '';
    this.ciudadesDisponibles = this.ciudadesMap[this.user.estado] || [];
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
