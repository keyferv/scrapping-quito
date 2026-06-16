# Proposal: NLP Pipeline Improvements

## Intent
Mejorar la calidad y corrección del pipeline NLP en `analisis_nlp.ipynb` basándose en la documentación actualizada de las librerías utilizadas.

## Scope
- Archivo: `analisis_nlp.ipynb` (único archivo afectado)
- Branch: `test/nlp-experiments`

## Mejoras Propuestas

### 1. Fix Lemmatización con POS tags (CRÍTICO)
**Problema**: `WordNetLemmatizer.lemmatize()` sin POS tags asume sustantivo. Verbos como "walking", "visited", "enjoyed" NO se lematizan.
**Solución**: Agregar `nltk.pos_tag` para obtener POS tags y pasarlos al lemmatizador.
**Impacto**: Alto

### 2. Agregar sublinear_tf=True a TfidfVectorizer
**Problema**: Sin escala sub-lineal, palabras muy frecuentes dominan el TF-IDF.
**Solución**: Agregar parámetro `sublinear_tf=True` (reemplaza tf con 1 + log(tf)).
**Impacto**: Alto

### 3. Refactor pandas .apply() a .str accessor
**Problema**: `.apply(limpiar_texto)` es más lento que operaciones vectorizadas.
**Solución**: Refactorizar limpieza de texto usando `.str.lower()`, `.str.replace()`, etc.
**Impacto**: Medio

### 4. Optimizar parámetros Word2Vec
**Problema**: Parámetros actuales no óptimos para corpus pequeño (~600 docs).
**Solución**: `vector_size=200`, `min_count=2`, `epochs=20`, `sg=1` (Skip-gram).
**Impacto**: Bajo

### 5. Fix bare except clause
**Problema**: `except:` captura todo incluyendo KeyboardInterrupt.
**Solución**: Cambiar a `except ValueError:`.
**Impacto**: Bajo

## Approach
- Aplicar cambios directamente en el notebook
- Cada cambio es independiente y atómico
- Sin tests (notebook de análisis, no código de producción)
- Re-ejecutar notebook completo para validar

## Risks
- Notebook puede tener dependencias entre celdas
- Re-ejecución puede generar outputs diferentes
