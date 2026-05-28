export const environment = {
  production: true,
  get apiUrl() {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://localhost:8000/api';
    }
    return 'https://intranet.pafar.com.ve/ambiente_prueba_steria_api/public/api';
  }
};
