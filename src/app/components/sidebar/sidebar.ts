import { Component, inject } from '@angular/core';
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
  
  mostrarForm = false;
  tipoEdicion: TipoElementoCap2 = 'ninguno';
  nuevoItem: any = { nombre: '', estado: '', region: '', latitud: null, longitud: null };
  listaEstados = ['Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 
  'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 
  'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia', 'Dependencias Federales'];

  get esAdmin(): boolean {
    const rol = this.auth.getUserRol();
    //console.log("Tu rol actual es:", rol); 
    // Temporalmente, cambia esto a 'true' para ver si el botón aparece físicamente
    //return true; 
    
    return this.auth.getUserRol() === 'admin';
  }
  
  constructor(public router: Router) {}

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
      actividad: 'Operativa' 
    };
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
    // Objeto base
    let itemFinal: any = {
        estado: this.nuevoItem.estado,
        region: this.gis.obtenerRegion(this.nuevoItem.estado),
        tipo: this.tipoEdicion,
        direccion: this.nuevoItem.direccion || '',
        cantidad: Number(this.nuevoItem.cantidad) || 0
    };

    // LÓGICA ESPECIAL PARA RADIOBASES (ANTENAS)
    if (this.tipoEdicion === 'antenas') {
        let lat = this.nuevoItem.latitud;
        let lng = this.nuevoItem.longitud;

        // Si no hay coordenadas, buscamos por dirección
        if (!lat || !lng) {
            if (!itemFinal.direccion) {
                alert("Para antenas debe colocar coordenadas o una dirección válida.");
                return;
            }
            const coordsAuto = await this.gis.obtenerCoordsDesdeDireccion(itemFinal.direccion);
            if (coordsAuto) {
                lat = coordsAuto.lat;
                lng = coordsAuto.lng;
            } else {
                alert("No se pudo encontrar la ubicación por dirección. Intente colocar coordenadas manualmente.");
                return;
            }
        }

        // VALIDACIÓN DE SEGURIDAD: Rango de Venezuela
        const latNum = Number(lat);
        const lngNum = Number(lng);
        if (latNum < 0.6 || latNum > 12.2 || lngNum < -73.3 || lngNum > -59.7) {
            alert("Error: Las coordenadas están fuera de los límites de Venezuela.");
            return;
        }

        itemFinal.nombre = this.nuevoItem.nombre;
        itemFinal.latitud = latNum;
        itemFinal.longitud = lngNum;
        itemFinal.tecnologia = this.nuevoItem.tecnologia || '4G';
        itemFinal.actividad = this.nuevoItem.actividad || 'Operativa';
        itemFinal.cantidad = 1;

    } else {
        // LÓGICA PARA ABONADOS / OFICINAS (Puntos fijos por estado)
        const coords = this.gis.getCoordsCentrales(this.nuevoItem.estado);

        if (this.tipoEdicion === 'abonados') {
            itemFinal.segmentacion = this.nuevoItem.segmentacion_elegida || '4G';
            itemFinal.nombre = `Abonados ${itemFinal.segmentacion} ${this.nuevoItem.estado}`;
        } else {
            itemFinal.nombre = `${this.tipoEdicion.toUpperCase()} - ${this.nuevoItem.estado}`;
            itemFinal.segmentacion = null;
        }

        itemFinal.latitud = coords ? coords.lat : 0;
        itemFinal.longitud = coords ? coords.lng : 0;
        itemFinal.tecnologia = null;
        itemFinal.actividad = null;
    }

    // Verificación final de campos obligatorios
    if (!itemFinal.estado || (this.tipoEdicion !== 'antenas' && itemFinal.cantidad <= 0)) {
        alert("Por favor, rellene el estado y una cantidad válida.");
        return;
    }

    // Envío y Limpieza
    this.gis.agregarElemento(this.tipoEdicion, itemFinal);
    this.mostrarForm = false;
    this.resetearFormulario();
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
          cantidad: null, tecnologia: '', segmentacion_elegida: '', direccion: '' 
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
    // Si ya está activo, lo desactivamos (opcional)
    if (this.gis.capasVisibles().detalleCap2 === tipo) {
      this.gis.setDetalleCap2('ninguno');
    } else {
      this.gis.setDetalleCap2(tipo);
    }
  }
}
