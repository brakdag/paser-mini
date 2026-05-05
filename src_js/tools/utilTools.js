export const validate_json = async ({ json_string }) => {
  try {
    JSON.parse(json_string);
    return 'El JSON es valido.';
  } catch (e) {
    return `ERR: JSON invalido: ${e.message}`;
  }
};