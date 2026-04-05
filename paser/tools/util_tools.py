import datetime
import time
import ast
import operator
import logging

logger = logging.getLogger("tools")

def retry_request(func):
    def wrapper(*args, **kwargs):
        max_retries = 3
        backoff_factor = 1
        for i in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if i == max_retries - 1:
                    raise e
                sleep_time = backoff_factor * (2 ** i)
                logger.warning(f"Error in {func.__name__}, retrying in {sleep_time} seconds. Attempt {i+1}/{max_retries}. Error: {e}")
                time.sleep(sleep_time)
    return wrapper

def obtener_hora_actual(zona_horaria: str) -> str:
    try:
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        return f"La hora actual en {zona_horaria} (simulado UTC) es: {now_utc.strftime('%H:%M:%S')}"
    except Exception as e:
        logger.error(f"Error en obtener_hora_actual: {e}")
        return f"Error: {e}"

def obtener_directorio_actual() -> str:
    try:
        import os
        return os.getcwd()
    except Exception as e:
        logger.error(f"Error en obtener_directorio_actual: {e}")
        return f"Error: {e}"

def calculadora_basica(operacion: str) -> str:
    try:
        logger.debug(f"Calculando: {operacion}")
        operators = {
            ast.Add: operator.add, 
            ast.Sub: operator.sub, 
            ast.Mult: operator.mul,
            ast.Div: operator.truediv, 
            ast.Pow: operator.pow, 
            ast.USub: operator.neg
        }

        def _eval(node):
            if isinstance(node, ast.Constant): # Python 3.8+
                return node.value
            elif isinstance(node, ast.BinOp):
                return operators[type(node.op)](_eval(node.left), _eval(node.right))
            elif isinstance(node, ast.UnaryOp):
                return operators[type(node.op)](_eval(node.operand))
            else:
                raise TypeError(f"Operación no soportada: {type(node)}")

        tree = ast.parse(operacion, mode='eval')
        result = _eval(tree.body)
        return f"Resultado: {result}"
    except Exception as e:
        logger.error(f"Error en calculadora_basica: {e}")
        return f"Error: {e}"
