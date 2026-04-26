import logging
import os

def setup_logger(debug: bool = False):
    logger = logging.getLogger("src")
    if not logger.handlers:
        # Determine log path: application root/config/src.log
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        log_path = os.path.join(base_dir, "config", "src.log")
        
        # File handler for all logs
        file_handler = logging.FileHandler(log_path)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        # Console handler for debug mode
        if debug:
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)

    logger.setLevel(logging.DEBUG if debug else logging.WARNING)
    return logger