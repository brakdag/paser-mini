import re

class RepetitionDetector:
    def __init__(self, n=4, max_repeats=3):
        """
        n: Tamaño de la secuencia de palabras a monitorear (n-grama).
        max_repeats: Cuántas veces puede repetirse la secuencia antes de cortar.
        """
        self.n = n
        self.max_repeats = max_repeats
        self.buffer = []

    def add_text(self, text):
        """
        Procesa un fragmento de texto, lo tokeniza y verifica si hay bucles.
        Retorna True si el texto es aceptable, False si se detectó una repetición infinita.
        """
        # Tokenizamos el texto manteniendo palabras y puntuación básica
        tokens = re.findall(r'\w+|[\s\W]', text)
        
        for token in tokens:
            if not token.strip(): continue # Ignoramos espacios vacíos para el análisis de repetición
            
            self.buffer.append(token)
            
            if len(self.buffer) < self.n * 2:
                continue
            
            current_ngram = tuple(self.buffer[-self.n:])
            previous_ngram = tuple(self.buffer[-self.n*2 : -self.n])
            
            if current_ngram == previous_ngram:
                count = 1
                idx = len(self.buffer) - (self.n * 2)
                while idx >= 0:
                    if tuple(self.buffer[idx : idx + self.n]) == current_ngram:
                        count += 1
                        idx -= self.n
                    else:
                        break
                
                if count >= self.max_repeats:
                    return False
        
        return True

    def reset(self):
        self.buffer = []
