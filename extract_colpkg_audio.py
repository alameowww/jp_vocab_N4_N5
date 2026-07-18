"""Extract vocabulary MP3 files from a modern Anki .colpkg package."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "japanese_vocab.json"
OUTPUT_DIR = ROOT / "audio"


def read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, offset
        shift += 7


def parse_media_names(data: bytes) -> list[str]:
    names: list[str] = []
    offset = 0
    while offset < len(data):
        tag, offset = read_varint(data, offset)
        if tag != 10:  # repeated MediaEntry entries = 1
            raise ValueError(f"Unexpected media-list tag {tag} at byte {offset}")
        length, offset = read_varint(data, offset)
        entry = data[offset : offset + length]
        offset += length

        entry_offset = 0
        entry_tag, entry_offset = read_varint(entry, entry_offset)
        if entry_tag != 10:  # string name = 1
            raise ValueError("Media entry does not start with a filename")
        name_length, entry_offset = read_varint(entry, entry_offset)
        names.append(entry[entry_offset : entry_offset + name_length].decode("utf-8"))
    return names


def decompress_zstd(data: bytes) -> bytes:
    return decompress_zstd_many([data])[0]


def decompress_zstd_many(chunks: list[bytes]) -> list[bytes]:
    node = os.environ.get(
        "TASK_NODE",
        r"C:\Users\95671\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
    )
    script = """
const z=require('node:zlib'),a=[];
process.stdin.on('data',b=>a.push(b)).on('end',()=>{
  const input=Buffer.concat(a), output=[];
  let offset=0;
  while(offset<input.length){
    const size=Number(input.readBigUInt64LE(offset)); offset+=8;
    const decoded=z.zstdDecompressSync(input.subarray(offset,offset+size)); offset+=size;
    const header=Buffer.alloc(8); header.writeBigUInt64LE(BigInt(decoded.length));
    output.push(header,decoded);
  }
  process.stdout.write(Buffer.concat(output));
});
"""
    framed = b"".join(len(chunk).to_bytes(8, "little") + chunk for chunk in chunks)
    result = subprocess.run(
        [node, "-e", script], input=framed, capture_output=True, check=True
    )
    decoded: list[bytes] = []
    offset = 0
    while offset < len(result.stdout):
        size = int.from_bytes(result.stdout[offset : offset + 8], "little")
        offset += 8
        decoded.append(result.stdout[offset : offset + size])
        offset += size
    return decoded


def vocabulary_audio_names() -> set[str]:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    rows = payload if isinstance(payload, list) else payload.get("vocabulary", [])
    return {
        row["audio"].strip()
        for row in rows
        if isinstance(row, dict) and isinstance(row.get("audio"), str) and row["audio"].strip()
    }


def main() -> None:
    packages = list(ROOT.glob("*.colpkg"))
    if len(packages) != 1:
        raise SystemExit(f"Expected exactly one .colpkg file, found {len(packages)}")

    required = vocabulary_audio_names()
    extracted = skipped = conflicts = 0

    with zipfile.ZipFile(packages[0]) as archive:
        names = parse_media_names(decompress_zstd(archive.read("media")))
        package_lookup = {name: str(index) for index, name in enumerate(names)}
        matched = sorted(required & package_lookup.keys())
        missing = sorted(required - package_lookup.keys())

        contents = {
            filename:archive.read(package_lookup[filename])
            for filename in matched
        }
        compressed_names = [
            filename for filename, content in contents.items()
            if content.startswith(b"\x28\xb5\x2f\xfd")
        ]
        decoded_contents = decompress_zstd_many(
            [contents[filename] for filename in compressed_names]
        )
        contents.update(zip(compressed_names, decoded_contents))

        OUTPUT_DIR.mkdir(exist_ok=True)
        for filename in matched:
            if Path(filename).name != filename:
                raise ValueError(f"Unsafe media filename: {filename!r}")
            content = contents[filename]
            target = OUTPUT_DIR / filename
            if target.exists():
                if hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(content).digest():
                    skipped += 1
                    continue
                if target.read_bytes().startswith(b"\x28\xb5\x2f\xfd"):
                    target.write_bytes(content)
                    extracted += 1
                    continue
                conflicts += 1
                continue
            target.write_bytes(content)
            extracted += 1

    report = {
        "package_media_entries": len(names),
        "package_mp3_entries": sum(name.lower().endswith(".mp3") for name in names),
        "required_unique_audio": len(required),
        "matched": len(matched),
        "missing": len(missing),
        "extracted": extracted,
        "already_present": skipped,
        "conflicts_not_overwritten": conflicts,
        "missing_files": missing,
    }
    report_path = ROOT / "audio_extraction_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "missing_files"}, ensure_ascii=False))
    print(f"report={report_path.name}")


if __name__ == "__main__":
    main()
