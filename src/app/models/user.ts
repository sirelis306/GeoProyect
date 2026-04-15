export interface Roles {
    rol_administrador: boolean;
    rol_analista: boolean;
    rol_regular: boolean;
    rol_super_administrador: boolean;
}

export interface User {
    primerNombre: string;
    segundoNombre: string;
    primerApellido: string;
    segundoApellido?: string;
    tipoDocumento: string | null;
    documento: string;
    fechaNacimiento: string;
    pais: string | null;
    estado: string | null;
    ciudad: string | null;
    direccion: string;
    sexo: string | null;
    email: string;
    estructura?: string;
    cargo: string | null;
    roles: Roles;
}