import re

class RepetitionDetector:
    def __init__(self, n=20, max_repeats=5):
        self.n = n
        self.max_repeats = max_repeats
        from collections import deque
        self.buffer = deque(maxlen=n * max_repeats)

    def add_text(self, text):
        if text is None: return True
        tokens = re.findall(r'\w+', text)
        
        for token in tokens:
            self.buffer.append(token)
            if len(self.buffer) < self.n * 2: continue
            
            # Check if the last n tokens match the previous n tokens
            current_ngram = tuple(list(self.buffer)[-self.n:])
            previous_ngram = tuple(list(self.buffer)[-self.n*2:-self.n])
            
            if current_ngram == previous_ngram:
                # Simple count of occurrences in the fixed-size buffer
                count = 0
                buf_list = list(self.buffer)
                for i in range(0, len(buf_list) - self.n + 1, self.n):
                    if tuple(buf_list[i:i+self.n]) == current_ngram:
                        count += 1
                
                if count >= self.max_repeats:
                    return " ".join(current_ngram)
        return True

    def reset(self):
        self.buffer.clear()
