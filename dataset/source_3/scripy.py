import argparse
import glob
import json
import re
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from openai import OpenAI

client = OpenAI()
OUTPUT_DIR = Path("./output")
DEBUG_DIR = Path("./debug")
OUTPUT_DIR.mkdir(exist_ok=True)
MAX_RETRIES = 3
QUESTIONS_PER_CHUNK = 10
DEBUG_MODE = True
FILE_WORKERS = 16  # Concurrent files
CHUNK_WORKERS = 16  # Concurrent chunks per file


def debug_log(file: str, message: str, data: str = None):
    """Write debug information to a file."""
    if not DEBUG_MODE:
        return

    DEBUG_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%H:%M:%S")
    file_path = Path(file)
    parent_name = file_path.parent.name.replace(" ", "_")
    file_name = file_path.stem.replace(" ", "_")
    safe_name = f"{parent_name}_{file_name}" if parent_name else file_name
    log_path = DEBUG_DIR / f"{safe_name}_debug.log"

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"\n{'='*80}\n")
        f.write(f"[{timestamp}] {message}\n")
        if data:
            f.write(f"{'-'*40}\n{data}\n")

EXTRACTION_PROMPT = """
Eres un parser de ejercicios de Habilidad Verbal del CEPRE San Marcos.

### MISIÓN
Parsear preguntas y respuestas exactamente como aparecen en el texto.
NO inventes, extiendas ni modifiques la información. Solo extrae lo que está presente.

### ESQUEMA JSON - EJERCICIOS SIMPLES

{{
  "type": "sentence_elimination" | "writing_plan" | "incomplete_sentences" | "verbal_series" | "analogies" | "synonyms_and_antonyms" | "coherence_correction",
  "statement": string,
  "alternatives": [string],
  "correct": number,
  "rationale": string | null
}}

### ESQUEMA JSON - COMPRENSIÓN LECTORA

Para ejercicios de comprensión lectora con múltiples preguntas sobre un mismo texto:

{{
  "type": "reading_comprehension",
  "statement": string,  // El texto de lectura ÚNICAMENTE, sin las preguntas
  "questions": [
    {{
      "statement": string,  // Solo el enunciado de la pregunta, SIN el texto de lectura
      "alternatives": [string],
      "correct": number,
      "rationale": string | null
    }}
  ]
}}

### TIPOS
- "sentence_elimination" → Eliminación de oraciones
- "writing_plan" → Plan de redacción / Ordenamiento. Students receive a set of sentences that are part of the same content and must arrange them in the correct order.
- "incomplete_sentences" → Oraciones incompletas
- "verbal_series" → Series verbales
- "analogies" → Analogías
- "synonyms_and_antonyms" → Sinónimos o antónimos
- "reading_comprehension" → Comprensión lectora / Inferencias. El texto de lectura va en "statement" y las preguntas relacionadas van en el array "questions".

### REGLAS CRÍTICAS
1. "correct" usa índice base 0 (primera alternativa = 0). NUNCA puede ser null.
2. "alternatives" NUNCA puede ser un array vacío. Debe tener al menos 1 alternativa.
3. El "statement" contiene SOLO el enunciado/pregunta (o el texto de lectura para reading_comprehension). NO incluir las alternativas ni la respuesta (Rpta/Solución).
4. Para "reading_comprehension": el "statement" del nivel superior contiene SOLO el texto de lectura. Las preguntas van en el array "questions", donde cada pregunta tiene su propio "statement" con SOLO la pregunta (sin repetir el texto).
5. Para otros tipos: el "statement" DEBE incluir el TEXTO COMPLETO seguido de la pregunta, pero SIN las alternativas.
6. Vincula las claves de respuesta (Rpta, Clave, Solución) con su ejercicio correspondiente para determinar "correct".
7. Devuelve JSON puro sin markdown. Escribe JSON compacto sin espacios ni tabulaciones (una sola línea).
8. USA SOLO la información del texto. NO agregues información externa tuya ni corrijas errores del texto original.
9. SIEMPRE devuelve un array de ejercicios, incluso si hay solo uno: [ {{ ... }} ]
10. Conserva el formato original de las alternativas (ej: "A) texto", "B) texto"). NO elimines los prefijos A), B), C), etc. Solo una alternativa por elemento.
11. NO preguntes, NO ofrezcas opciones, NO expliques. Solo devuelve el JSON completo con TODOS los ejercicios de una sola vez.
12. Si una pregunta está incompleta o mal formada (sin alternativas claras, sin respuesta, datos faltantes), OMÍTELA y continúa con las demás. Solo incluye preguntas bien formadas en el resultado.
13. Si detectas múltiples preguntas sobre el mismo texto de lectura, agrúpalas en UN SOLO ejercicio de tipo "reading_comprehension" con el texto en "statement" y todas las preguntas en "questions".
14. OMITE cualquier pregunta que no tenga una respuesta indexable clara.

### TEXTO A PROCESAR
{content}
"""


def split_by_answer_marker(content: str) -> list[str]:
    """Split content into chunks based on answer markers."""
    # Matches: Clave: A, Rpta.: B, Solución:, Solución (A):, SOLUCIÓN:, SOLUCIÓN C:, SOL. A:, etc.
    pattern = r'((?:Clave|Rpta\.?)\s*:?\s*[A-E]|[Ss][Oo][Ll](?:UCIÓN|ución)\.?\s*(?:\(?[A-E]\)?)?\s*:?(?:\n|$))'
    parts = re.split(pattern, content)

    if len(parts) <= 1:
        return []

    # Reconstruct questions: each question ends with an answer marker
    questions = []
    current = ""
    for i, part in enumerate(parts):
        if re.match(pattern, part):
            current += part
            questions.append(current.strip())
            current = ""
        else:
            current += part

    return questions


def chunk_questions(questions: list[str], chunk_size: int, overlap_lines: int = 20) -> list[str]:
    """Group questions into chunks with line overlap for context."""
    chunks = []
    for i in range(0, len(questions), chunk_size):
        chunk_questions_list = questions[i:i + chunk_size]
        chunk = "\n\n".join(chunk_questions_list)

        # Add overlap from next questions (as trailing context)
        if i + chunk_size < len(questions):
            next_questions = questions[i + chunk_size:i + chunk_size + 3]  # Next 3 questions for context
            overlap_text = "\n\n".join(next_questions)
            overlap_lines_text = "\n".join(overlap_text.split("\n")[:overlap_lines])
            if overlap_lines_text:
                chunk += "\n\n" + overlap_lines_text

        chunks.append(chunk)
    return chunks


def chunk_by_lines(content: str, num_chunks: int = 4, overlap_lines: int = 100) -> list[str]:
    """Split content into N chunks with line overlap."""
    lines = content.split("\n")
    total_lines = len(lines)

    if total_lines <= overlap_lines:
        return [content]

    # Calculate base chunk size (without overlap)
    base_chunk_size = total_lines // num_chunks

    chunks = []
    for i in range(num_chunks):
        start = i * base_chunk_size
        # Last chunk gets all remaining lines
        if i == num_chunks - 1:
            end = total_lines
        else:
            end = (i + 1) * base_chunk_size + overlap_lines

        chunk_lines = lines[start:end]
        chunks.append("\n".join(chunk_lines))

    return chunks


def clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text


def extract_exercises(content: str, file: str = "", chunk_idx: int = 0) -> str:
    debug_log(file, f"CHUNK {chunk_idx} - INPUT CONTENT ({len(content)} chars)", content[:2000] + ("..." if len(content) > 2000 else ""))

    response = client.chat.completions.create(
        model="gpt-5-nano",
        messages=[{"role": "user", "content": EXTRACTION_PROMPT.format(content=content)}],
        temperature=1,
    )

    if response.choices[0].finish_reason == "length":
        debug_log(file, f"CHUNK {chunk_idx} - ERROR: Output truncated")
        raise ValueError("Output truncated due to length limit")

    print(response)

    raw_response = response.choices[0].message.content
    debug_log(file, f"CHUNK {chunk_idx} - RAW API RESPONSE", raw_response)

    cleaned = clean_json_response(raw_response)
    debug_log(file, f"CHUNK {chunk_idx} - CLEANED RESPONSE", cleaned)

    return cleaned


def save_json(data, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_error(content: str, error_path: Path):
    error_path.parent.mkdir(parents=True, exist_ok=True)
    with open(error_path, "w", encoding="utf-8") as f:
        f.write(content)


def process_chunk(chunk: str, chunk_idx: int, file: str = "") -> tuple[int, list | None, str | None]:
    """Process a single chunk. Returns (chunk_idx, exercises, error)."""
    last_error = None
    last_response = None

    for attempt in range(MAX_RETRIES):
        try:
            debug_log(file, f"CHUNK {chunk_idx} - ATTEMPT {attempt + 1}/{MAX_RETRIES}")
            answer = extract_exercises(chunk, file, chunk_idx)
            last_response = answer
            parsed = json.loads(answer)

            exercises = parsed if isinstance(parsed, list) else [parsed]

            # Validate exercises
            for i, ex in enumerate(exercises):
                if not isinstance(ex, dict):
                    raise ValueError(f"Exercise {i} is not a dict: {type(ex)}")
                if "alternatives" not in ex or not ex["alternatives"]:
                    debug_log(file, f"CHUNK {chunk_idx} - WARNING: Exercise {i} has no alternatives", json.dumps(ex, indent=2, ensure_ascii=False))
                if "correct" not in ex or ex["correct"] is None:
                    debug_log(file, f"CHUNK {chunk_idx} - WARNING: Exercise {i} has no correct index", json.dumps(ex, indent=2, ensure_ascii=False))

            debug_log(file, f"CHUNK {chunk_idx} - SUCCESS: Parsed {len(exercises)} exercises")
            return (chunk_idx, exercises, None)
        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}. Response was: {last_response[:500] if last_response else 'None'}..."
            debug_log(file, f"CHUNK {chunk_idx} - JSON ERROR", f"Error: {e}\nResponse: {last_response}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
        except ValueError as e:
            last_error = str(e)
            stack = traceback.format_exc()
            debug_log(file, f"CHUNK {chunk_idx} - VALUE ERROR", f"{e}\n\nStack trace:\n{stack}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
        except Exception as e:
            last_error = f"{type(e).__name__}: {e}"
            stack = traceback.format_exc()
            debug_log(file, f"CHUNK {chunk_idx} - UNEXPECTED ERROR", f"{type(e).__name__}: {e}\n\nStack trace:\n{stack}")
            print(f"    ⚠ Unexpected error in chunk {chunk_idx}: {type(e).__name__}: {e}")
            print(f"      {stack}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)

    debug_log(file, f"CHUNK {chunk_idx} - FAILED after {MAX_RETRIES} attempts", last_error)
    return (chunk_idx, None, last_error or "Unknown error")


def process_file(file: str) -> tuple[str, int, int, str | None, list]:
    """Process a single file. Returns (file, exercises_count, errors_count, output_path, errors)."""
    # Check if output already exists
    output_path = OUTPUT_DIR / Path(file).relative_to(".").with_suffix(".json")
    if output_path.exists():
        return (file, -1, 0, str(output_path), [])  # -1 indicates skipped

    debug_log(file, f"PROCESSING FILE: {file}")

    content = Path(file).read_text(encoding="utf-8")
    debug_log(file, f"FILE CONTENT ({len(content)} chars)", content[:1000] + "..." if len(content) > 1000 else content)

    questions = split_by_answer_marker(content)
    debug_log(file, f"SPLIT RESULT: Found {len(questions)} questions")

    if questions:
        for i, q in enumerate(questions[:3]):  # Log first 3 questions
            debug_log(file, f"QUESTION {i} SAMPLE", q[:500] + "..." if len(q) > 500 else q)

    if not questions:
        debug_log(file, "NO ANSWER MARKERS FOUND - splitting file into 4 chunks with 100 line overlap")
        # Log what patterns we're looking for
        patterns_found = {
            "Clave": len(re.findall(r'Clave', content, re.IGNORECASE)),
            "Rpta": len(re.findall(r'Rpta', content, re.IGNORECASE)),
            "Solución": len(re.findall(r'Solución', content, re.IGNORECASE)),
        }
        debug_log(file, "PATTERN SEARCH", json.dumps(patterns_found, indent=2))
        # Split file into 4 chunks with 100 line overlap
        chunks = chunk_by_lines(content, num_chunks=4, overlap_lines=100)
    else:
        chunks = chunk_questions(questions, QUESTIONS_PER_CHUNK, overlap_lines=20)

    debug_log(file, f"CREATED {len(chunks)} CHUNKS")

    all_exercises = [None] * len(chunks)
    errors = []

    # Process chunks in parallel
    with ThreadPoolExecutor(max_workers=CHUNK_WORKERS) as executor:
        futures = {executor.submit(process_chunk, chunk, idx, file): (idx, chunk) for idx, chunk in enumerate(chunks)}
        for future in as_completed(futures):
            idx, chunk = futures[future]
            chunk_idx, exercises, error = future.result()
            if exercises:
                all_exercises[chunk_idx] = exercises
            else:
                errors.append((chunk_idx, error, chunk))  # Include chunk content in error

    # Flatten results (preserving order)
    final_exercises = []
    for ex_list in all_exercises:
        if ex_list:
            final_exercises.extend(ex_list)

    debug_log(file, f"FINAL RESULT: {len(final_exercises)} exercises, {len(errors)} errors")

    if final_exercises:
        suffix = ".json" if not errors else ".partial.json"
        output_path = OUTPUT_DIR / Path(file).relative_to(".").with_suffix(suffix)
        save_json(final_exercises, output_path)
        return (file, len(final_exercises), len(errors), str(output_path), errors)

    return (file, 0, len(errors), None, errors)


def main():
    global DEBUG_MODE

    parser = argparse.ArgumentParser(description="Parse verbal skill exercises from CEPRE San Marcos files")
    parser.add_argument("--debug", "-d", default=True, action="store_true", help="Enable debug mode (logs to ./debug/)")
    parser.add_argument("--file", "-f", type=str, help="Process a single file instead of all files")
    args = parser.parse_args()

    DEBUG_MODE = args.debug

    if DEBUG_MODE:
        DEBUG_DIR.mkdir(exist_ok=True)
        print(f"🐛 Debug mode enabled. Logs will be saved to {DEBUG_DIR}/")

    if args.file:
        files = [args.file]
    else:
        files = glob.glob("./dataset/**/*.txt", recursive=True)

    if not files:
        print("No .txt files found")
        return

    print(f"Processing {len(files)} file(s)...\n")

    with ThreadPoolExecutor(max_workers=FILE_WORKERS) as executor:
        futures = {executor.submit(process_file, f): f for f in files}

        for future in as_completed(futures):
            try:
                result = future.result()
                if result is None:
                    print(f"✗ {futures[future]} → Returned None")
                    continue

                file, exercises_count, errors_count, output_path, errors = result

                if exercises_count == -1:
                    print(f"⊘ {file} → Skipped (already exists)")
                elif output_path and errors_count == 0:
                    print(f"✓ {file} → {exercises_count} exercises")
                elif output_path and errors_count > 0:
                    print(f"⚠ {file} → {exercises_count} exercises ({errors_count} chunk errors)")
                    if DEBUG_MODE:
                        for chunk_idx, error, chunk_content in errors:
                            if error:
                                print(f"    Chunk {chunk_idx}: {error[:100]}...")
                elif exercises_count == 0 and errors_count == 0:
                    print(f"✗ {file} → No answer markers found")
                else:
                    print(f"✗ {file} → Failed ({errors_count} errors)")
                    for item in errors:
                        if item and len(item) == 3:
                            chunk_idx, error, chunk_content = item
                            print(f"    Chunk {chunk_idx}: {error[:150] if error else 'Unknown'}...")
                            if DEBUG_MODE:
                                # Save failed chunk for inspection
                                failed_chunk_path = DEBUG_DIR / f"failed_chunk_{Path(file).stem}_{chunk_idx}.txt"
                                failed_chunk_path.write_text(chunk_content, encoding="utf-8")
                                print(f"    → Saved to {failed_chunk_path}")
                        elif item and len(item) == 2:
                            chunk_idx, error = item
                            print(f"    Chunk {chunk_idx}: {error}")
                        else:
                            print(f"    Unknown error format: {item}")
            except Exception as e:
                print(f"✗ {futures[future]} → Exception: {e}")
                traceback.print_exc()

    if DEBUG_MODE:
        print(f"\n🐛 Debug logs saved to {DEBUG_DIR}/")


if __name__ == "__main__":
    main()
