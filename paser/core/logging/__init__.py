import logging

def setup_logger(debug: bool = False):
    logger = logging.getLogger("paser")
    if not logger.handlers:
        # File handler for all logs
        file_handler = logging.FileHandler("paser.log")
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        # Console handler for debug mode
        if debug:
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)

    logger.setLevel(logging.DEBUG if debug else logging.INFO)
    return logger