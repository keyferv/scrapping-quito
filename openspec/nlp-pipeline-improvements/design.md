# Design: NLP Pipeline Improvements

## Architecture Approach
Cambios directos en el notebook `analisis_nlp.ipynb`. Sin arquitectura adicional.

## Design Decisions

### D1: POS Tagging Strategy
**Decisión**: Usar `nltk.pos_tag` con mapeo Penn Treebank → WordNet.
**Alternativas consideradas**:
- SnowballStemmer('spanish'): más simple pero pierde información morfológica
- spaCy: mejor pero agrega dependencia pesada
**Justificación**: WordNetLemmatizer ya está importado, solo falta el POS tag.

**Implementación**:
```python
from nltk.corpus import wordnet

def get_wordnet_pos(tag):
    if tag.startswith('J'):
        return wordnet.ADJ
    elif tag.startswith('V'):
        return wordnet.VERB
    elif tag.startswith('N'):
        return wordnet.NOUN
    elif tag.startswith('R'):
        return wordnet.ADV
    else:
        return wordnet.NOUN  # default

def lematizar_con_pos(tokens):
    tagged = nltk.pos_tag(tokens)
    return [lemmatizer.lemmatize(word, get_wordnet_pos(tag)) for word, tag in tagged]
```

### D2: Pandas Refactoring
**Decisión**: Refactorizar función `limpiar_texto` a operaciones .str encadenadas.
**Implementación**:
```python
df['text_clean'] = (
    df['text'].str.lower()
    .str.replace(r'http\S+|www\.\S+', '', regex=True)
    .str.replace(r'[^\w\sáéíóúñü]', ' ', regex=True)
    .str.replace(r'\d+', '', regex=True)
    .str.replace(r'\s+', ' ', regex=True)
    .str.strip()
)
```

### D3: Word2Vec Parameters
**Decisión**: Skip-gram (sg=1) con más dimensiones y menos epochs.
**Justificación**: Skip-gram funciona mejor con datos pocos. 200 dims captura más semántica. 20 epochs es suficiente.

## Files Affected
- `analisis_nlp.ipynb` (celdas 6, 9, 11, 14)

## Dependencies
- `nltk` (ya importado)
- `nltk.corpus.wordnet` (ya descargado)
