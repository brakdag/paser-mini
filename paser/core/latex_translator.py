import re

class LatexTranslator:
    LATEX_TO_UNICODE = {
        r"\alpha": "\u03b1", r"\beta": "\u03b2", r"\gamma": "\u03b3", r"\delta": "\u03b4",
        r"\epsilon": "\u03b5", r"\zeta": "\u03b6", r"\eta": "\u03b7", r"\theta": "\u03b8",
        r"\iota": "\u03b9", r"\kappa": "\u03ba", r"\lambda": "\u03bb", r"\mu": "\u03bc",
        r"\nu": "\u03bd", r"\xi": "\u03be", r"\pi": "\u03c0", r"\rho": "\u03c1",
        r"\sigma": "\u03c3", r"\tau": "\u03c4", r"\upsilon": "\u03c5", r"\phi": "\u03c6",
        r"\chi": "\u03c7", r"\psi": "\u03c8", r"\omega": "\u03c9",
        r"\Gamma": "\u0393", r"\Delta": "\u2206", r"\Theta": "\u0398", r"\Lambda": "\u039b",
        r"\Sigma": "\u03a3", r"\Phi": "\u03a6", r"\Psi": "\u03a8", r"\Omega": "\u03a9",
        r"\forall": "\u2200", r"\exists": "\u2203", r"\in": "\u2208", r"\notin": "\u2209",
        r"\subset": "\u2282", r"\supset": "\u2283", r"\cup": "\u222a", r"\cap": "\u2229",
        r"\emptyset": "\u2205", r"\wedge": "\u2227", r"\vee": "\u2228", r"\neg": "\u00ac",
        r"\implies": "\u21d2", r"\iff": "\u21d4", r"\rightarrow": "\u2192", r"\leftarrow": "\u2190",
        r"\leftrightarrow": "\u2194", r"\Rightarrow": "\u21d2", r"\Leftarrow": "\u21d0",
        r"\Leftrightarrow": "\u21d4", r"\approx": "\u2248", r"\sim": "\u223c",
        r"\equiv": "\u2261", r"\propto": "\u221d", r"\neq": "\u2260", r"\le": "\u2264",
        r"\ge": "\u2265", r"\times": "\u00d7", r"\div": "\u00f7", r"\pm": "\u00b1",
        r"\mp": "\u00b1", r"\cdot": "\u22c5", r"\ast": "\u2217", r"\int": "\u222b",
        r"\sum": "\u2211", r"\prod": "\u220f", r"\partial": "\u2202", r"\nabla": "\u2207",
        r"\infty": "\u221e", r"\mathbb{R}": "\u211d", r"\mathbb{Z}": "\u2124",
        r"\mathbb{N}": "\u2115", r"\mathbb{Q}": "\u211a", r"\mathbb{C}": "\u2102",
    }

    @classmethod
    def translate(cls, text: str) -> str:
        sorted_keys = sorted(cls.LATEX_TO_UNICODE.keys(), key=len, reverse=True)
        pattern = re.compile("|".join(re.escape(k) for k in sorted_keys))
        block_pattern = re.compile(r"\$(.*?)\$")
        
        def replace_block(match):
            content = match.group(1)
            return pattern.sub(lambda m: cls.LATEX_TO_UNICODE[m.group(0)], content)
        
        return block_pattern.sub(replace_block, text)
