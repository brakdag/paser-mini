import json
import os
import paho.mqtt.client as mqtt
import logging

logger = logging.getLogger(__name__)

def _load_mqtt_config():
    """Carga la configuración de MQTT desde el archivo config.json"""
    try:
        # Buscamos el config.json relativo a este archivo
        # mqtt_tools.py está en paser/tools/, config.json en paser/config/
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.json')
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        logger.error(f"Error cargando config.json para MQTT: {e}")
        return None

def notify_mobile(mensaje: str) -> str:
    """
    Envía una notificación al teléfono del usuario vía MQTT.
    
    Args:
        mensaje (str): El texto de la notificación a enviar.
    
    Returns:
        str: Mensaje de éxito o error.
    """
    config = _load_mqtt_config()
    if not config:
        return "Error: No se pudo cargar la configuración de MQTT."

    host = config.get("mqtt_host")
    port = config.get("mqtt_port", 1883)
    topic = config.get("mqtt_topic")

    if not host or not topic:
        return "Error: Faltan parámetros de configuración de MQTT (host o topic)."

    try:
        client = mqtt.Client()
        # Conexión rápida sin loop persistente ya que es un disparo único
        client.connect(host, port, 60)
        result = client.publish(topic, mensaje)
        result.wait_for_publish()
        client.disconnect()
        return f"Notificación enviada exitosamente al tópico {topic}."
    except Exception as e:
        logger.error(f"Error enviando mensaje MQTT: {e}")
        return f"Error al enviar notificación MQTT: {str(e)}"
