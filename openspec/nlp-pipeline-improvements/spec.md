# Spec: NLP Pipeline Improvements

## Requirements

### REQ-1: Lemmatización con POS tags
- **ID**: REQ-1
- **Priority**: CRITICAL
- **Description**: El lemmatizador debe usar POS tags para lemmatizar correctamente verbos y sustantivos.
- **Acceptance Criteria**:
  - "walking" → "walk" (verbo)
  - "visited" → "visit" (verbo)
  - "churches" → "church" (sustantivo plural)
  - Se importa y usa `nltk.pos_tag`
  - Se mapean POS tags de Penn Treebank a WordNet

### REQ-2: TfidfVectorizer con sublinear_tf
- **ID**: REQ-2
- **Priority**: HIGH
- **Description**: TfidfVectorizer debe usar escala sub-lineal de frecuencia términos.
- **Acceptance Criteria**:
  - Parámetro `sublinear_tf=True` presente en ambas instancias de TfidfVectorizer
  - Scores TF-IDF cambian (palabras frecuentes menos dominantes)

### REQ-3: Pandas .str accessor
- **ID**: REQ-3
- **Priority**: MEDIUM
- **Description**: Limpieza de texto debe usar operaciones vectorizadas de pandas.
- **Acceptance Criteria**:
  - `.str.lower()` en vez de `.apply(lambda x: x.lower())`
  - `.str.replace()` con `regex=True` para patrones
  - Función `limpiar_texto` refactorizada o reemplazada

### REQ-4: Word2Vec optimizado
- **ID**: REQ-4
- **Priority**: LOW
- **Description**: Parámetros Word2Vec optimizados para corpus pequeño.
- **Acceptance Criteria**:
  - `vector_size=200`
  - `min_count=2`
  - `epochs=20`
  - `sg=1` (Skip-gram)

### REQ-5: Fix bare except
- **ID**: REQ-5
- **Priority**: LOW
- **Description**: Reemplazar `except:` genérico por excepción específica.
- **Acceptance Criteria**:
  - `except ValueError:` en vez de `except:`
  - Mensaje de error se mantiene

## Scenarios

### S1: Lemmatización correcta
- **Given**: Token "walking" con POS tag VB
- **When**: Se aplica lemmatización
- **Then**: Resultado es "walk"

### S2: TF-IDF con sublinear scaling
- **Given**: Palabra "church" aparece 271 veces
- **When**: Se calcula TF-IDF con sublinear_tf=True
- **Then**: Score es menor que sin sublinear_tf (penalización logarítmica)

### S3: Word2Vec Skip-gram
- **Given**: Corpus de 598 reviews
- **When**: Se entrena Word2Vec con sg=1
- **Then**: Vocabulario similar pero mejor calidad de embeddings
