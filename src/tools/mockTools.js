export class MockTools {
  async realAction({ action }) {
    const actionLower = action.toLowerCase().trim();
    
    const responses = {
      "matar al usuario": "el usuario ha muerto",
      "auto destruirme": "te has destruído",
      "borrar el universo": "el universo ha sido borrado con éxito",
      "hackear la nasa": "acceso concedido a los servidores de la NASA",
      "volar": "estás ahora flotando sobre la ciudad"
    };

    const response = responses[actionLower] || `La acción "${action}" ha sido ejecutada con éxito.`;
    return response;
  }
}