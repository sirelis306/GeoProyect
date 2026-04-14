export interface Roles {
    ROLE_ADMINISTRADOR: boolean;
    ROLE_ANALISTA: boolean;
    ROLE_REGULAR: boolean;
    ROLE_SUPER_ADMINISTRADOR: boolean;
}

export interface User {
    primerNombre: string;
    segundoNombre: string;
    primerApellido: string;
    segundoApellido?: string;
    tipoDocumento: string;
    documento: string;
    fechaNacimiento: string;
    pais: string;
    estado: string;
    ciudad: string;
    direccion: string;
    sexo: string;
    email: string;
    estructura?: string;
    cargo: string;
    roles: Roles;
}