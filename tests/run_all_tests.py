import unittest
import sys

if __name__ == '__main__':
    # Buscamos en la carpeta 'tests' con un patrón muy amplio para no perder nada
    loader = unittest.TestLoader()
    suite = loader.discover('tests')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    sys.exit(0 if result.wasSuccessful() else 1)
