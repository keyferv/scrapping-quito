# Tasks: NLP Pipeline Improvements

## Task 1: Fix Lemmatización con POS tags
- **ID**: T1
- **Priority**: CRITICAL
- **Description**: Agregar import de wordnet, función de mapeo POS, y refactorizar lematización
- **Cell**: 9 (LEMATIZACION)
- **Changes**:
  1. Agregar `from nltk.corpus import wordnet` en imports (cell 2)
  2. Agregar función `get_wordnet_pos(tag)` 
  3. Reemplazar `lematizar_tokens` por versión con POS tags
- **Verification**: "walking" → "walk", "visited" → "visit"

## Task 2: Agregar sublinear_tf=True
- **ID**: T2
- **Priority**: HIGH
- **Description**: Agregar parámetro sublinear_tf=True a TfidfVectorizer
- **Cell**: 9 (TF-IDF)
- **Changes**:
  1. Línea con TfidfVectorizer: agregar `sublinear_tf=True`
- **Verification**: Scores TF-IDF cambian

## Task 3: Refactor limpieza a .str accessor
- **ID**: T3
- **Priority**: MEDIUM
- **Description**: Reemplazar función limpiar_texto por operaciones .str encadenadas
- **Cell**: 6 (LIMPIEZA)
- **Changes**:
  1. Reemplazar `df['text_clean'] = df['text'].apply(limpiar_texto)` por operaciones .str
  2. Mantener o eliminar función `limpiar_texto`
- **Verification**: Output de limpieza idéntico al anterior

## Task 4: Optimizar Word2Vec
- **ID**: T4
- **Priority**: LOW
- **Description**: Cambiar parámetros Word2Vec
- **Cell**: 14 (WORD EMBEDDINGS)
- **Changes**:
  1. `vector_size=100` → `vector_size=200`
  2. `min_count=3` → `min_count=2`
  3. `epochs=50` → `epochs=20`
  4. Agregar `sg=1`
- **Verification**: Modelo se entrena sin errores

## Task 5: Fix bare except
- **ID**: T5
- **Priority**: LOW
- **Description**: Reemplazar except genérico
- **Cell**: 9b (TF-IDF por sentimiento)
- **Changes**:
  1. `except:` → `except ValueError:`
- **Verification**: Código funciona igual

## Execution Order
T1 → T2 → T3 → T4 → T5 (independientes, pero secuencial por claridad)

## Review Workload Forecast
- Estimated changed lines: ~50-80 lines
- Chained PRs recommended: No
- Single PR sufficient
