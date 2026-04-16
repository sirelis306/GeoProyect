import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gis } from '../../services/gis/gisService';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CapasEstado, TipoElementoCap2 } from '../../models/gis';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/authService';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  public gis = inject(Gis);
  public auth = inject(AuthService);
  @ViewChild('selectTech') selectTech: any;

  mostrarForm = false;
  tipoEdicion: TipoElementoCap2 = 'ninguno';
  nuevoItem: any = { nombre: '', estado: '', region: '', latitud: null, longitud: null, tecnologia: [] };
  busquedaAntena: string = '';
  listaEstados = ['Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro',
    'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa',
    'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia', 'Dependencias Federales'];

  listaActividad = ['Operativa', 'Mantenimiento', 'Vandalizada'];
  clasificaciones = ['AA', 'ACI', 'PYME', 'Compartida'];
  enviando = false;
  opcionesTecnologia = [
    { value: 'GSM', label: 'GSM' },
    { value: 'UMTS', label: 'UMTS' },
    { value: 'LTE', label: 'LTE' },
    { value: 'NR', label: 'NR' }
  ];

  get todasSeleccionadas(): boolean {
    return this.nuevoItem.tecnologia?.length === this.opcionesTecnologia.length;
  }

  get algunasSeleccionadas(): boolean {
    return this.nuevoItem.tecnologia?.length > 0;
  }

  toggleAllTecnologias() {
    if (this.todasSeleccionadas) {
      this.nuevoItem.tecnologia = [];
    } else {
      this.nuevoItem.tecnologia = this.opcionesTecnologia.map(t => t.value);
    }
  }

  get esAdmin(): boolean {
    const rol = this.auth.getUserRol();
    return rol === 'admin' || rol === 'super_admin';
  }

  constructor(public router: Router) { }

  abrirModal(tipo: TipoElementoCap2) {
    console.log('Abriendo modal para:', tipo);
    this.tipoEdicion = tipo;
    this.mostrarForm = true;
    this.nuevoItem = {
      nombre: '',
      estado: null,
      latitud: null,
      longitud: null,
      direccion: '',
      actividad: 'Operativa',
      tecnologia: [],
      codigoDealer: '',
      clasificacion: null
    };
  }

  abrirMenuTech() {
    this.selectTech.open();
  }

  // En el componente donde registras el ítem
  validarCoordenadas(lat: number, lng: number): boolean {
    const limites = {
      latMin: 0.6, latMax: 12.2,
      lngMin: -73.3, lngMax: -59.7
    };

    if (lat < limites.latMin || lat > limites.latMax ||
      lng < limites.lngMin || lng > limites.lngMax) {
      alert("Las coordenadas están fuera de Venezuela. Por favor, verifícalas.");
      return false;
    }
    return true;
  }

  registroForm = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(3)]),
    direccion: new FormControl('', [Validators.required]),
    latitud: new FormControl('', [Validators.required, Validators.pattern(/^-?\d+(\.\d+)?$/)]),
    longitud: new FormControl('', [Validators.required, Validators.pattern(/^-?\d+(\.\d+)?$/)])
  });

  async guardar() {
    try {
      this.enviando = true;
      // Construir e inspeccionar los datos en el servicio
      const itemFinal = await this.gis.construirYValidarElemento(this.tipoEdicion, this.nuevoItem);

      // Si pasaron todas las validaciones sin lanzar error, se inserta
      this.gis.agregarElemento(this.tipoEdicion, itemFinal).subscribe({
        next: (res: any) => {
          this.gis.cargarDatos();
          this.mostrarForm = false;
          this.resetearFormulario();
          this.enviando = false;
        },
        error: (err) => {
          this.enviando = false;
          const mensaje = err.error?.mensaje || 'Error al guardar en la base de datos';
          alert(mensaje);
        }
      });
    } catch (error: any) {
      this.enviando = false;
      alert(error.message);
    }
  }

  // Lógica principal de guardado corregida
  async guardarItem() {
    const formValue = this.registroForm.value;
    let latitud = formValue.latitud;
    let longitud = formValue.longitud;

    if (!latitud || !longitud) {
      // LLAMADA AL SERVICIO EN LUGAR DE LOCAL
      const coords = await this.gis.obtenerCoordsDesdeDireccion(formValue.direccion);
      if (coords) {
        this.registroForm.patchValue({
          latitud: coords.lat.toString(),
          longitud: coords.lng.toString()
        });
        latitud = coords.lat.toString();
        longitud = coords.lng.toString();
      } else {
        return alert("No se encontró la ubicación.");
      }
    }
    // LLAMADA AL SERVICIO PARA GUARDAR
    this.gis.enviarAlServidor(this.registroForm.value);
    this.registroForm.reset();
  }

  // Función auxiliar para limpiar 
  resetearFormulario() {
    this.nuevoItem = {
      nombre: '', estado: null, latitud: null, longitud: null,
      cantidad: null, tecnologia: [], segmentacion_elegida: '', direccion: '',
      codigoDealer: '', clasificacion: null
    };
  }

  salir() {
    localStorage.removeItem('token_geo');
    this.router.navigate(['/login']);
  }

  // Lista de regiones con sus colores
  get regionesFiltradas() {
    // Obtenemos los nombres de las regiones que tienen datos según el tipo seleccionado
    const nombresActivos = this.gis.getRegionesConDatos();

    // Lista maestra de colores para mapear
    const colores: any = {
      'Zuliana': '#007bff', 'Los Andes': '#6610f2', 'Central': '#fd7e14',
      'Capital': '#dc3545', 'Los Llanos': '#ffc107', 'Centro Occidental': '#e83e8c',
      'Nororiental': '#20c997', 'Guayana': '#28a745', 'Insular': '#17a2b8',
    };

    return nombresActivos.map(nombre => ({
      nombre: nombre,
      color: colores[nombre] || '#DEE2E6'
    }));
  }

  toggle(capa: keyof CapasEstado) {
    this.gis.toggleCapa(capa);

    if (capa === 'operaciones' && !this.gis.capasVisibles().operaciones) {
      this.gis.setDetalleCap2('ninguno');
    }
  }

  setDetalle(tipo: TipoElementoCap2) {
    // Si ya está activo, lo desactivamos
    if (this.gis.capasVisibles().detalleCap2 === tipo) {
      this.gis.setDetalleCap2('ninguno');
    } else {
      this.gis.setDetalleCap2(tipo);
    }
  }
}
