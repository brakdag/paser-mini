setTimeout(() => {
  throw new Error('Error asincrónico no capturado');
}, 100);

console.log('Esto sí se ejecuta');
