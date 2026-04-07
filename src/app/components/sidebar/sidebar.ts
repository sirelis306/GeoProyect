import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gis } from '../../services/gis/gisService';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CapasEstado, TipoElementoCap2 } from '../../models/gis';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/authService';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

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
  private http = inject(HttpClient);
  
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

  async guardar() { // Añadimos 'async' para poder usar 'await' en la geocodificación
    // 1. Objeto base
    let itemFinal: any = {
        estado: this.nuevoItem.estado,
        region: this.obtenerRegion(this.nuevoItem.estado),
        tipo: this.tipoEdicion,
        direccion: this.nuevoItem.direccion || '',
        cantidad: Number(this.nuevoItem.cantidad) || 0
    };

    // 2. LÓGICA ESPECIAL PARA RADIOBASES (ANTENAS)
    if (this.tipoEdicion === 'antenas') {
        let lat = this.nuevoItem.latitud;
        let lng = this.nuevoItem.longitud;

        // PRIORIDAD: Si no hay coordenadas, buscamos por dirección
        if (!lat || !lng) {
            if (!itemFinal.direccion) {
                alert("Para antenas debe colocar coordenadas o una dirección válida.");
                return;
            }
            const coordsAuto = await this.obtenerCoordsDesdeDireccion(itemFinal.direccion);
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
        // 3. LÓGICA PARA ABONADOS / OFICINAS (Puntos fijos por estado)
        const coords = this.COORD_CENTRALES[this.nuevoItem.estado];

        if (this.tipoEdicion === 'abonados') {
            itemFinal.segmentacion = this.nuevoItem.segmentacion_elegida || '4G';
            itemFinal.nombre = `ABONADOS ${itemFinal.segmentacion} - ${this.nuevoItem.estado}`;
        } else {
            itemFinal.nombre = `${this.tipoEdicion.toUpperCase()} - ${this.nuevoItem.estado}`;
            itemFinal.segmentacion = null;
        }

        itemFinal.latitud = coords ? coords.lat : 0;
        itemFinal.longitud = coords ? coords.lng : 0;
        itemFinal.tecnologia = null;
        itemFinal.actividad = null;
    }

    // 4. Verificación final de campos obligatorios
    if (!itemFinal.estado || (this.tipoEdicion !== 'antenas' && itemFinal.cantidad <= 0)) {
        alert("Por favor, rellene el estado y una cantidad válida.");
        return;
    }

    // 5. Envío y Limpieza
    this.gis.agregarElemento(this.tipoEdicion, itemFinal);
    this.mostrarForm = false;
    this.resetearFormulario();
}

enviarAlServidor(datos: any) {
    this.http.post('http://localhost:3000/api/elementos', datos).subscribe({
      next: (res) => {
        alert("Elemento guardado con éxito");
        this.registroForm.reset(); 
      },
      error: (err) => console.error("Error al guardar:", err)
    });
  }

  // 2. Lógica principal de guardado corregida
  async guardarItem() {
    const formValue = this.registroForm.value;
    let latitud = formValue.latitud;
    let longitud = formValue.longitud;
    const direccion = formValue.direccion;

    // Si no hay coordenadas, buscamos por dirección
    if (!latitud || !longitud) {
      const coords = await this.obtenerCoordsDesdeDireccion(direccion);
      if (coords) {
        // Convertimos a string para el formulario si es necesario
        this.registroForm.patchValue({
          latitud: coords.lat.toString(),
          longitud: coords.lng.toString()
        });
        latitud = coords.lat.toString();
        longitud = coords.lng.toString();
      } else {
        return alert("No se encontró la ubicación. Por favor, coloque coordenadas manualmente.");
      }
    }

    // Validación de seguridad para que no salga del mapa de Venezuela
    const latNum = Number(latitud);
    const lngNum = Number(longitud);

    if (latNum < 0.6 || latNum > 12.2 || lngNum < -73.3 || lngNum > -59.7) {
      return alert("Error: Las coordenadas están fuera de los límites de Venezuela.");
    }

    this.enviarAlServidor(this.registroForm.value);
  }

  async obtenerCoordsDesdeDireccion(direccion: string | null | undefined): Promise<{lat: number, lng: number} | null> {
    if (!direccion) return null; // Resuelve el error 2345 al asegurar que hay un string
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}, Venezuela`;
      const res: any = await this.http.get(url).toPromise();
      
      if (res && res.length > 0) {
        return {
          lat: parseFloat(res[0].lat),
          lng: parseFloat(res[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error("Error en geocodificación:", error);
      return null;
    }
  }

// Función auxiliar para limpiar (mantiene el código ordenado)
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

  public obtenerRegion(estado: string): string {
    const mapeo: any = {
    // Región Capital
    'Distrito Capital': 'Capital','Miranda': 'Capital','La Guaira': 'Capital',
    // Región Central
    'Carabobo': 'Central', 'Aragua': 'Central', 'Cojedes': 'Central',
    // Región de los Llanos
    'Guárico': 'Los Llanos', 'Apure': 'Los Llanos',
    // Región Centro Occidental
    'Falcón': 'Centro Occidental', 'Lara': 'Centro Occidental', 'Portuguesa': 'Centro Occidental', 'Yaracuy': 'Centro Occidental',
    // Región Zuliana
    'Zulia': 'Zuliana',
    // Región de los Andes
    'Mérida': 'Los Andes', 'Táchira': 'Los Andes', 'Trujillo': 'Los Andes', 'Barinas': 'Los Andes',
    // Región Nororiental
    'Anzoátegui': 'Nororiental', 'Monagas': 'Nororiental', 'Sucre': 'Nororiental',
    // Región Insular
    'Nueva Esparta': 'Insular', 'Dependencias Federales': 'Insular',
    // Región Guayana
    'Bolívar': 'Guayana', 'Amazonas': 'Guayana', 'Delta Amacuro': 'Guayana'
  };
    return mapeo[estado] || '';
  }

  private COORD_CENTRALES: any = {
    'Amazonas': { lat: 3.4167, lng: -65.5000 },
    'Anzoátegui': { lat: 9.3333, lng: -64.3333 },
    'Apure': { lat: 7.0000, lng: -69.0000 },
    'Aragua': { lat: 10.2500, lng: -67.2500 },
    'Barinas': { lat: 8.3333, lng: -70.0000 },
    'Bolívar': { lat: 6.0000, lng: -63.0000 },
    'Carabobo': { lat: 10.1620, lng: -68.0070 },
    'Cojedes': { lat: 9.1667, lng: -68.3333 },
    'Delta Amacuro': { lat: 8.5000, lng: -61.5000 },
    'Distrito Capital': { lat: 10.5000, lng: -66.9167 },
    'Falcón': { lat: 11.0000, lng: -70.0000 },
    'Guárico': { lat: 8.5000, lng: -66.5000 },
    'La Guaira': { lat: 10.6000, lng: -66.9333 },
    'Lara': { lat: 10.1667, lng: -69.6667 },
    'Mérida': { lat: 8.5000, lng: -71.1667 },
    'Miranda': { lat: 10.2500, lng: -66.5000 },
    'Monagas': { lat: 9.3333, lng: -63.0000 },
    'Nueva Esparta': { lat: 10.9833, lng: -63.9167 },
    'Portuguesa': { lat: 9.0000, lng: -69.2500 },
    'Sucre': { lat: 10.4167, lng: -63.5000 },
    'Táchira': { lat: 7.8333, lng: -72.1667 },
    'Trujillo': { lat: 9.4167, lng: -70.5000 },
    'Yaracuy': { lat: 10.3333, lng: -68.7500 },
    'Zulia': { lat: 10.3333, lng: -72.0000 }
  };

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
