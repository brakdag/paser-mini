import logging

def setup_logger():
    logger = logging.getLogger("paser")
    if not logger.handlers:
        handler = logging.FileHandler("paser.log")
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger
