import re

class RepetitionDetector:
    def __init__(self, n=20, max_repeats=50):
        """
        n: Size of the word sequence to monitor (n-gram).
        max_repeats: How many times the sequence can repeat before cutting.
        """
        self.n = n
        self.max_repeats = max_repeats
        self.buffer = []

    def add_text(self, text):
        """
        Processes a text fragment, tokenizes it, and checks for loops.
        Returns True if the text is acceptable, False if an infinite repetition is detected.
        """
        if text is None:
            return True

        # Tokenize text keeping words and basic punctuation
        tokens = re.findall(r'\w+|[\s\W]', text)
        
        for token in tokens:
            # CRITICAL FILTER: Ignore tokens that do not have alphanumeric content
            # This prevents separators like '---', '...', or spaces from triggering the detector
            if not token.strip() or not any(c.isalnum() for c in token):
                continue
            
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
                    return " ".join(current_ngram)
        
        return True

    def reset(self):
        self.buffer = []
