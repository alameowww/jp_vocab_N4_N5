"""从 Tatoeba 公共 API 为词汇补充日中双语例句。

脚本可重复执行：已经有两条例句的词会跳过；每完成一批就保存，
中断后再次运行会从未完成的词继续。
"""

import argparse
import http.client
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlencode


API_URL = "https://api.tatoeba.org/v1/sentences"
API_HOST = "api.tatoeba.org"
API_PATH = "/v1/sentences"
SOURCE_NAME = "Tatoeba"
DEFAULT_INPUT = "japanese_vocab.json"
MAX_EXAMPLES = 2
thread_clients = threading.local()


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def normalize_search_term(value):
    value = re.sub(r"[\s～〜―—・]+", "", value or "")
    value = re.sub(r"[。！？!?]+$", "", value)
    return value.strip()


def walk_dicts(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def chinese_translations(sentence):
    results = []

    for item in walk_dicts(sentence.get("translations", [])):
        language = item.get("lang") or item.get("language")
        text = item.get("text")

        if language in {"cmn", "zho"} and text:
            results.append(text.strip())

    return list(dict.fromkeys(results))


class TatoebaClient:
    def __init__(self, timeout=8):
        self.timeout = timeout
        self.connection = None

    def close(self):
        if self.connection:
            self.connection.close()
            self.connection = None

    def request(self, parameters):
        path = f"{API_PATH}?{urlencode(parameters)}"

        for attempt in range(1):
            try:
                if self.connection is None:
                    self.connection = http.client.HTTPSConnection(
                        API_HOST,
                        timeout=self.timeout,
                    )

                self.connection.request(
                    "GET",
                    path,
                    headers={
                        "Accept": "application/json",
                        "User-Agent": "JapaneseReviewVocabularyEnricher/1.0",
                    },
                )
                response = self.connection.getresponse()
                body = response.read()

                if response.status != 200:
                    raise RuntimeError(
                        f"Tatoeba HTTP {response.status}: "
                        f"{body[:160].decode('utf-8', errors='replace')}"
                    )

                return json.loads(body.decode("utf-8"))
            except Exception:
                self.close()
                raise

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()


def request_examples(client, term):
    parameters = {
        "lang": "jpn",
        "q": term,
        "trans:lang": "cmn",
        "trans:is_direct": "yes",
        "is_unapproved": "no",
        "sort": "words",
        "limit": 12,
    }
    return client.request(parameters)


def fetch_word_examples(client, word):
    term = normalize_search_term(word.get("word"))

    if not term:
        return []

    examples = []
    seen_japanese = set()

    payload = request_examples(client, term)

    for sentence in payload.get("data", []):
        japanese = (sentence.get("text") or "").strip()
        translations = chinese_translations(sentence)

        if (
            not japanese
            or term not in normalize_search_term(japanese)
            or not translations
            or japanese in seen_japanese
        ):
            continue

        sentence_id = sentence.get("id")
        examples.append({
            "ja": japanese,
            "zh": translations[0],
            "source_name": SOURCE_NAME,
            "source_id": sentence_id,
            "source_url": (
                f"https://tatoeba.org/sentences/show/{sentence_id}"
                if sentence_id else "https://tatoeba.org/"
            ),
        })
        seen_japanese.add(japanese)

        if len(examples) >= MAX_EXAMPLES:
            return examples

    return examples


def fetch_word_examples_with_persistent_client(word):
    if not hasattr(thread_clients, "client"):
        thread_clients.client = TatoebaClient()

    return fetch_word_examples(thread_clients.client, word)


def save_vocabulary(path, vocabulary):
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(vocabulary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def enrich(path, workers, batch_size, limit=None):
    vocabulary = json.loads(path.read_text(encoding="utf-8"))
    pending = [
        word for word in vocabulary
        if (
            not word.get("examples_checked_at")
            or word.get("examples_error")
        )
    ]

    if limit is not None:
        pending = pending[:limit]

    print(f"总词数 {len(vocabulary)}，待查询 {len(pending)}")
    completed = 0
    matched = 0

    with ThreadPoolExecutor(max_workers=workers) as executor:
        for start in range(0, len(pending), batch_size):
            batch = pending[start:start + batch_size]
            futures = {
                executor.submit(
                    fetch_word_examples_with_persistent_client,
                    word,
                ): word
                for word in batch
            }

            for future in as_completed(futures):
                word = futures[future]
                try:
                    examples = future.result()
                    word["examples"] = examples
                    word["examples_source"] = SOURCE_NAME
                    word["examples_checked_at"] = time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ",
                        time.gmtime(),
                    )
                    word.pop("examples_error", None)
                    matched += int(len(examples) >= MAX_EXAMPLES)
                except Exception as error:
                    word["examples_error"] = str(error)

                completed += 1

            save_vocabulary(path, vocabulary)
            print(
                f"进度 {completed}/{len(pending)}，"
                f"已有两条例句 {matched}",
                flush=True,
            )

    coverage = sum(
        len(word.get("examples", [])) >= MAX_EXAMPLES
        for word in vocabulary
    )
    print(f"完成：{coverage}/{len(vocabulary)} 个词拥有两条例句")


def parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=DEFAULT_INPUT)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--limit", type=int)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_arguments()
    enrich(
        Path(arguments.input),
        max(1, min(arguments.workers, 3)),
        max(1, arguments.batch_size),
        arguments.limit,
    )
